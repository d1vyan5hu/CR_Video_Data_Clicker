const GROUPS = [
  {
    title: 'Playback',
    rows: [
      ['Space', 'Play / pause'],
      ['← / →', 'Slower / faster'],
      ['↑', 'Reset speed to 1x'],
      ['↓', 'Pause + reset speed']
    ]
  },
  {
    title: 'Annotation Modal',
    rows: [
      ['1–9, 0', 'Pick a choice'],
      ['Backspace', 'Previous step'],
      ['Enter', 'Submit text step']
    ]
  }
];

export default function ShortcutsPanel({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-question">Keyboard Shortcuts</h3>
        {GROUPS.map((g) => (
          <div key={g.title} style={{ marginBottom: 14 }}>
            <div className="section-label">{g.title}</div>
            {g.rows.map(([key, desc]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                <span className="mono" style={{ color: 'var(--timecode)' }}>
                  {key}
                </span>
                <span style={{ color: 'var(--text-dim)' }}>{desc}</span>
              </div>
            ))}
          </div>
        ))}
        <button className="btn btn-block" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
