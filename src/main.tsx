import { AuthKitProvider } from "@workos-inc/authkit-react";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { resolveAuthMode } from "./lib/auth-mode";
import "./styles.css";

const clientId = import.meta.env.VITE_WORKOS_CLIENT_ID;
const redirectUri = import.meta.env.VITE_WORKOS_REDIRECT_URI || window.location.origin;

const authMode = resolveAuthMode({
  dev: import.meta.env.DEV,
  prod: import.meta.env.PROD,
  mode: import.meta.env.VITE_SIGNATIS_AUTH_MODE,
  workosConfigured: Boolean(clientId),
});

const app = (
  <BrowserRouter>
    <App authMode={authMode} />
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {authMode === "workos" ? (
      <AuthKitProvider
        clientId={clientId}
        redirectUri={redirectUri}
        onRedirectCallback={({ state }) => {
          const returnTo = typeof state?.returnTo === "string" && state.returnTo.startsWith("/") ? state.returnTo : "/dashboard";
          window.history.replaceState({}, document.title, returnTo);
        }}
      >
        {app}
      </AuthKitProvider>
    ) : (
      app
    )}
  </React.StrictMode>,
);
