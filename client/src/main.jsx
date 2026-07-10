import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/theme.css';
import './styles/app.css';
import './styles/features/video-link-loader.css';
import './styles/features/audit-mode.css';
import './styles/features/responsive.css';
import './styles/features/fps-control.css';
import './styles/features/stored-video-selector.css';
import './styles/features/audit-entry-actions.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
