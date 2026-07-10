const express = require('express');
const db = require('../db');

const router = express.Router();

function collectFieldIds(annotations) {
  const ids = new Set();
  for (const a of annotations) {
    Object.keys(JSON.parse(a.fields_json)).forEach((k) => ids.add(k));
  }
  return Array.from(ids);
}

function toCsvValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// GET /api/export/:videoId?format=csv|json
router.get('/:videoId', (req, res) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.videoId);
  if (!video) return res.status(404).json({ error: 'Video not found' });

  const annotations = db
    .prepare('SELECT * FROM annotations WHERE video_id = ? ORDER BY timestamp ASC')
    .all(req.params.videoId);

  const format = (req.query.format || 'json').toLowerCase();
  const fieldIds = collectFieldIds(annotations);

  if (format === 'csv') {
    const header = ['timestamp_seconds', 'x', 'y', ...fieldIds];
    const lines = [header.join(',')];
    for (const a of annotations) {
      const fields = JSON.parse(a.fields_json);
      const row = [a.timestamp, a.x ?? '', a.y ?? '', ...fieldIds.map((id) => toCsvValue(fields[id]))];
      lines.push(row.join(','));
    }
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${video.name}-annotations.csv"`);
    return res.send(csv);
  }

  // JSON export
  const payload = {
    video: { id: video.id, name: video.name, duration: video.duration },
    exportedAt: new Date().toISOString(),
    totalAnnotations: annotations.length,
    annotations: annotations.map((a) => ({
      id: a.id,
      timestamp: a.timestamp,
      frame: a.frame,
      x: a.x,
      y: a.y,
      fields: JSON.parse(a.fields_json)
    }))
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${video.name}-annotations.json"`);
  res.json(payload);
});

module.exports = router;
