import { buildPreviewRows, formatTimestamp } from '../utils/csv';
import { exportUrl } from '../api/client';

function buildFieldStats(annotations) {
  const stats = {};
  annotations.forEach((a) => {
    Object.entries(a.fields || {}).forEach(([k, v]) => {
      stats[k] = stats[k] || {};
      stats[k][v] = (stats[k][v] || 0) + 1;
    });
  });
  return stats;
}

export default function ExportPanel({ mode, videoId, annotations, onClose, onExported }) {
  if (!mode) return null;

  if (mode === 'preview') {
    const { fieldIds, rows } = buildPreviewRows(annotations, 10);
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card glass" style={{ width: 640 }} onClick={(e) => e.stopPropagation()}>
          <h3 className="modal-question">Preview Export</h3>
          <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table className="export-preview-table">
              <thead>
                <tr>
                  <th>time</th>
                  <th>x</th>
                  <th>y</th>
                  {fieldIds.map((f) => (
                    <th key={f}>{f}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{formatTimestamp(r.timestamp)}</td>
                    <td>{r.x?.toFixed?.(3)}</td>
                    <td>{r.y?.toFixed?.(3)}</td>
                    {fieldIds.map((f) => (
                      <td key={f}>{r[f]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-actions">
            <button className="btn btn-sm" onClick={onClose}>
              Close
            </button>
            <a className="btn btn-primary btn-sm" href={exportUrl(videoId, 'csv')} onClick={onExported} download>
              Export CSV
            </a>
          </div>
        </div>
      </div>
    );
  }

  // mode === 'stats'
  const fieldStats = buildFieldStats(annotations);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-question">Export Statistics</h3>
        <div className="stat-grid">
          <div className="stat-card glass">
            <div className="stat-value">{annotations.length}</div>
            <div className="stat-label">Total Entries</div>
          </div>
          <div className="stat-card glass">
            <div className="stat-value">{Object.keys(fieldStats).length}</div>
            <div className="stat-label">Fields Captured</div>
          </div>
        </div>

        {Object.entries(fieldStats).map(([field, counts]) => (
          <div key={field} style={{ marginTop: 14 }}>
            <div className="section-label">{field}</div>
            <div className="schema-strip">
              {Object.entries(counts).map(([val, n]) => (
                <span className="schema-chip" key={val}>
                  {val}: {n}
                </span>
              ))}
            </div>
          </div>
        ))}

        <div className="modal-actions">
          <button className="btn btn-sm" onClick={onClose}>
            Close
          </button>
          <a className="btn btn-primary btn-sm" href={exportUrl(videoId, 'json')} download>
            Export as JSON
          </a>
        </div>
      </div>
    </div>
  );
}
