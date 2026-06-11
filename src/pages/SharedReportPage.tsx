import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import SharedReportView from "../components/reports/SharedReportView";
import { getSharedReportApi } from "../lib/api";
import type { Agent, PropertyReport } from "../types";

type SharedReportState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; report: PropertyReport; agent: Agent };

export default function SharedReportPage() {
  const location = useLocation();
  const token = decodeURIComponent(location.pathname.replace(/^\/reports\/share\/?/, "").split("/")[0] ?? "");
  const [state, setState] = useState<SharedReportState>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "Shared report link is missing." });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    void getSharedReportApi(token)
      .then(({ report, agent }) => {
        if (!cancelled) setState({ status: "ready", report, agent });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "This shared report could not be found." });
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === "loading") {
    return (
      <main className="shared-report-page">
        <section className="card shared-report-loading">
          <div className="brand-mark mx-auto mb-4">S</div>
          <p className="m-0 text-slate-600">Loading shared report...</p>
        </section>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="shared-report-page">
        <section className="card shared-report-loading">
          <div className="brand-mark mx-auto mb-4">S</div>
          <h1 className="section-title">Report unavailable</h1>
          <p className="mt-4 text-slate-600">{state.message}</p>
          <Link className="secondary-button mt-6" to="/dashboard">
            Return to Signatis
          </Link>
        </section>
      </main>
    );
  }

  return <SharedReportView agent={state.agent} report={state.report} />;
}
