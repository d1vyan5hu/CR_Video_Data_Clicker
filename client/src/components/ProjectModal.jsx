import { useState } from 'react';

// Shared modal for both "Create New Project" and editing a project's
// title / description. In edit mode the bin duration field is hidden —
// changing the counting-interval length after entries exist would silently
// desync existing bins, so that's a create-time-only decision.
export default function ProjectModal({ mode = 'create', initial, onCancel, onSubmit }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [binDuration, setBinDuration] = useState(initial?.bin_duration || 5);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const isEdit = mode === 'edit';

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    if (!isEdit && (!Number(binDuration) || Number(binDuration) <= 0)) {
      setError('Bin duration must be a positive number of minutes');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), description, bin_duration: Number(binDuration) });
    } catch (e) {
      setError(e.response?.data?.error || e.message);
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-card project-modal">
        <h2>{isEdit ? 'Edit Project' : 'Create New Project'}</h2>

        <label className="field">
          <span>Project Name *</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bovaird Dr & Hurontario St"
          />
        </label>

        <label className="field">
          <span>Description (Optional)</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes about this project..."
          />
        </label>

        {!isEdit && (
          <label className="field field-inline">
            <span>Bin Duration (minutes) *</span>
            <div className="bin-duration-input">
              <input
                type="number"
                min={1}
                value={binDuration}
                onChange={(e) => setBinDuration(e.target.value)}
              />
              <span className="unit">minutes</span>
            </div>
          </label>
        )}

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-accent" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create & Setup'}
          </button>
        </div>
      </div>
    </div>
  );
}
