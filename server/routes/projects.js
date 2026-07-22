const express = require('express');
const archiver = require('archiver');
const { v4: uuid } = require('uuid');
const db = require('../db');

const router = express.Router();

function projectStats(projectId) {
  const entries = db
    .prepare(
      `SELECT COUNT(*) AS n FROM annotations a
       JOIN videos v ON v.id = a.video_id
       WHERE v.project_id = ?`
    )
    .get(projectId).n;
  const intervals = db.prepare('SELECT COUNT(*) AS n FROM intervals WHERE project_id = ?').get(projectId).n;
  const cameras = db
    .prepare(
      `SELECT COUNT(*) AS n FROM cameras c JOIN intervals i ON i.id = c.interval_id WHERE i.project_id = ?`
    )
    .get(projectId).n;
  return { entries, audit: 0, intervals, cameras };
}

function withStats(project) {
  return { ...project, ...projectStats(project.id) };
}

// GET /api/projects - list all, newest updated first
router.get('/', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
  res.json(projects.map(withStats));
});

// POST /api/projects - create a new project
router.post('/', (req, res) => {
  const { name, description, bin_duration } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Project name is required' });
  const binDuration = Number(bin_duration);
  if (!Number.isFinite(binDuration) || binDuration <= 0) {
    return res.status(400).json({ error: 'Bin duration must be a positive number of minutes' });
  }

  const id = uuid();
  db.prepare('INSERT INTO projects (id, name, description, bin_duration) VALUES (?, ?, ?, ?)').run(
    id,
    name.trim(),
    description || null,
    binDuration
  );
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json(withStats(project));
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(withStats(project));
});

// PATCH /api/projects/:id - edit title / description / bin duration / metadata
router.patch('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const name = req.body?.name !== undefined ? req.body.name.trim() : project.name;
  if (!name) return res.status(400).json({ error: 'Project name is required' });
  const description = req.body?.description !== undefined ? req.body.description : project.description;
  const binDuration = req.body?.bin_duration !== undefined ? Number(req.body.bin_duration) : project.bin_duration;
  if (!Number.isFinite(binDuration) || binDuration <= 0) {
    return res.status(400).json({ error: 'Bin duration must be a positive number of minutes' });
  }
  const recordingDate = req.body?.recording_date !== undefined ? req.body.recording_date : project.recording_date;
  const streetName = req.body?.street_name !== undefined ? req.body.street_name : project.street_name;
  const guid = req.body?.guid !== undefined ? req.body.guid : project.guid;
  const siteDescription = req.body?.site_description !== undefined ? req.body.site_description : project.site_description;

  db.prepare(
    `UPDATE projects SET name = ?, description = ?, bin_duration = ?, recording_date = ?, street_name = ?, guid = ?, site_description = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(name, description, binDuration, recordingDate, streetName, guid, siteDescription, req.params.id);
  res.json(withStats(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)));
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/projects/bulk-delete - { ids: [] }
router.post('/bulk-delete', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: 'No projects selected' });
  const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
  const tx = db.transaction ? db.transaction((list) => list.forEach((id) => stmt.run(id))) : null;
  if (tx) {
    tx(ids);
  } else {
    ids.forEach((id) => stmt.run(id));
  }
  res.json({ ok: true, deleted: ids.length });
});

function projectPayload(project) {
  const stats = projectStats(project.id);
  const intervals = db.prepare('SELECT * FROM intervals WHERE project_id = ? ORDER BY sort_order ASC').all(project.id).map((iv) => ({
    ...iv,
    cameras: db.prepare('SELECT * FROM cameras WHERE interval_id = ? ORDER BY sort_order ASC').all(iv.id)
  }));
  const videos = db.prepare('SELECT id, name, local_path, duration, created_at FROM videos WHERE project_id = ?').all(project.id);
  const annotations = db
    .prepare(
      `SELECT a.* FROM annotations a JOIN videos v ON v.id = a.video_id WHERE v.project_id = ?`
    )
    .all(project.id)
    .map((a) => ({ ...a, fields: JSON.parse(a.fields_json || '{}') }));
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    bin_duration: project.bin_duration,
    recording_date: project.recording_date,
    street_name: project.street_name,
    guid: project.guid,
    site_description: project.site_description,
    created_at: project.created_at,
    updated_at: project.updated_at,
    stats,
    intervals,
    videos,
    annotations
  };
}

function toCsv(payload) {
  const header = 'video_id,video_name,timestamp,frame,x,y,fields_json,created_at';
  const rows = payload.annotations.map((a) =>
    [a.video_id, JSON.stringify(payload.videos.find((v) => v.id === a.video_id)?.name || ''), a.timestamp, a.frame, a.x, a.y, JSON.stringify(a.fields), a.created_at]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header, ...rows].join('\n');
}

function toTxt(payload) {
  const lines = [`Project: ${payload.name}`, `Description: ${payload.description || '-'}`, `Bin duration: ${payload.bin_duration} min`, ''];
  payload.annotations.forEach((a) => {
    lines.push(`[${a.timestamp}s] video=${a.video_id} frame=${a.frame} x=${a.x} y=${a.y} fields=${JSON.stringify(a.fields)}`);
  });
  return lines.join('\n');
}

function renderExport(payload, format) {
  if (format === 'csv') return { body: toCsv(payload), ext: 'csv', mime: 'text/csv' };
  if (format === 'txt') return { body: toTxt(payload), ext: 'txt', mime: 'text/plain' };
  return { body: JSON.stringify(payload, null, 2), ext: 'json', mime: 'application/json' };
}

// GET /api/projects/:id/export?format=json|csv|txt - single project download
router.get('/:id/export', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const format = ['json', 'csv', 'txt'].includes(req.query.format) ? req.query.format : 'json';
  const { body, ext, mime } = renderExport(projectPayload(project), format);
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-z0-9-_]+/gi, '_')}.${ext}"`);
  res.send(body);
});

