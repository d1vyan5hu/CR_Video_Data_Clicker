import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import UploadCard from '../components/UploadCard';
import VideoLinkLoader from '../components/VideoLinkLoader';
import FeatureLoader from '../components/FeatureLoader';
import { useConfig } from '../hooks/useConfig';
import api, { videoStreamUrl } from '../api/client';

function describeCondition(condition) {
  if (!condition) return null;
  const op = condition.operator || '==';
  const rhs = condition.value ?? (condition.values || []).join(' | ');
  return `if ${condition.step_id} ${op} ${rhs}`;
}

// One camera slot inside an interval. Reuses the exact same UploadCard /
// VideoLinkLoader components as the original single-video setup screen —
// the only difference is what happens on load: local files are read into a
// Blob URL for in-browser playback and never leave the browser (only the
// file name is written to SQLite as `local_path`); URLs are stored as-is
// and streamed directly by the <video> tag, no server-side download.
function CameraSlot({ interval, camera, index, onChange, onRemove, onSelectPreview, isPreview }) {
  const blobRef = useRef(null);

  const handleLocalFile = (file) => {
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    const blobUrl = URL.createObjectURL(file);
    blobRef.current = blobUrl;
    onChange(camera.id, { source_type: 'local', local_path: file.name }, blobUrl);
  };

  const handleLink = async (url) => {
    onChange(camera.id, { source_type: 'url', url });
  };

  return (
    <div className="camera-slot">
      <div className="camera-slot-header">
        <input
          className="camera-slot-name"
          value={camera.label}
          onChange={(e) => onChange(camera.id, { label: e.target.value, name: e.target.value })}
        />
        <div className="camera-slot-header-actions">
          <button type="button" className="btn btn-sm" onClick={() => onSelectPreview(camera)}>
            {isPreview ? '● Previewing' : '▷ Preview'}
          </button>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => onRemove(camera.id)}>
            Remove
          </button>
        </div>
      </div>

      <UploadCard
        icon="🎬"
        title={camera.source_type === 'local' && camera.local_path ? camera.local_path : 'Local Video'}
        subtitle={camera.source_type === 'local' && camera.local_path ? 'Loaded — click to replace (not uploaded, played from your browser)' : 'MP4, WebM, MOV, MKV, AVI — read locally, never uploaded'}
        accept="video/*"
        loaded={camera.source_type === 'local' && !!camera.local_path}
        onFile={handleLocalFile}
      />
      <VideoLinkLoader onLoad={handleLink} loading={false} />
      {camera.source_type === 'url' && camera.url && <p className="camera-video-name">Linked: {camera.url}</p>}

      <label className="field-row" style={{ marginTop: 10 }}>
        <span className="field-label">Wall start (footage time at interval start)</span>
        <input
          className="field-input mono"
          placeholder="e.g. 10:00:00"
          value={interval.wall_start || ''}
          onChange={(e) => onChange(camera.id, { __interval_wall_start: e.target.value })}
        />
      </label>
    </div>
  );
}

