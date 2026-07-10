import { formatTimestamp } from '../utils/csv';

export default function AnnotationList({ annotations, activeId, onSelect, onDelete }) {
  return (
    <div className="sidebar-panel glass grow">
      <div className="sidebar-title">Entries <span className="count-badge">{annotations.length}</span></div>
      {annotations.length === 0 ? <div className="empty-list-hint">No entries yet.</div> : (
        <ul className="entries-list">
          {annotations.slice().reverse().map((annotation, index) => {
            const isIncomplete = annotation.id === activeId;
            return (
              <li key={annotation.id} className={`entry-row${isIncomplete ? ' incomplete' : ''}${onSelect ? ' entry-row-button' : ''}`} onClick={() => onSelect?.(annotation)}>
                <span className="entry-time mono">#{annotations.length - index} · {formatTimestamp(annotation.timestamp)}</span>
                <div className="entry-fields">
                  {Object.entries(annotation.fields || {}).map(([key, value]) => <span className="entry-field-chip" key={key}>{key}: {value}</span>)}
                  {isIncomplete && <span className="entry-field-chip">in progress</span>}
                </div>
                {onDelete && <button className="entry-delete" type="button" onClick={(event) => { event.stopPropagation(); onDelete(annotation); }} aria-label={`Delete entry ${annotations.length - index}`}>Delete</button>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
