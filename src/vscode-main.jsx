// Import the VS Code adapter FIRST so window.electronAPI is available
// before any React component tries to call it.
import './vscodeAdapter.js';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
