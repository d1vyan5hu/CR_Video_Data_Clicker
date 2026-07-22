const express = require('express');
const cors = require('cors');

const videosRouter = require('./routes/videos');
const configsRouter = require('./routes/configs');
const annotationsRouter = require('./routes/annotations');
const exportRouter = require('./routes/export');
const projectsRouter = require('./routes/projects');
const { projectIntervalsRouter, standaloneRouter } = require('./routes/intervals');
const sessionsRouter = require('./routes/sessions');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Video player route — a dedicated iframe-friendly endpoint (see routes/videos.js
// for the underlying range-request stream). Kept separate from /api so the
// frontend's iframe can point at a clean, cacheable path.
app.get('/player/:id', (req, res) => {
  res.redirect(`/api/videos/${req.params.id}/stream`);
});

app.use('/api/projects/:projectId/intervals', projectIntervalsRouter);
app.use('/api', standaloneRouter);
app.use('/api', sessionsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/videos', videosRouter);
app.use('/api/configs', configsRouter);
app.use('/api/annotations', annotationsRouter);
app.use('/api/export', exportRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Video Annotator API running on http://localhost:${PORT}`);
});
