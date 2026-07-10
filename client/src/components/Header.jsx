export default function Header({ children }) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark">VA</span>
        Video Annotator
      </div>
      <div className="header-meta">{children}</div>
    </header>
  );
}
