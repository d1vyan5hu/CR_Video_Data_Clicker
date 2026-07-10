import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import UploadCard from '../components/UploadCard';
import VideoLinkLoader from '../components/VideoLinkLoader';
import StoredVideoSelector from '../components/StoredVideoSelector';
import FeatureLoader from '../components/FeatureLoader';
import { useConfig } from '../hooks/useConfig';
import { uploadVideo, importVideoFromUrl, listVideos, videoStreamUrl } from '../api/client';

function describeCondition(condition) {
  if (!condition) return null;
  const op = condition.operator || '==';
  const rhs = condition.value ?? (condition.values || []).join(' | ');
  return `if ${condition.step_id} ${op} ${rhs}`;
}

export default function SetupScreen({ onStart }) {
  const { config, configName, error: configError, loading: configLoading, loadFromFile } = useConfig();
  const [video, setVideo] = useState(null); // { id, name, filename }
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [values, setValues] = useState({});
  const [videoStartTime, setVideoStartTime] = useState('');
  const [mode, setMode] = useState('entry');
  const [storedVideos, setStoredVideos] = useState([]);
  const [storedLoading, setStoredLoading] = useState(false);
  const [storedError, setStoredError] = useState(null);
  const previewRef = useRef(null);

  const handleVideoFile = async (file) => {
    setVideoUploading(true);
    setVideoError(null);
    try {
      const uploaded = await uploadVideo(file, file.name);
      setVideo(uploaded);
    } catch (e) {
      setVideoError(e.response?.data?.error || e.message);
    } finally {
      setVideoUploading(false);
    }
  };

  const handleVideoLink = async (url) => {
    setVideoUploading(true);
    setVideoError(null);
    try {
      setVideo(await importVideoFromUrl(url));
    } catch (e) {
      setVideoError(e.response?.data?.error || 'The link could not be downloaded as a playable video.');
    } finally {
      setVideoUploading(false);
    }
  };

  const loadStoredVideos = useCallback(async () => {
    setStoredLoading(true);
    setStoredError(null);
    try {
      setStoredVideos(await listVideos());
    } catch (error) {
      setStoredError(error.response?.data?.error || 'Could not load saved videos.');
    } finally {
      setStoredLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'audit') loadStoredVideos();
  }, [mode, loadStoredVideos]);

  const canStart = !!video && !!config;

  const schemaChips = useMemo(() => (config ? config.steps.map((s) => s.step_id) : []), [config]);

  const handlePreviewLoaded = () => {
    if (previewRef.current) {
      previewRef.current.currentTime = 0;
      previewRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="app-shell">
      <Header />
      <div className="setup-screen">
        <div className="setup-form-pane">
          <h1 className="setup-title">New Annotation Session</h1>
          <p className="setup-subtitle">Load a video and a JSON schema — every field below is generated from that schema.</p>

          <div className="section-label">Mode</div>
          <div className="mode-toggle">
            <label className={`mode-option${mode === 'entry' ? ' active' : ''}`}>
              <input type="radio" name="mode" checked={mode === 'entry'} onChange={() => setMode('entry')} /> Entry Mode
            </label>
            <label className={`mode-option${mode === 'audit' ? ' active' : ''}`}>
              <input type="radio" name="mode" checked={mode === 'audit'} onChange={() => setMode('audit')} /> Audit Mode
            </label>
          </div>

          {mode === 'audit' && (
            <StoredVideoSelector
              videos={storedVideos}
              value={video?.id || ''}
              loading={storedLoading}
              error={storedError}
              onRefresh={loadStoredVideos}
              onChange={(id) => setVideo(storedVideos.find((item) => item.id === id) || null)}
            />
          )}

          <div className="section-label">Video</div>
          <UploadCard
            icon="🎬"
            title={video ? video.name : 'Local Video'}
            subtitle={videoUploading ? 'Uploading…' : video ? 'Loaded — click to replace' : 'MP4, WebM, MOV, MKV, AVI'}
            accept="video/*"
            loaded={!!video}
            onFile={handleVideoFile}
          />
          <VideoLinkLoader onLoad={handleVideoLink} loading={videoUploading} />
          {videoError && <div className="error-banner" style={{ marginTop: 10 }}>{videoError}</div>}
          {mode === 'audit' && <div className="audit-notice">Choose a saved SQLite video above. On the next screen, click an entry to open and edit it; no new entries are created in Audit Mode.</div>}

          <div className="section-label">Configuration (JSON)</div>
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
            onClick={() => onStart({ video, config, configName, values, videoStartTime, mode })}
          >
            {mode === 'audit' ? 'Start Auditing' : 'Start Annotating'}
          </button>
        </div>

        <div className="setup-preview-pane">
          <div className="section-label">Preview</div>
          <div className="preview-frame">
            {video ? (
              <video ref={previewRef} src={videoStreamUrl(video.id)} muted loop onLoadedData={handlePreviewLoaded} />
            ) : (
              <div className="empty-hint">
                <span style={{ fontSize: 28 }}>🎞️</span>
                Load a video to preview it here
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
