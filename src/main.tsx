
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeThemeSystem } from './lib/themeManager.ts';
import './lib/i18n.ts'; // Initialize i18n

// 🔧 Import notification service test utilities in development
if (import.meta.env.DEV) {
  import('./utils/notificationServiceTest.ts');
}

// Initialize theme system before rendering
initializeThemeSystem();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
