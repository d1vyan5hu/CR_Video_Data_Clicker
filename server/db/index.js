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

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    bin_duration INTEGER NOT NULL DEFAULT 5,
    recording_date TEXT,
    street_name TEXT,
    guid TEXT,
    site_description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS intervals (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    wall_start TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cameras (
    id TEXT PRIMARY KEY,
    interval_id TEXT NOT NULL REFERENCES intervals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'local',
    local_path TEXT,
    url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    interval_id TEXT NOT NULL REFERENCES intervals(id) ON DELETE CASCADE,
    camera_id TEXT REFERENCES cameras(id) ON DELETE SET NULL,
    started_at TEXT,
    paused_at TEXT,
    ended_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_intervals_project ON intervals(project_id);
  CREATE INDEX IF NOT EXISTS idx_cameras_interval ON cameras(interval_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_interval ON sessions(interval_id);
`);

// Lightweight migration: add project_id to videos if this DB predates projects.
const videoCols = db.prepare("PRAGMA table_info(videos)").all().map((c) => c.name);
if (!videoCols.includes('project_id')) {
  db.exec('ALTER TABLE videos ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL');
}
if (!videoCols.includes('local_path')) {
  // Path-based video reference (browser-selected local file). No file is copied
  // to the server; this stores the display name/path the user picked so it can
  // be re-selected / re-linked later for playback.
  db.exec('ALTER TABLE videos ADD COLUMN local_path TEXT');
}

const annotationCols = db.prepare("PRAGMA table_info(annotations)").all().map((c) => c.name);
const annotationMigrations = {
  interval_id: 'ALTER TABLE annotations ADD COLUMN interval_id TEXT REFERENCES intervals(id) ON DELETE CASCADE',
  camera_id: 'ALTER TABLE annotations ADD COLUMN camera_id TEXT REFERENCES cameras(id) ON DELETE SET NULL',
  session_id: 'ALTER TABLE annotations ADD COLUMN session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL',
  direction: 'ALTER TABLE annotations ADD COLUMN direction TEXT',
  label: 'ALTER TABLE annotations ADD COLUMN label TEXT'
};
for (const [col, sql] of Object.entries(annotationMigrations)) {
  if (!annotationCols.includes(col)) db.exec(sql);
}

const projectCols = db.prepare("PRAGMA table_info(projects)").all().map((c) => c.name);
const projectMigrations = {
  recording_date: 'ALTER TABLE projects ADD COLUMN recording_date TEXT',
  street_name: 'ALTER TABLE projects ADD COLUMN street_name TEXT',
  guid: 'ALTER TABLE projects ADD COLUMN guid TEXT',
  site_description: 'ALTER TABLE projects ADD COLUMN site_description TEXT'
};
for (const [col, sql] of Object.entries(projectMigrations)) {
  if (!projectCols.includes(col)) db.exec(sql);
}

const cameraCols = db.prepare("PRAGMA table_info(cameras)").all().map((c) => c.name);
if (!cameraCols.includes('video_id')) {
  db.exec('ALTER TABLE cameras ADD COLUMN video_id TEXT REFERENCES videos(id) ON DELETE SET NULL');
}

module.exports = db;
