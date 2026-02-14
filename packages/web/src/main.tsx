/**
 * @coding-usage/web
 *
 * Web dashboard for coding-usage monitor.
 * React SPA with Vite.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { Dashboard } from "./components/Dashboard";
import "./styles.css";

/**
 * Main App component
 */
function App() {
  return React.createElement(Dashboard);
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(React.createElement(App));
