import { useState } from 'react';

export default function VideoLinkLoader({ onLoad, loading }) {
  const [url, setUrl] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (url.trim() && !loading) await onLoad(url.trim());
  };
  return (
    <form className="video-link-loader" onSubmit={submit}>
      <label className="field-label" htmlFor="video-url">Or load from a video/share link</label>
      <div className="video-link-row">
        <input id="video-url" className="field-input" type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="btn btn-sm" type="submit" disabled={!url.trim() || loading}>{loading ? 'Loading…' : 'Load link'}</button>
      </div>
      <p className="link-help">SharePoint links must allow the server to download the file.</p>
    </form>
  );
}