// POST /api/projects/export - { ids: [], format } -> zip of selected projects
router.post('/export', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const format = ['json', 'csv', 'txt'].includes(req.body?.format) ? req.body.format : 'json';
  if (!ids.length) return res.status(400).json({ error: 'No projects selected' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="projects_${format}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => res.status(500).end(String(err)));
  archive.pipe(res);

  ids.forEach((id) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) return;
    const { body, ext } = renderExport(projectPayload(project), format);
    archive.append(body, { name: `${project.name.replace(/[^a-z0-9-_]+/gi, '_')}.${ext}` });
  });

  archive.finalize();
});

// POST /api/projects/import - recreate a project from a previously exported JSON payload.
// Only the JSON export format carries enough structure (intervals/cameras/annotations) to
// rebuild a project; CSV/TXT exports are read-only summaries.
router.post('/import', (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object' || !payload.name) {
    return res.status(400).json({ error: 'This does not look like a project export JSON file (missing "name").' });
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO projects (id, name, description, bin_duration, recording_date, street_name, guid, site_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    `${payload.name} (Imported)`,
    payload.description || null,
    payload.bin_duration || 5,
    payload.recording_date || null,
    payload.street_name || null,
    payload.guid || null,
    payload.site_description || null
  );

  const videoIdMap = new Map();
  (payload.videos || []).forEach((v) => {
    const newVideoId = uuid();
    videoIdMap.set(v.id, newVideoId);
    db.prepare('INSERT INTO videos (id, name, filename, project_id, local_path) VALUES (?, ?, ?, ?, ?)').run(
      newVideoId,
      v.name || 'Imported video',
      '',
      id,
      v.local_path || null
    );
  });

  const cameraIdMap = new Map();
  (payload.intervals || []).forEach((iv, ivIndex) => {
    const newIntervalId = uuid();
    db.prepare('INSERT INTO intervals (id, project_id, label, wall_start, sort_order) VALUES (?, ?, ?, ?, ?)').run(
      newIntervalId,
      id,
      iv.label || `Interval ${ivIndex + 1}`,
      iv.wall_start || null,
      ivIndex
    );
    (iv.cameras || []).forEach((cam, camIndex) => {
      const newCameraId = uuid();
      cameraIdMap.set(cam.id, newCameraId);
      db.prepare(
        'INSERT INTO cameras (id, interval_id, name, label, source_type, local_path, url, sort_order, video_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        newCameraId,
        newIntervalId,
        cam.name || `Camera ${camIndex + 1}`,
        cam.label || cam.name || `Camera ${camIndex + 1}`,
        cam.source_type || 'local',
        cam.local_path || null,
        cam.url || null,
        camIndex,
        videoIdMap.get(cam.video_id) || null
      );
    });
  });

  (payload.annotations || []).forEach((a) => {
    const mappedVideoId = videoIdMap.get(a.video_id);
    if (!mappedVideoId) return; // skip orphaned entries we can't relink
    db.prepare(
      `INSERT INTO annotations (id, video_id, config_id, timestamp, frame, x, y, fields_json, direction, label)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuid(),
      mappedVideoId,
      a.config_id || null,
      a.timestamp,
      a.frame ?? null,
      a.x ?? null,
      a.y ?? null,
      JSON.stringify(a.fields || {}),
      a.direction || null,
      a.label || null
    );
  });

  res.status(201).json(withStats(db.prepare('SELECT * FROM projects WHERE id = ?').get(id)));
});

module.exports = router;
