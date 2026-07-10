const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { v4: uuid } = require('uuid');
const db = require('../db');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  }
});
const upload = multer({ storage });

function extensionFor(contentType, sourceUrl) {
  const ext = path.extname(new URL(sourceUrl).pathname).toLowerCase();
  if (['.mp4', '.webm', '.mov', '.mkv', '.avi'].includes(ext)) return ext;
  const typeMap = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/x-matroska': '.mkv', 'video/x-msvideo': '.avi' };
  return typeMap[(contentType || '').split(';')[0].toLowerCase()] || '.mp4';
}

function filenameFor(response, sourceUrl, ext) {
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i);
  const fromHeader = match ? decodeURIComponent(match[1].replace(/[\\/]/g, '')) : '';
  const fromUrl = path.basename(new URL(sourceUrl).pathname).replace(/[\\/]/g, '');
  const base = fromHeader || fromUrl || 'linked-video';
  return base.toLowerCase().endsWith(ext) ? base : `${base}${ext}`;
}

// POST /api/videos - upload a local video file
router.post('/', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video file provided' });
  const id = uuid();
  const name = req.body.name || req.file.originalname;
  db.prepare(
    'INSERT INTO videos (id, name, filename) VALUES (?, ?, ?)'
  ).run(id, name, req.file.filename);
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(id);
  res.status(201).json(video);
});

// POST /api/videos/import-url - download an externally shared, publicly accessible video.
router.post('/import-url', async (req, res, next) => {
  const { url } = req.body || {};
  let source;
  try {
    source = new URL(url);
    if (!['http:', 'https:'].includes(source.protocol)) throw new Error('Only http(s) links are supported');
  } catch (error) {
    return res.status(400).json({ error: 'Enter a valid http(s) video link.' });
  }

  // SharePoint's standard share URL normally needs this parameter to return the file.
  if (source.hostname.endsWith('sharepoint.com') && !source.searchParams.has('download')) source.searchParams.set('download', '1');
  const temporaryPath = path.join(UPLOAD_DIR, `${uuid()}.part`);
  try {
    const response = await fetch(source, { redirect: 'follow', signal: AbortSignal.timeout(120000) });
    if (!response.ok || !response.body) throw new Error(`Remote server returned ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) throw new Error('This link opens a web page, not a downloadable video. Use a direct download/share link.');
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > 2 * 1024 * 1024 * 1024) throw new Error('The video is larger than the 2 GB import limit.');
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temporaryPath));
    const ext = extensionFor(contentType, response.url || source.toString());
    const storedName = `${uuid()}${ext}`;
    fs.renameSync(temporaryPath, path.join(UPLOAD_DIR, storedName));
    const id = uuid();
    const name = filenameFor(response, response.url || source.toString(), ext);
    db.prepare('INSERT INTO videos (id, name, filename) VALUES (?, ?, ?)').run(id, name, storedName);
    res.status(201).json(db.prepare('SELECT * FROM videos WHERE id = ?').get(id));
  } catch (error) {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    res.status(422).json({ error: error.message || 'Could not import the remote video.' });
  }
});

// GET /api/videos - list all videos
router.get('/', (req, res) => {
  const videos = db.prepare('SELECT * FROM videos ORDER BY created_at DESC').all();
  res.json(videos);
});

// GET /api/videos/:id - metadata for one video
router.get('/:id', (req, res) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  res.json(video);
});

// PATCH /api/videos/:id/duration - store duration once known client-side
router.patch('/:id/duration', (req, res) => {
  const { duration } = req.body;
  db.prepare('UPDATE videos SET duration = ? WHERE id = ?').run(duration, req.params.id);
  res.json({ ok: true });
});

// GET /api/videos/:id/stream - stream the video file with range support
router.get('/:id/stream', (req, res) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });

  const filePath = path.join(UPLOAD_DIR, video.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Video file missing on disk' });

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mimeMap = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo' };
  const contentType = mimeMap[ext] || 'video/mp4';

  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': contentType, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(filePath).pipe(res);
  }
});

// DELETE /api/videos/:id
router.delete('/:id', (req, res) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  const filePath = path.join(UPLOAD_DIR, video.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
