import { AuthKitProvider } from "@workos-inc/authkit-react";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

const clientId = import.meta.env.VITE_WORKOS_CLIENT_ID;

if (!clientId) {
  throw new Error("VITE_WORKOS_CLIENT_ID is not configured in environment variables");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthKitProvider clientId={clientId}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthKitProvider>
  </React.StrictMode>,
);
