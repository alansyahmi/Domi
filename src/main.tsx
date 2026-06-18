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

const faviconUrl = new URL("../favicon.png", import.meta.url).href;

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
      <main className="min-h-screen grid place-items-center bg-[#272727] text-white">
        <div className="card p-10 text-center max-w-sm w-full mx-4 border border-white/10 bg-white/5 text-white shadow-2xl">
          <div className="hci-loader-container">
            <div className="hci-loader-logo">
              <img src={faviconUrl} alt="" aria-hidden="true" className="hci-loader-logo-image" />
            </div>
            <div>
              <p className="text-slate-200 font-bold m-0">Loading re:AI workspace...</p>
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
