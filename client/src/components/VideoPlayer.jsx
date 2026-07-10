import { useCallback, useEffect, useRef } from 'react';
import { videoStreamUrl } from '../api/client';
import { formatTimestamp } from '../utils/csv';

function markerPositions(markers = []) {
  return Object.fromEntries(markers.map((marker, index) => {
    const value = typeof marker === 'string' ? { id: marker, label: marker } : marker;
    const id = value.id || value.label || `marker-${index + 1}`;
    return [id, { x: value.x ?? 50, y: value.y ?? 50, label: value.label || id }];
  }));
}

export default function VideoPlayer({ videoId, player, started, onStart, onStageClick, recentDots, directions, onDirectionsChange, directionMarkers, videoStartSeconds, entriesCount }) {
  const stageRef = useRef(null);
  const positions = directions || markerPositions(directionMarkers);

  const handleStageClick = useCallback((event) => {
    if (!started) return;
    const rect = stageRef.current.getBoundingClientRect();
    onStageClick((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  }, [started, onStageClick]);

  const startDrag = (key) => (event) => {
    event.stopPropagation();
    const rect = stageRef.current.getBoundingClientRect();
    const onMove = (moveEvent) => {
      const x = Math.max(0, Math.min(100, ((moveEvent.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((moveEvent.clientY - rect.top) / rect.height) * 100));
      onDirectionsChange({ ...positions, [key]: { ...positions[key], x, y } });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const actualTime = videoStartSeconds != null ? videoStartSeconds + player.currentTime : null;
  useEffect(() => {
    const video = player.videoRef.current;
    if (!video?.requestVideoFrameCallback || player.fps) return undefined;
    let firstFrame; let firstTime; let cancelled = false;
    const sample = (now, metadata) => {
      if (cancelled) return;
      if (firstFrame == null) { firstFrame = metadata.presentedFrames; firstTime = now; }
      if (now - firstTime >= 1000) {
        const measured = (metadata.presentedFrames - firstFrame) / ((now - firstTime) / 1000);
        if (Number.isFinite(measured) && measured > 0) player.setFps(Math.round(measured * 100) / 100);
        return;
      }
      video.requestVideoFrameCallback(sample);
    };
    video.requestVideoFrameCallback(sample);
    return () => { cancelled = true; };
  }, [player]);

  return (
    <div className="viewfinder" ref={stageRef} onClick={handleStageClick}>
      <span className="bracket-tl" /><span className="bracket-tr" /><span className="bracket-bl" /><span className="bracket-br" />
      <video ref={player.videoRef} src={videoStreamUrl(videoId)} onTimeUpdate={player.onTimeUpdate} onLoadedMetadata={player.onLoadedMetadata} />
      <div className="stage-overlay">
        {started && <>
          {Object.entries(positions).map(([key, pos]) => <div key={key} className="direction-tag" style={{ left: `${pos.x}%`, top: `${pos.y}%` }} onMouseDown={startDrag(key)}>{pos.label || key}</div>)}
          <div className="hud-badge left"><span className="tally-dot" /> Speed: {player.speed.toFixed(2)}x</div>
          <div className="hud-badge right fps-control" onClick={(event) => event.stopPropagation()}>
            <label htmlFor="fps-override">FPS</label>
            <input
              id="fps-override"
              type="number"
              inputMode="decimal"
              min="1"
              max="240"
              step="any"
              placeholder={player.fps ? String(player.fps) : 'Auto'}
              value={player.fpsOverride}
              onChange={(event) => player.setFpsOverride(event.target.value)}
              aria-label="Video frame rate"
              aria-invalid={Boolean(player.fpsError)}
            />
            <span>· Entries: {entriesCount}</span>
          </div>
          {player.fpsError && <div className="fps-error" role="alert">{player.fpsError}</div>}
          <div className="timecode-readout">
            {formatTimestamp(player.currentTime)} / {formatTimestamp(player.duration)}
            {actualTime != null && <> | Actual: {new Date(actualTime * 1000).toISOString().substr(11, 8)}</>}
          </div>
          {recentDots.map((dot) => <div key={dot.id} className={`click-dot ${dot.status}`} style={{ left: `${dot.x * 100}%`, top: `${dot.y * 100}%` }} />)}
        </>}
        {!started && <div className="instructions-card glass">
          <h3>Ready to annotate</h3><p>Drag position markers only if the loaded configuration provides them.</p>
          <p>Press <kbd>SPACE</kbd> to start playback and begin annotating.</p><p>Click anywhere on the video to log an event, then fill in its fields.</p>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={onStart}>Got it - Start</button>
        </div>}
      </div>
    </div>
  );
}
