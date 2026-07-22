import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '../components/Header';
import VideoPlayer from '../components/VideoPlayer';
import Timeline from '../components/Timeline';
import PlaybackControls from '../components/PlaybackControls';
import AnnotationModal from '../components/AnnotationModal';
import AnnotationList from '../components/AnnotationList';
import StatusBar from '../components/StatusBar';
import ExportPanel from '../components/ExportPanel';
import ShortcutsPanel from '../components/ShortcutsPanel';
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { useAnnotations } from '../hooks/useAnnotations';
import { parseClockTime } from '../utils/csv';
import api from '../api/client';

let dotCounter = 0;

// This mirrors the original single-video AnnotationScreen almost exactly —
// same click-to-log → config-driven step modal → keyboard shortcuts flow.
// The only additions are: an interval/camera switcher (since a project can
// have several), and a Sessions panel to start/pause/resume distinct
// counting sessions per interval, each with its own entry count.
export default function ProjectAnnotationScreen({ project, setupContext, onBack, onEditSetup }) {
  const { intervals: initialIntervals, config, configName, videoStartTime, mode } = setupContext;

  const [intervals, setIntervals] = useState(initialIntervals || []);
  const [activeIntervalId, setActiveIntervalId] = useState(setupContext.interval?.id || initialIntervals?.[0]?.id || null);
  const [activeCameraId, setActiveCameraId] = useState(setupContext.camera?.id || null);
  const blobUrls = useRef(setupContext.blobUrls || new Map());

  const activeInterval = intervals.find((iv) => iv.id === activeIntervalId);
  const activeCamera = activeInterval?.cameras.find((c) => c.id === activeCameraId) || activeInterval?.cameras[0];
  const video = activeCamera ? { id: activeCamera.video_id, name: activeCamera.label } : null;
  const videoSrc = activeCamera
    ? activeCamera.source_type === 'local'
      ? blobUrls.current.get(activeCamera.id) || null
      : activeCamera.url
    : null;
  const needsReselect = activeCamera?.source_type === 'local' && !videoSrc;

  const player = useVideoPlayer();
  const { annotations, activeId, setActiveId, addAnnotation, patchAnnotation, removeAnnotation, finalizeActive } = useAnnotations(video?.id);

  const [started, setStarted] = useState(mode === 'audit');
  const [directions, setDirections] = useState(null);
  const [dots, setDots] = useState([]);
  const [hidden, setHidden] = useState(false);
  const [exportMode, setExportMode] = useState(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [auditAdding, setAuditAdding] = useState(false);
  const [auditDraftId, setAuditDraftId] = useState(null);
  const dotTimers = useRef([]);

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);

  const videoStartSeconds = parseClockTime(videoStartTime);
  const activeAnnotation = annotations.find((a) => a.id === activeId);

  const loadSessions = useCallback(async () => {
    if (!activeIntervalId) return;
    const { data } = await api.get(`/intervals/${activeIntervalId}/sessions`);
    setSessions(data);
    setActiveSessionId(null);
  }, [activeIntervalId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const startSession = async () => {
    if (!activeIntervalId || !activeCameraId) return;
    const { data } = await api.post(`/intervals/${activeIntervalId}/sessions`, {
      camera_id: activeCameraId,
      started_at: player.currentTime?.toFixed(2)
    });
    setSessions((prev) => [data, ...prev]);
    setActiveSessionId(data.id);
  };

  const pauseSession = async () => {
    if (!activeSessionId) return;
    const { data } = await api.patch(`/sessions/${activeSessionId}`, {
      status: 'paused',
      paused_at: player.currentTime?.toFixed(2)
    });
    setSessions((prev) => prev.map((s) => (s.id === data.id ? data : s)));
  };

  const resumeSession = async (sessionId) => {
    const { data } = await api.patch(`/sessions/${sessionId}`, { status: 'active' });
    setSessions((prev) => prev.map((s) => (s.id === data.id ? data : s)));
    setActiveSessionId(sessionId);
  };

  const pushDot = useCallback((x, y, status) => {
    const id = ++dotCounter;
    setDots((d) => [...d, { id, x, y, status }]);
    const t = setTimeout(() => setDots((d) => d.filter((dot) => dot.id !== id)), 1750);
    dotTimers.current.push(t);
  }, []);

  useEffect(() => () => dotTimers.current.forEach(clearTimeout), []);

  const handleStart = useCallback(() => {
    setStarted(true);
    player.play();
  }, [player]);

  const handleStageClick = useCallback(
    async (x, y) => {
      if (mode === 'audit' && !auditAdding) return;
      player.pause();
      const row = await addAnnotation({
        timestamp: player.currentTime,
        frame: player.effectiveFps ? Math.round(player.currentTime * player.effectiveFps) : undefined,
        x,
        y,
        interval_id: activeIntervalId,
        camera_id: activeCameraId,
        session_id: activeSessionId
      });
      if (mode === 'audit') {
        setAuditAdding(false);
        setAuditDraftId(row.id);
      }
      pushDot(x, y, 'new');
    },
    [mode, auditAdding, player, addAnnotation, pushDot, activeIntervalId, activeCameraId, activeSessionId]
  );

  const handleModalFinish = useCallback(() => {
    setAuditDraftId(null);
    finalizeActive();
    player.play();
    setSessions((prev) => prev.map((s) => (s.id === activeSessionId ? { ...s, entries: (s.entries || 0) + 1 } : s)));
  }, [finalizeActive, player, activeSessionId]);

  const handleModalCancel = useCallback(async () => {
    if (activeId && (mode !== 'audit' || activeId === auditDraftId)) await removeAnnotation(activeId);
    setAuditDraftId(null);
    finalizeActive();
    player.play();
  }, [activeId, mode, auditDraftId, removeAnnotation, finalizeActive, player]);

  const handleAuditSelect = useCallback((annotation) => {
    player.pause();
    player.seek(annotation.timestamp);
    setActiveId(annotation.id);
  }, [player, setActiveId]);

  const handleAuditDelete = useCallback(async (annotation) => {
    if (!confirm(`Delete the entry at ${annotation.timestamp.toFixed(2)} seconds?`)) return;
    await removeAnnotation(annotation.id);
    if (activeId === annotation.id) finalizeActive();
  }, [activeId, removeAnnotation, finalizeActive]);

  useEffect(() => {
    const handler = (e) => {
      const active = document.activeElement;
      const inputFocused = active && active.tagName === 'INPUT';
      const hasContent = inputFocused && active.value?.length > 0;

      if (e.code === 'Space') {
        if (inputFocused) return;
        e.preventDefault();
        if (!started) return handleStart();
        if (activeId) return;
        player.togglePlay();
        return;
      }
      if (!started) return;
      if (e.key === '-') {
        if (inputFocused) return;
        player.rewind(10);
        return;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (hasContent) return;
        e.preventDefault();
        if (e.key === 'ArrowLeft') player.speedDown();
        if (e.key === 'ArrowRight') player.speedUp();
        if (e.key === 'ArrowUp') player.resetSpeed();
        if (e.key === 'ArrowDown') {
          player.pause();
          player.resetSpeed();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [started, activeId, player, handleStart]);

  const handleRestart = useCallback(async () => {
    if (!confirm('Restart counting from 0? This clears all entries for this video.')) return;
    for (const a of annotations) await removeAnnotation(a.id);
    player.seek(0);
    player.pause();
  }, [annotations, removeAnnotation, player]);

  if (!video) {
    return (
      <div className="app-shell">
        <Header />
        <div className="empty-hint" style={{ padding: 40 }}>No camera selected — go back to Setup and add one.</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header>
        <select value={activeIntervalId || ''} onChange={(e) => { setActiveIntervalId(e.target.value); setActiveCameraId(null); }} className="pa-header-select">
          {intervals.map((iv) => (
            <option key={iv.id} value={iv.id}>{iv.label}</option>
          ))}
        </select>
        <select value={activeCameraId || activeCamera?.id || ''} onChange={(e) => setActiveCameraId(e.target.value)} className="pa-header-select">
          {activeInterval?.cameras.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <span>·</span>
        <span>{configName}</span>
        {!activeSessionId ? (
          <button className="btn btn-sm btn-primary" onClick={startSession}>▶ Start Session</button>
        ) : (
          <button className="btn btn-sm" onClick={pauseSession}>❚❚ Pause Session ({sessions.find((s) => s.id === activeSessionId)?.entries || 0} entries)</button>
        )}
      </Header>

      {needsReselect && (
        <div className="error-banner" style={{ margin: 12 }}>
          This local file needs to be re-selected after a page reload. Expected: {activeCamera.local_path}. Go back to Setup to re-pick it.
        </div>
      )}

      <div className="annotation-screen">
        <div className="stage">
          <VideoPlayer
            videoId={video.id}
            src={videoSrc}
            player={player}
            started={started}
            onStart={handleStart}
            onStageClick={handleStageClick}
            recentDots={dots}
            directions={directions}
            onDirectionsChange={setDirections}
            directionMarkers={config.directionMarkers}
            videoStartSeconds={videoStartSeconds}
            entriesCount={annotations.length}
          />
        </div>

        <Timeline currentTime={player.currentTime} duration={player.duration} annotations={annotations} onSeek={player.seek} />

        <div className="sidebar">
          <StatusBar videoName={video.name} configName={configName} onShowShortcuts={() => setShortcutsOpen(true)} />

          <div className="sessions-panel glass">
            <div className="sessions-panel-header">
              <span>Sessions ({sessions.length})</span>
            </div>
            {sessions.length === 0 && <p className="sessions-empty">No sessions yet for this interval — click Start Session above.</p>}
            <div className="session-list">
              {sessions.map((s) => (
                <div key={s.id} className={`session-card${s.id === activeSessionId ? ' session-card-active' : ''}`}>
                  <p className="session-created">Created {new Date(s.created_at.includes('T') ? s.created_at : `${s.created_at}Z`).toLocaleString()}</p>
                  {s.started_at != null && <p>Start: {s.started_at}s</p>}
                  {s.paused_at != null && <p>Pause: {s.paused_at}s</p>}
                  <p>Entries: {s.entries}</p>
                  {s.id !== activeSessionId && (
                    <button className="btn btn-sm" onClick={() => resumeSession(s.id)}>
                      {s.status === 'paused' ? 'Resume' : 'Select'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {mode === 'audit' && (
            <div className="audit-actions glass">
              <button className={`btn btn-sm${auditAdding ? ' btn-primary' : ''}`} onClick={() => setAuditAdding((value) => !value)}>
                {auditAdding ? 'Click video to add' : 'Add entry'}
              </button>
              <span>{auditAdding ? 'Click the event position in the video.' : 'Select an entry to edit it.'}</span>
            </div>
          )}
          <AnnotationList annotations={annotations} activeId={activeId} onSelect={mode === 'audit' ? handleAuditSelect : undefined} onDelete={mode === 'audit' ? handleAuditDelete : undefined} />
        </div>

        <PlaybackControls
          hidden={hidden}
          onToggleHidden={() => setHidden((h) => !h)}
          onBack={onBack}
          onPreviewClick={() => setExportMode('preview')}
          onExportClick={() => setExportMode('stats')}
          onRestart={handleRestart}
        />
      </div>

      {activeAnnotation && (
        <AnnotationModal
          config={config}
          annotation={activeAnnotation}
          onUpdateFields={(fields) => patchAnnotation(activeAnnotation.id, fields)}
          onFinish={handleModalFinish}
          onCancel={handleModalCancel}
        />
      )}

      {exportMode && (
        <ExportPanel mode={exportMode} videoId={video.id} annotations={annotations} onClose={() => setExportMode(null)} />
      )}

      {shortcutsOpen && <ShortcutsPanel onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
