const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');

const router = express.Router({ mergeParams: true });

function loadCameras(intervalId) {
  return db.prepare('SELECT * FROM cameras WHERE interval_id = ? ORDER BY sort_order ASC, created_at ASC').all(intervalId);
}

function withCameras(interval) {
  return { ...interval, cameras: loadCameras(interval.id) };
}

// GET /api/projects/:projectId/intervals
router.get('/', (req, res) => {
  const intervals = db
    .prepare('SELECT * FROM intervals WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(req.params.projectId);
  res.json(intervals.map(withCameras));
});

// POST /api/projects/:projectId/intervals
router.post('/', (req, res) => {
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { label, wall_start } = req.body || {};
  const count = db.prepare('SELECT COUNT(*) AS n FROM intervals WHERE project_id = ?').get(req.params.projectId).n;
  const id = uuid();
  db.prepare('INSERT INTO intervals (id, project_id, label, wall_start, sort_order) VALUES (?, ?, ?, ?, ?)').run(
    id,
    req.params.projectId,
    label || `Interval ${count + 1}`,
    wall_start || null,
    count
  );
  touchProject(req.params.projectId);
  res.status(201).json(withCameras(db.prepare('SELECT * FROM intervals WHERE id = ?').get(id)));
});

// PATCH /api/intervals/:id (mounted separately below via router2, see export)
function touchProject(projectId) {
  db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(projectId);
}

// Standalone interval/camera routes (not nested under project id in the URL)
const standalone = express.Router();

standalone.patch('/intervals/:id', (req, res) => {
  const interval = db.prepare('SELECT * FROM intervals WHERE id = ?').get(req.params.id);
  if (!interval) return res.status(404).json({ error: 'Interval not found' });
  const label = req.body?.label ?? interval.label;
  const wallStart = req.body?.wall_start ?? interval.wall_start;
  db.prepare('UPDATE intervals SET label = ?, wall_start = ? WHERE id = ?').run(label, wallStart, req.params.id);
  touchProject(interval.project_id);
  res.json(withCameras(db.prepare('SELECT * FROM intervals WHERE id = ?').get(req.params.id)));
});

standalone.delete('/intervals/:id', (req, res) => {
  const interval = db.prepare('SELECT * FROM intervals WHERE id = ?').get(req.params.id);
  if (!interval) return res.status(404).json({ error: 'Interval not found' });
  db.prepare('DELETE FROM intervals WHERE id = ?').run(req.params.id);
  touchProject(interval.project_id);
  res.json({ ok: true });
});

// POST /api/intervals/:id/cameras
standalone.post('/intervals/:id/cameras', (req, res) => {
  const interval = db.prepare('SELECT * FROM intervals WHERE id = ?').get(req.params.id);
  if (!interval) return res.status(404).json({ error: 'Interval not found' });

  const { name, label, source_type, local_path, url } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Camera name is required' });

  const sourceType = source_type === 'url' ? 'url' : 'local';

  // A lightweight "videos" row represents this camera's footage so the existing
  // annotations pipeline (video_id NOT NULL) keeps working — no file is ever
  // uploaded or copied; this just stores the reference (local file name or URL).
  const videoId = uuid();
  db.prepare('INSERT INTO videos (id, name, filename, project_id, local_path) VALUES (?, ?, ?, ?, ?)').run(
    videoId,
    label || name.trim(),
    sourceType === 'url' ? (url || '') : (local_path || ''),
    interval.project_id,
    sourceType === 'local' ? (local_path || null) : (url || null)
  );

  const count = db.prepare('SELECT COUNT(*) AS n FROM cameras WHERE interval_id = ?').get(req.params.id).n;
  const id = uuid();
  db.prepare(
    'INSERT INTO cameras (id, interval_id, name, label, source_type, local_path, url, sort_order, video_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.params.id, name.trim(), label || name.trim(), sourceType, local_path || null, url || null, count, videoId);
  touchProject(interval.project_id);
  res.status(201).json(db.prepare('SELECT * FROM cameras WHERE id = ?').get(id));
});

standalone.patch('/cameras/:id', (req, res) => {
  const camera = db.prepare('SELECT * FROM cameras WHERE id = ?').get(req.params.id);
  if (!camera) return res.status(404).json({ error: 'Camera not found' });
  const name = req.body?.name ?? camera.name;
  const label = req.body?.label ?? camera.label;
  const sourceType = req.body?.source_type ?? camera.source_type;
  const localPath = req.body?.local_path !== undefined ? req.body.local_path : camera.local_path;
  const url = req.body?.url !== undefined ? req.body.url : camera.url;
  db.prepare('UPDATE cameras SET name = ?, label = ?, source_type = ?, local_path = ?, url = ? WHERE id = ?').run(
    name,
    label,
    sourceType,
    localPath,
    url,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM cameras WHERE id = ?').get(req.params.id));
});

standalone.delete('/cameras/:id', (req, res) => {
  const camera = db.prepare('SELECT * FROM cameras WHERE id = ?').get(req.params.id);
  if (!camera) return res.status(404).json({ error: 'Camera not found' });
  db.prepare('DELETE FROM cameras WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = { projectIntervalsRouter: router, standaloneRouter: standalone };
