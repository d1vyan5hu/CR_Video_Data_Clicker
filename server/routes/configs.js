const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');

const router = express.Router();

function validateConfig(json) {
  if (!json || typeof json !== 'object') return 'Config must be a JSON object';
  if (!Array.isArray(json.steps)) return 'Config must have a "steps" array';
  for (const step of json.steps) {
    if (!step.step_id) return 'Every step needs a "step_id"';
    if (!step.question) return `Step "${step.step_id}" needs a "question"`;
    if (step.type !== 'text' && !Array.isArray(step.choices)) {
      return `Step "${step.step_id}" needs "choices" (or "type": "text")`;
    }
  }
  return null;
}

// POST /api/configs - save a new JSON config
router.post('/', (req, res) => {
  const { name, json } = req.body;
  if (!name) return res.status(400).json({ error: 'Config name is required' });
  const error = validateConfig(json);
  if (error) return res.status(400).json({ error });

  const id = uuid();
  db.prepare('INSERT INTO configs (id, name, json) VALUES (?, ?, ?)').run(id, name, JSON.stringify(json));
  const config = db.prepare('SELECT * FROM configs WHERE id = ?').get(id);
  res.status(201).json({ ...config, json: JSON.parse(config.json) });
});

// GET /api/configs - list all saved configs
router.get('/', (req, res) => {
  const configs = db.prepare('SELECT id, name, created_at FROM configs ORDER BY created_at DESC').all();
  res.json(configs);
});

// GET /api/configs/:id
router.get('/:id', (req, res) => {
  const config = db.prepare('SELECT * FROM configs WHERE id = ?').get(req.params.id);
  if (!config) return res.status(404).json({ error: 'Config not found' });
  res.json({ ...config, json: JSON.parse(config.json) });
});

module.exports = router;
