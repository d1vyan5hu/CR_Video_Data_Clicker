export default function StoredVideoSelector({ videos, value, loading, error, onRefresh, onChange }) {
  return (
    <div className="stored-video-selector">
      <div className="section-label">Saved videos</div>
      <div className="stored-video-row">
        <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)} disabled={loading}>
          <option value="">{loading ? 'Loading saved videos...' : 'Select a saved video'}</option>
          {videos.map((video) => <option value={video.id} key={video.id}>{video.name}</option>)}
        </select>
        <button className="btn btn-sm" type="button" onClick={onRefresh} disabled={loading}>Refresh</button>
      </div>
      {videos.length === 0 && !loading && !error && <p className="stored-video-help">No saved videos yet. Upload or import a video in Entry Mode first.</p>}
      {error && <p className="stored-video-error">{error}</p>}
    </div>
  );
}
