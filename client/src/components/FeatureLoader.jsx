// Renders the session metadata inputs described by a config's `setupFields`.
// This is what makes the setup form "JSON driven" — no field is hardcoded;
// whatever the loaded config asks for is what gets rendered.
export default function FeatureLoader({ setupFields, values, onChange }) {
  if (!setupFields || setupFields.length === 0) return null;

  return (
    <div>
      <div className="section-label">Session Details</div>
      {setupFields.map((field) => (
        <div className="field-row" key={field.id}>
          <label className="field-label" htmlFor={field.id}>
            {field.label}
          </label>
          <input
            id={field.id}
            className="field-input"
            type={field.type === 'number' ? 'number' : 'text'}
            placeholder={field.placeholder || ''}
            value={values[field.id] || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
