/**
 * @coding-usage/web
 *
 * Web dashboard for coding-usage monitor.
 * React SPA with Vite.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

/**
 * Placeholder App component
 */
function App() {
  return React.createElement('div', { className: 'app' }, [
    React.createElement('h1', { key: 'title' }, 'Coding Usage Monitor'),
    React.createElement('p', { key: 'desc' }, 'Dashboard placeholder'),
  ]);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  React.createElement(App)
);
