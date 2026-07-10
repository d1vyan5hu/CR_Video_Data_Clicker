// Uses Node's built-in experimental SQLite module (Node >= 22.5) so the
// project has zero native-addon build step. If you're on an older Node,
// swap this for `better-sqlite3` (same prepare/run/get/all API).
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'annotator.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    filename TEXT NOT NULL,
    duration REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    config_id TEXT,
    timestamp REAL NOT NULL,
    frame INTEGER,
    x REAL,
    y REAL,
    fields_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_annotations_video ON annotations(video_id);
`);

module.exports = db;
