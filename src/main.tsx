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
        <div className="card p-10 text-center landing-card-shadow border border-slate-200/80 max-w-sm w-full mx-4 animate-pulse">
          <div className="hci-loader-container">
            <div className="hci-loader-logo">S</div>
            <div>
              <p className="text-slate-600 font-bold m-0">Loading Signatis workspace...</p>
              <div className="hci-loading-bar" />
            </div>
          </div>
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
