import { useCallback, useRef } from 'react';

export default function Timeline({ currentTime, duration, annotations, onSeek }) {
  const trackRef = useRef(null);
  const pct = duration ? (currentTime / duration) * 100 : 0;

  const handleClick = useCallback(
    (e) => {
      if (!duration) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(ratio * duration);
    },
    [duration, onSeek]
  );

  return (
    <div className="timeline-strip">
      <div className="timeline-track" ref={trackRef} onClick={handleClick}>
        <div className="timeline-progress" style={{ width: `${pct}%` }} />
        {duration > 0 &&
          annotations.map((a) => <div key={a.id} className="timeline-tick" style={{ left: `${(a.timestamp / duration) * 100}%` }} />)}
      </div>
    </div>
  );
}
