const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');

const router = express.Router();

function serialize(row) {
  return { ...row, fields: JSON.parse(row.fields_json) };
}

// GET /api/annotations?video_id=xxx or ?session_id=xxx - list annotations
router.get('/', (req, res) => {
  const { video_id, session_id, interval_id } = req.query;
  let rows;
  if (session_id) {
    rows = db.prepare('SELECT * FROM annotations WHERE session_id = ? ORDER BY timestamp ASC').all(session_id);
  } else if (interval_id) {
    rows = db.prepare('SELECT * FROM annotations WHERE interval_id = ? ORDER BY timestamp ASC').all(interval_id);
  } else if (video_id) {
    rows = db.prepare('SELECT * FROM annotations WHERE video_id = ? ORDER BY timestamp ASC').all(video_id);
  } else {
    return res.status(400).json({ error: 'video_id, session_id, or interval_id query param is required' });
  }
  res.json(rows.map(serialize));
});

// POST /api/annotations - create a new annotation
router.post('/', (req, res) => {
  const { video_id, config_id, timestamp, frame, x, y, fields, interval_id, camera_id, session_id, direction, label } = req.body;
  if (!video_id) return res.status(400).json({ error: 'video_id is required' });
  if (timestamp === undefined) return res.status(400).json({ error: 'timestamp is required' });

  const id = uuid();
  db.prepare(
    `INSERT INTO annotations (id, video_id, config_id, timestamp, frame, x, y, fields_json, interval_id, camera_id, session_id, direction, label)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    video_id,
    config_id || null,
    timestamp,
    frame ?? null,
    x ?? null,
    y ?? null,
    JSON.stringify(fields || {}),
    interval_id || null,
    camera_id || null,
    session_id || null,
    direction || null,
    label || null
  );

  const row = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id);
  res.status(201).json(serialize(row));
});

// PATCH /api/annotations/:id - update fields (e.g. as modal steps are completed) or direction/label
router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM annotations WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Annotation not found' });

  const currentFields = JSON.parse(existing.fields_json);
  const nextFields = { ...currentFields, ...(req.body.fields || {}) };
  const direction = req.body.direction !== undefined ? req.body.direction : existing.direction;
  const label = req.body.label !== undefined ? req.body.label : existing.label;
  db.prepare('UPDATE annotations SET fields_json = ?, direction = ?, label = ? WHERE id = ?').run(
    JSON.stringify(nextFields),
    direction,
    label,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM annotations WHERE id = ?').get(req.params.id);
  res.json(serialize(row));
});

// DELETE /api/annotations/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM annotations WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Annotation not found' });
  res.json({ ok: true });
});

module.exports = router;