export default function ProjectSetupScreen({ project, onProjectUpdated, onStartAnnotating }) {
  const { config, configName, error: configError, loading: configLoading, loadFromFile } = useConfig();
  const [values, setValues] = useState({});
  const [videoStartTime, setVideoStartTime] = useState('');
  const [mode, setMode] = useState('entry');
  const [intervals, setIntervals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewCamera, setPreviewCamera] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const blobUrls = useRef(new Map());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/projects/${project.id}/intervals`);
      setIntervals(data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addInterval = async () => {
    const { data } = await api.post(`/projects/${project.id}/intervals`, {});
    setIntervals((prev) => [...prev, data]);
  };

  const removeInterval = async (intervalId) => {
    await api.delete(`/intervals/${intervalId}`);
    setIntervals((prev) => prev.filter((iv) => iv.id !== intervalId));
  };

  const addCamera = async (intervalId) => {
    const interval = intervals.find((iv) => iv.id === intervalId);
    const n = (interval?.cameras.length || 0) + 1;
    const { data } = await api.post(`/intervals/${intervalId}/cameras`, {
      name: `Camera ${n}`,
      label: `Camera ${n}`,
      source_type: 'local'
    });
    setIntervals((prev) => prev.map((iv) => (iv.id === intervalId ? { ...iv, cameras: [...iv.cameras, data] } : iv)));
  };

  const removeCamera = async (intervalId, cameraId) => {
    await api.delete(`/cameras/${cameraId}`);
    setIntervals((prev) =>
      prev.map((iv) => (iv.id === intervalId ? { ...iv, cameras: iv.cameras.filter((c) => c.id !== cameraId) } : iv))
    );
  };

  const updateCamera = async (intervalId, cameraId, patch, blobUrl) => {
    if (blobUrl) blobUrls.current.set(cameraId, blobUrl);

    if (patch.__interval_wall_start !== undefined) {
      const wallStart = patch.__interval_wall_start;
      await api.patch(`/intervals/${intervalId}`, { wall_start: wallStart });
      setIntervals((prev) => prev.map((iv) => (iv.id === intervalId ? { ...iv, wall_start: wallStart } : iv)));
      return;
    }

    const { data } = await api.patch(`/cameras/${cameraId}`, patch);
    setIntervals((prev) =>
      prev.map((iv) =>
        iv.id === intervalId ? { ...iv, cameras: iv.cameras.map((c) => (c.id === cameraId ? data : c)) } : iv
      )
    );
    if (previewCamera?.id === cameraId) {
      setPreviewCamera(data);
      setPreviewUrl(data.source_type === 'local' ? blobUrls.current.get(cameraId) : data.url);
    }
  };

  const handleSelectPreview = (camera) => {
    setPreviewCamera(camera);
    setPreviewUrl(camera.source_type === 'local' ? blobUrls.current.get(camera.id) : camera.url);
  };

  const hasAnyCamera = intervals.some((iv) => iv.cameras.length > 0);
  const canStart = hasAnyCamera && !!config;
  const schemaChips = useMemo(() => (config ? config.steps.map((s) => s.step_id) : []), [config]);

  const handleStart = () => {
    const firstInterval = intervals.find((iv) => iv.cameras.length > 0);
    const firstCamera = firstInterval?.cameras[0];
    onStartAnnotating({
      interval: firstInterval,
      camera: firstCamera,
      intervals,
      config,
      configName,
      values,
      videoStartTime,
      mode,
      blobUrls: blobUrls.current
    });
  };

  return (
    <div className="app-shell">
      <Header />
      <div className="setup-screen">
        <div className="setup-form-pane">
          <h1 className="setup-title">New Annotation Session</h1>
          <p className="setup-subtitle">Load your interval cameras and a JSON schema — every field below is generated from that schema.</p>

          <div className="section-label">Mode</div>
          <div className="mode-toggle">
            <label className={`mode-option${mode === 'entry' ? ' active' : ''}`}>
              <input type="radio" name="mode" checked={mode === 'entry'} onChange={() => setMode('entry')} /> Entry Mode
            </label>
            <label className={`mode-option${mode === 'audit' ? ' active' : ''}`}>
              <input type="radio" name="mode" checked={mode === 'audit'} onChange={() => setMode('audit')} /> Audit Mode
            </label>
          </div>

          <div className="section-label">Recording Intervals</div>
          {error && <div className="error-banner">{error}</div>}
          {loading && <p className="ps-loading">Loading…</p>}

          {!loading &&
            intervals.map((interval, idx) => (
              <div key={interval.id} className="interval-card">
                <div className="interval-card-header">
                  <span className="interval-badge">Interval {idx + 1}</span>
                  {intervals.length > 1 && (
                    <button className="icon-btn icon-btn-danger" onClick={() => removeInterval(interval.id)} title="Remove interval">
                      ✕
                    </button>
                  )}
                </div>
                {interval.cameras.map((camera, camIdx) => (
                  <CameraSlot
                    key={camera.id}
                    interval={interval}
                    camera={camera}
                    index={camIdx}
                    onChange={(camId, patch, blobUrl) => updateCamera(interval.id, camId, patch, blobUrl)}
                    onRemove={(camId) => removeCamera(interval.id, camId)}
                    onSelectPreview={handleSelectPreview}
                    isPreview={previewCamera?.id === camera.id}
                  />
                ))}
                <button className="btn btn-sm" onClick={() => addCamera(interval.id)}>
                  + Add Camera
                </button>
              </div>
            ))}

          <button className="btn btn-block" onClick={addInterval}>
            + Add Interval
          </button>

          <div className="section-label" style={{ marginTop: 24 }}>
            Configuration (JSON)
          </div>
          <UploadCard
            icon="🧬"
            title={configName || 'Load Config File (JSON)'}
            subtitle={configLoading ? 'Loading…' : config ? `${config.steps.length} step(s) defined` : 'Defines fields, choices, and conditions'}
            accept="application/json"
            loaded={!!config}
            onFile={loadFromFile}
          />
          {configError && <div className="error-banner" style={{ marginTop: 10 }}>{configError}</div>}
          {config && (
            <div className="schema-strip">
              {schemaChips.map((id) => (
                <span className="schema-chip" key={id}>
                  {id}
                </span>
              ))}
            </div>
          )}

          <FeatureLoader
            setupFields={config?.setupFields}
            values={values}
            onChange={(id, val) => setValues((v) => ({ ...v, [id]: val }))}
          />

          <div className="field-row" style={{ marginTop: config?.setupFields ? 0 : 24 }}>
            <label className="field-label">Video Start Time (real-world clock time at 00:00 in the file)</label>
            <input
              className="field-input mono"
              placeholder="e.g. 7:00:00 AM or 07:00:00"
              value={videoStartTime}
              onChange={(e) => setVideoStartTime(e.target.value)}
            />
          </div>

          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 20, padding: '13px 16px' }}
            disabled={!canStart}
            onClick={handleStart}
          >
            {mode === 'audit' ? 'Start Auditing' : 'Start Annotating'}
          </button>
        </div>

        <div className="setup-preview-pane">
          <div className="section-label">Preview</div>
          <div className="preview-frame">
            {previewUrl ? (
              <video src={previewUrl} muted loop autoPlay />
            ) : (
              <div className="empty-hint">
                <span style={{ fontSize: 28 }}>🎞️</span>
                Load a local video (or click Preview on a camera) to see it here
              </div>
            )}
          </div>

          {config && (
            <>
              <div className="section-label">Annotation Flow</div>
              <div className="step-flow-card glass">
                {config.steps.map((step, i) => (
                  <div className="step-flow-item" key={step.step_id}>
                    <span className="step-flow-index mono">{i + 1}</span>
                    <div>
                      <div>{step.question}</div>
                      {step.condition && <div className="step-flow-cond">{describeCondition(step.condition)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
