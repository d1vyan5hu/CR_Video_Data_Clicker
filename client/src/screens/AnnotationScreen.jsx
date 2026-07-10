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

let dotCounter = 0;

export default function AnnotationScreen({ session, onBack }) {
  const { video, config, configName, videoStartTime, mode } = session;
  const player = useVideoPlayer();
  const { annotations, activeId, setActiveId, addAnnotation, patchAnnotation, removeAnnotation, finalizeActive } = useAnnotations(video.id);

  const [started, setStarted] = useState(mode === 'audit');
  const [directions, setDirections] = useState(null);
  const [dots, setDots] = useState([]);
  const [hidden, setHidden] = useState(false);
  const [exportMode, setExportMode] = useState(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [auditAdding, setAuditAdding] = useState(false);
  const [auditDraftId, setAuditDraftId] = useState(null);
  const dotTimers = useRef([]);

  const videoStartSeconds = parseClockTime(videoStartTime);
  const activeAnnotation = annotations.find((a) => a.id === activeId);

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
      const row = await addAnnotation({ timestamp: player.currentTime, frame: player.effectiveFps ? Math.round(player.currentTime * player.effectiveFps) : undefined, x, y });
      if (mode === 'audit') {
        setAuditAdding(false);
        setAuditDraftId(row.id);
      }
      pushDot(x, y, 'new');
    },
    [mode, auditAdding, player, addAnnotation, pushDot]
  );

  const handleModalFinish = useCallback(() => {
    setAuditDraftId(null);
    finalizeActive();
    player.play();
  }, [finalizeActive, player]);

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

  // Global playback shortcuts (Space, arrows, minus)
  useEffect(() => {
    const handler = (e) => {
      const active = document.activeElement;
      const inputFocused = active && active.tagName === 'INPUT';
      const hasContent = inputFocused && active.value?.length > 0;

      if (e.code === 'Space') {
        if (inputFocused) return;
        e.preventDefault();
        if (!started) return handleStart();
        if (activeId) return; // modal open — don't toggle playback
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

  return (
    <div className="app-shell">
      <Header>
        <span>{video.name}</span>
        <span>·</span>
        <span>{configName}</span>
      </Header>
      <div className="annotation-screen">
        <div className="stage">
          <VideoPlayer
            videoId={video.id}
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
