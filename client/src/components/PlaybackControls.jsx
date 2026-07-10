export default function PlaybackControls({ onBack, onExportClick, onPreviewClick, onRestart, hidden, onToggleHidden }) {
  return (
    <div className="bottom-bar glass">
      <div className="bottom-bar-group">
        {!hidden && (
          <button className="btn btn-sm" onClick={onBack}>
            ← Back to Setup
          </button>
        )}
      </div>
      <div className="bottom-bar-group">
        <button className="btn btn-sm" onClick={onToggleHidden}>
          {hidden ? '👁 Show Buttons' : '👁 Hide Buttons'}
        </button>
        {!hidden && (
          <>
            <button className="btn btn-sm" onClick={onPreviewClick}>
              Preview Export
            </button>
            <button className="btn btn-primary btn-sm" onClick={onExportClick}>
              Export Data
            </button>
            <button className="btn btn-sm btn-danger" onClick={onRestart}>
              Restart from 0
            </button>
          </>
        )}
      </div>
    </div>
  );
}
