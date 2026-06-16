import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { resolveAuthMode } from "./lib/auth-mode";
import "./styles.css";

const clientId = import.meta.env.VITE_SCALEKIT_CLIENT_ID;

const authMode = resolveAuthMode({
  dev: import.meta.env.DEV,
  prod: import.meta.env.PROD,
  mode: import.meta.env.VITE_SIGNATIS_AUTH_MODE,
  workosConfigured: Boolean(clientId), // Keep parameter name to avoid breaking resolveAuthMode signature
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App authMode={authMode} />
    </BrowserRouter>
  </React.StrictMode>,
);
