import { useState, useEffect, useMemo, useCallback } from 'react';
import ProjectModal from '../components/ProjectModal';
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  bulkDeleteProjects,
  projectExportUrl,
  bulkExportProjects,
  default as api
} from '../api/client';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : `${iso}Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const ICONS = {
  audit: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  entry: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  view: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
    </svg>
  )
};

export default function ProjectManagerScreen({ onOpenProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await listProjects());
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
    );
  }, [projects, search]);

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) return new Set();
      return new Set(filtered.map((p) => p.id));
    });
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreate = async (payload) => {
    const project = await createProject(payload);
    setShowCreate(false);
    await refresh();
    onOpenProject(project);
  };

  const handleEdit = async (payload) => {
    await updateProject(editingProject.id, payload);
    setEditingProject(null);
    await refresh();
  };

  const handleDeleteOne = async (project) => {
    if (!window.confirm(`Delete "${project.name}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deleteProject(project.id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} selected project(s)? This can't be undone.`)) return;
    setBusy(true);
    try {
      await bulkDeleteProjects([...selected]);
      setSelected(new Set());
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error('Only JSON exports can be imported (CSV/TXT exports are read-only summaries).');
      }
      await api.post('/projects/import', payload);
      await refresh();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadOne = (project, format) => {
    window.open(projectExportUrl(project.id, format), '_blank');
  };

  const handleDownloadSelected = async (format) => {
    if (!selected.size) return;
    setBusy(true);
    try {
      const blob = await bulkExportProjects([...selected], format);
      downloadBlob(blob, `projects_${format}.zip`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="project-manager">
      <div className="pm-header">
        <h1>
          Project Manager <span className="pm-info-dot" title="All your annotation projects">ⓘ</span>
        </h1>
        <div className="pm-header-actions">
          <label className="btn btn-outline file-btn">
            Import Project
            <input type="file" accept="application/json" hidden onChange={(e) => handleImport(e.target.files?.[0])} />
          </label>
          <button className="btn btn-accent" onClick={() => setShowCreate(true)}>
            + New Project
          </button>
        </div>
      </div>

      <div className="pm-toolbar">
        <div className="pm-bulk-actions">
          <span className="pm-selected-count">{selected.size} selected</span>
          <button className="btn btn-ghost btn-sm" disabled={!selected.size || busy} onClick={() => handleDownloadSelected('json')}>
            {ICONS.download} JSON (ZIP)
          </button>
          <button className="btn btn-ghost btn-sm" disabled={!selected.size || busy} onClick={() => handleDownloadSelected('csv')}>
            {ICONS.download} CSV (ZIP)
          </button>
          <button className="btn btn-ghost btn-sm" disabled={!selected.size || busy} onClick={() => handleDownloadSelected('txt')}>
            {ICONS.download} TXT (ZIP)
          </button>
          <button className="btn btn-ghost btn-sm btn-danger" disabled={!selected.size || busy} onClick={handleDeleteSelected}>
            {ICONS.trash} Delete selected
          </button>
        </div>
        <div className="pm-search">
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <p className="pm-error">{error}</p>}

      <div className="pm-table-wrap">
        <table className="pm-table">
          <thead>
            <tr>
              <th className="col-check">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th className="col-num">#</th>
              <th>Name</th>
              <th>Description</th>
              <th>Entries</th>
              <th>Audit</th>
              <th>Intervals</th>
              <th>Cameras</th>
              <th>Created</th>
              <th>Last updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={11} className="pm-empty">Loading projects…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="pm-empty">
                  {projects.length === 0 ? 'No projects yet — create your first one.' : 'No projects match your search.'}
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((p, i) => (
                <tr key={p.id}>
                  <td className="col-check">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} />
                  </td>
                  <td className="col-num">{i + 1}</td>
                  <td className="pm-name">{p.name}</td>
                  <td className="pm-desc">{p.description || '—'}</td>
                  <td>{p.entries}</td>
                  <td>{p.audit}</td>
                  <td>{p.intervals}</td>
                  <td>{p.cameras}</td>
                  <td>{formatDate(p.created_at)}</td>
                  <td>{formatDate(p.updated_at)}</td>
                  <td className="pm-actions">
                    <button title="Audit mode" className="icon-btn" onClick={() => onOpenProject(p, 'audit')}>
                      {ICONS.audit}
                    </button>
                    <button title="Entry mode" className="icon-btn" onClick={() => onOpenProject(p, 'entry')}>
                      {ICONS.entry}
                    </button>
                    <button title="View" className="icon-btn" onClick={() => onOpenProject(p, 'view')}>
                      {ICONS.view}
                    </button>
                    <button title="Download JSON" className="icon-btn" onClick={() => handleDownloadOne(p, 'json')}>
                      {ICONS.download}
                    </button>
                    <button title="Edit" className="icon-btn" onClick={() => setEditingProject(p)}>
                      {ICONS.edit}
                    </button>
                    <button title="Delete" className="icon-btn icon-btn-danger" onClick={() => handleDeleteOne(p)}>
                      {ICONS.trash}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {showCreate && <ProjectModal mode="create" onCancel={() => setShowCreate(false)} onSubmit={handleCreate} />}
      {editingProject && (
        <ProjectModal mode="edit" initial={editingProject} onCancel={() => setEditingProject(null)} onSubmit={handleEdit} />
      )}
    </div>
  );
}
