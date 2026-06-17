import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import {
  type SignatisAuthMode,
  fetchAuthConfig,
  resolveAuthModeFromConfig,
} from "./lib/auth-mode";
import "./styles.css";

function Root() {
  const [authMode, setAuthMode] = useState<SignatisAuthMode | null>(null);

  useEffect(() => {
    fetchAuthConfig()
      .then(resolveAuthModeFromConfig)
      .then(setAuthMode)
      .catch(() => setAuthMode("demo"));
  }, []);

  if (authMode === null) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#f7f9fb]">
        <div className="card p-8 text-center">
          <div className="brand-mark mx-auto mb-4">S</div>
          <p className="text-slate-600">Loading Signatis workspace...</p>
        </div>
      </main>
    );
  }

  return <App authMode={authMode} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>,
);
