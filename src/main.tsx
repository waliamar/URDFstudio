// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { useUiStore } from "./state/uiStore";
import "./styles/globals.css";

// Apply the persisted theme before first paint.
document.documentElement.setAttribute("data-theme", useUiStore.getState().theme);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
