const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');

const router = express.Router();

function withEntryCount(session) {
  const entries = db.prepare('SELECT COUNT(*) AS n FROM annotations WHERE session_id = ?').get(session.id).n;
  return { ...session, entries };
}

// GET /api/intervals/:intervalId/sessions
router.get('/intervals/:intervalId/sessions', (req, res) => {
  const sessions = db
    .prepare('SELECT * FROM sessions WHERE interval_id = ? ORDER BY created_at DESC')
    .all(req.params.intervalId);
  res.json(sessions.map(withEntryCount));
});

// POST /api/intervals/:intervalId/sessions - start a new session
router.post('/intervals/:intervalId/sessions', (req, res) => {
  const interval = db.prepare('SELECT * FROM intervals WHERE id = ?').get(req.params.intervalId);
  if (!interval) return res.status(404).json({ error: 'Interval not found' });

  const { camera_id, started_at } = req.body || {};
  const id = uuid();
  db.prepare('INSERT INTO sessions (id, interval_id, camera_id, started_at, status) VALUES (?, ?, ?, ?, ?)').run(
    id,
    req.params.intervalId,
    camera_id || null,
    started_at || null,
    'active'
  );
  res.status(201).json(withEntryCount(db.prepare('SELECT * FROM sessions WHERE id = ?').get(id)));
});

// PATCH /api/sessions/:id - pause / resume / end, or record a paused_at video timestamp
router.patch('/sessions/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const status = req.body?.status ?? session.status;
  const pausedAt = req.body?.paused_at !== undefined ? req.body.paused_at : session.paused_at;
  const endedAt = req.body?.ended_at !== undefined ? req.body.ended_at : session.ended_at;
  db.prepare('UPDATE sessions SET status = ?, paused_at = ?, ended_at = ? WHERE id = ?').run(
    status,
    pausedAt,
    endedAt,
    req.params.id
  );
  res.json(withEntryCount(db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id)));
});

module.exports = router;
