import { useRef } from 'react';

export default function UploadCard({ icon, title, subtitle, accept, onFile, loaded }) {
  const inputRef = useRef(null);

  return (
    <div className={`upload-card${loaded ? ' loaded' : ''}`} onClick={() => inputRef.current?.click()}>
      <div className="upload-card-info">
        <span className="upload-card-title">{title}</span>
        <span className="upload-card-sub">{subtitle}</span>
      </div>
      <span className="upload-icon">{icon}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
