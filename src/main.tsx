import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// Service worker: caches the app shell, WASM runtime and model for offline use.
// Skipped inside Tauri, which serves files locally anyway.
if (!('__TAURI_INTERNALS__' in window)) registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
