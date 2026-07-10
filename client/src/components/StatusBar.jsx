export default function StatusBar({ videoName, configName, onShowShortcuts }) {
  return (
    <div className="sidebar-panel glass">
      <div className="sidebar-title">Session</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
        <div>
          Video: <span style={{ color: 'var(--text)' }}>{videoName || '—'}</span>
        </div>
        <div>
          Schema: <span style={{ color: 'var(--text)' }}>{configName || '—'}</span>
        </div>
      </div>
      <button className="btn btn-sm btn-block" style={{ marginTop: 10 }} onClick={onShowShortcuts}>
        ⌨️ Shortcuts
      </button>
    </div>
  );
}
