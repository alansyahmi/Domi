import { CheckCircle2, Copy, Link2, Mail, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { Agent, Integration } from "../types";

const AVAILABLE_PORTALS = [
  {
    id: "portal_propertyguru",
    name: "PropertyGuru Malaysia",
    description: "Sync property inquiries from Malaysia's leading real estate platform.",
    mark: "P",
    color: "#e31837", // PropertyGuru Red
    steps: [
      "Log into your PropertyGuru AgentNet account.",
      "Navigate to Settings > Lead Notifications / Routing.",
      "Select 'Add Forwarding Email'.",
      "Paste your unique Signatis address and save.",
    ],
  },
  {
    id: "portal_iproperty",
    name: "iProperty Malaysia",
    description: "Capture buyer and renter leads from the iProperty platform.",
    mark: "i",
    color: "#002f6c", // iProperty Blue
    steps: [
      "Log into your iProperty Agent Portal.",
      "Go to Account Profile > Notification Settings.",
      "Locate the Email Forwarding option for listings.",
      "Add your unique Signatis address and save changes.",
    ],
  },
  {
    id: "portal_mudah",
    name: "Mudah.my Property",
    description: "Ingest inquiries from Malaysia's largest classifieds site.",
    mark: "M",
    color: "#f58220", // Mudah Orange
    steps: [
      "Open your Mudah.my Pro Niaga dashboard.",
      "Navigate to Account Settings > Lead Forwarding.",
      "Enable email inquiry forwarding.",
      "Enter your unique Signatis address and save.",
    ],
  },
  {
    id: "portal_edgeprop",
    name: "EdgeProp Malaysia",
    description: "Import listing leads and analytics alerts from EdgeProp.",
    mark: "E",
    color: "#188a44", // EdgeProp Green
    steps: [
      "Go to the EdgeProp Agent Dashboard.",
      "Navigate to Profile > Lead Settings.",
      "Select the custom parsing/email redirection field.",
      "Paste your unique Signatis address and click save.",
    ],
  },
];

export default function SettingsPage({
  agent,
  integrations,
  onSave,
  onConnectIntegration,
  onDisconnectIntegration,
  onSaveWhatsAppCredentials,
  onDeleteWhatsAppCredentials,
}: {
  agent: Agent;
  integrations: Integration[];
  onSave: (input: Omit<Agent, "id" | "workosUserId" | "plan" | "avatarInitials" | "ingestionAddress">) => Promise<void>;
  onConnectIntegration: (id: string, name: string, description: string) => Promise<void>;
  onDisconnectIntegration: (id: string) => Promise<void>;
  onSaveWhatsAppCredentials?: (phoneNumberId: string, accessToken: string) => Promise<void>;
  onDeleteWhatsAppCredentials?: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    fullName: agent.fullName || "",
    email: agent.email || "",
    phone: agent.phone || "",
    renNumber: agent.renNumber || "",
    agencyName: agent.agencyName || "",
    whatsappNumber: agent.whatsappNumber || "",
    avatarUrl: agent.avatarUrl || "",
    companyLogoUrl: agent.companyLogoUrl || "",
    bio: agent.bio || "",
  });

  const [whatsappForm, setWhatsappForm] = useState({
    phoneNumberId: "",
    accessToken: "",
  });
  const [isSavingWhatsApp, setIsSavingWhatsApp] = useState(false);

  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFailing, setIsFailing] = useState(false);
  const [showSuccessGlow, setShowSuccessGlow] = useState(false);
  const [glowType, setGlowType] = useState<"success" | "fail">("success");
  const [successGlowKey, setSuccessGlowKey] = useState(0);

  const [showCopyGlow, setShowCopyGlow] = useState(false);
  const [copyGlowType, setCopyGlowType] = useState<"success" | "fail">("success");
  const [copyGlowKey, setCopyGlowKey] = useState(0);

  const [activeGlowButton, setActiveGlowButton] = useState<string | null>(null);

  // Animation timeout refs to handle rapid clicking and cleanup
  const successTimeoutRef = useRef<number | null>(null);
  const successDelayRef = useRef<number | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const copiedResetRef = useRef<number | null>(null);
  const activeGlowTimerRef = useRef<number | null>(null);
  const simulatedFailureRef = useRef<number | null>(null);

  function triggerButtonGlow(buttonId: string) {
    if (activeGlowTimerRef.current) window.clearTimeout(activeGlowTimerRef.current);

    setActiveGlowButton(buttonId);
    activeGlowTimerRef.current = window.setTimeout(() => {
      setActiveGlowButton(null);
    }, 1200);
  }

  function triggerProfileGlow(type: "success" | "fail") {
    if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
    if (successDelayRef.current) window.clearTimeout(successDelayRef.current);

    setGlowType(type);
    setSuccessGlowKey((prev) => prev + 1);

    successDelayRef.current = window.setTimeout(() => {
      setShowSuccessGlow(true);
      successTimeoutRef.current = window.setTimeout(() => {
        setShowSuccessGlow(false);
      }, type === "success" ? 1600 : 2200);
    }, 50);
  }

  function triggerCopyGlow(type: "success" | "fail") {
    if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);

    setCopyGlowType(type);
    setCopyGlowKey((prev) => prev + 1);
    setShowCopyGlow(true);

    copyTimeoutRef.current = window.setTimeout(() => {
      setShowCopyGlow(false);
    }, type === "success" ? 1200 : 2200);
  }

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
      if (successDelayRef.current) window.clearTimeout(successDelayRef.current);
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      if (copiedResetRef.current) window.clearTimeout(copiedResetRef.current);
      if (activeGlowTimerRef.current) window.clearTimeout(activeGlowTimerRef.current);
      if (simulatedFailureRef.current) window.clearTimeout(simulatedFailureRef.current);
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    triggerButtonGlow("save-profile");
    setIsSaving(true);
    try {
      await onSave(form);
      setIsSaving(false);
      triggerProfileGlow("success");
    } catch (error) {
      console.error(error);
      setIsSaving(false);
      triggerProfileGlow("fail");
    }
  }

  function submitFail() {
    triggerButtonGlow("simulate-profile-failure");
    setIsFailing(true);
    if (simulatedFailureRef.current) window.clearTimeout(simulatedFailureRef.current);

    simulatedFailureRef.current = window.setTimeout(() => {
      setIsFailing(false);
      triggerProfileGlow("fail");
    }, 800);
  }

  async function copyAddress() {
    triggerButtonGlow("copy-ingestion-address");
    if (copiedResetRef.current) window.clearTimeout(copiedResetRef.current);

    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API is unavailable.");
      }

      await navigator.clipboard.writeText(agent.ingestionAddress);
      setCopied(true);
      triggerCopyGlow("success");

      copiedResetRef.current = window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error(error);
      setCopied(false);
      triggerCopyGlow("fail");
    }
  }

  function mockCopyFail() {
    triggerButtonGlow("mock-copy-failure");
    triggerCopyGlow("fail");
  }

  async function connectPortal(portal: (typeof AVAILABLE_PORTALS)[number]) {
    triggerButtonGlow(`connect-${portal.id}`);

    try {
      await onConnectIntegration(portal.id, portal.name, portal.description);
    } catch (error) {
      console.error(error);
    }
  }

  async function disconnectPortal(integrationId: string) {
    triggerButtonGlow(`disconnect-${integrationId}`);

    try {
      await onDisconnectIntegration(integrationId);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSaveWhatsApp(event: FormEvent) {
    event.preventDefault();
    if (!onSaveWhatsAppCredentials) return;
    setIsSavingWhatsApp(true);
    try {
      await onSaveWhatsAppCredentials(whatsappForm.phoneNumberId, whatsappForm.accessToken);
      // We simulate successful connection by local state, but App.tsx triggers a re-fetch?
      // For this demo, let's just alert success
      alert("WhatsApp Business connected successfully!");
      setWhatsappForm({ phoneNumberId: "", accessToken: "" });
    } catch (err) {
      console.error(err);
      alert("Failed to save WhatsApp credentials.");
    } finally {
      setIsSavingWhatsApp(false);
    }
  }

  const connectedPortals = AVAILABLE_PORTALS.filter((portal) =>
    integrations.some((integration) => integration.id === portal.id)
  );

  const availablePortalsToConnect = AVAILABLE_PORTALS.filter((portal) =>
    !integrations.some((integration) => integration.id === portal.id)
  );

  return (
    <main className="page">
      <h1 className="section-title">Settings & Integrations</h1>
      <p className="mt-4 text-xl text-slate-700">Manage account preferences, billing, and automated data pipelines.</p>

      <div className="mt-10 grid grid-cols-1 xl:grid-cols-[minmax(22rem,0.8fr)_minmax(0,1.6fr)] gap-8">
        <div className="grid gap-8 content-start">
          <form className="card p-7 relative success-glow-container" onSubmit={(event) => void submit(event)}>
            {showSuccessGlow && <div key={successGlowKey} className={`success-border-glow ease-in-out animate ${glowType === "fail" ? "fail" : ""}`} />}
            <h2 className="m-0 text-3xl font-extrabold border-b border-slate-200 pb-5">Profile Information</h2>
            <div className="mt-6 grid gap-5">
              <label className="form-field">
                <span className="form-label">Full Name</span>
                <input
                  className="input"
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                />
              </label>
              <label className="form-field">
                <span className="form-label">Email Address</span>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </label>
              <label className="form-field">
                <span className="form-label">Phone Number</span>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </label>
              <label className="form-field">
                <span className="form-label">REN/REA Number</span>
                <input
                  className="input"
                  placeholder="e.g. REN 12345"
                  value={form.renNumber}
                  onChange={(event) => setForm({ ...form, renNumber: event.target.value })}
                />
              </label>
              <label className="form-field">
                <span className="form-label">Agency / Brokerage Name</span>
                <input
                  className="input"
                  placeholder="e.g. Signatis Realty"
                  value={form.agencyName}
                  onChange={(event) => setForm({ ...form, agencyName: event.target.value })}
                />
              </label>
              <label className="form-field">
                <span className="form-label">WhatsApp Contact Number</span>
                <input
                  className="input"
                  placeholder="e.g. +60 12-555 8472"
                  value={form.whatsappNumber}
                  onChange={(event) => setForm({ ...form, whatsappNumber: event.target.value })}
                />
              </label>
              <label className="form-field">
                <span className="form-label">Profile Photo URL</span>
                <input
                  className="input"
                  type="url"
                  placeholder="https://..."
                  value={form.avatarUrl}
                  onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })}
                />
              </label>
              <label className="form-field">
                <span className="form-label">Company Logo URL</span>
                <input
                  className="input"
                  type="url"
                  placeholder="https://..."
                  value={form.companyLogoUrl}
                  onChange={(event) => setForm({ ...form, companyLogoUrl: event.target.value })}
                />
              </label>
              <label className="form-field">
                <span className="form-label">Professional Bio / Pitch</span>
                <textarea
                  className="input min-h-24 py-2"
                  placeholder="Write a brief profile description to brand your client reports..."
                  value={form.bio}
                  onChange={(event) => setForm({ ...form, bio: event.target.value })}
                />
              </label>
              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <button
                  className={`primary-button flex-1 glow-on-hover rainbow ${isSaving ? "saving" : ""} ${activeGlowButton === "save-profile" ? "active-glow" : ""}`}
                  type="submit"
                  disabled={isSaving || isFailing}
                >
                  <span>Save Changes</span>
                </button>
                <button
                  className={`secondary-button flex-1 border-red-300 text-red-600 glow-on-hover rainbow ${isFailing ? "saving" : ""} ${activeGlowButton === "simulate-profile-failure" ? "active-glow" : ""}`}
                  type="button"
                  onClick={submitFail}
                  disabled={isSaving || isFailing}
                >
                  <span>Simulate Failure</span>
                </button>
              </div>
            </div>
          </form>

          <section className="card p-7">
            <h2 className="m-0 text-3xl font-extrabold border-b border-slate-200 pb-5">Subscription Plan</h2>
            <div className="mt-6 rounded-md border border-slate-300 bg-slate-100 p-5">
              <div className="flex items-center justify-between gap-4">
                <span className="eyebrow">Current Plan</span>
                <span className="status-chip bg-[#ffd45a] text-[#574500]">Active</span>
              </div>
              <h3 className="mt-3 text-2xl font-extrabold">{agent.plan}</h3>
              <p className="text-slate-700">RM 499.00 / month</p>
              <ul className="mt-5 grid gap-2 p-0 list-none">
                {["Unlimited Property Reports", "Real-time Lead Scoring", "Priority Support API"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <button
              className={`secondary-button w-full mt-5 glow-on-hover rainbow ${activeGlowButton === "manage-billing" ? "active-glow" : ""}`}
              type="button"
              onClick={() => triggerButtonGlow("manage-billing")}
            >
              <span>Manage Billing</span>
            </button>
          </section>
        </div>

        <section className="card overflow-hidden">
          <div className="p-7 border-b border-slate-200 flex items-start justify-between gap-6">
            <div>
              <h2 className="m-0 text-3xl font-extrabold">Lead Ingestion Pipeline</h2>
              <p className="mt-2 text-slate-700">Automate lead capture via secure email forwarding.</p>
            </div>
            <Mail size={34} className="text-slate-500" aria-hidden="true" />
          </div>

          <div className="p-7">
            <p className="eyebrow mb-3">Your Unique Ingestion Address</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex flex-1 flex-col sm:flex-row relative success-glow-container rounded-md">
                {showCopyGlow && <div key={copyGlowKey} className={`success-border-glow animate ${copyGlowType === "fail" ? "fail" : ""}`} />}
                <code className="flex-1 border border-slate-300 bg-slate-100 rounded-t-md sm:rounded-l-md sm:rounded-r-none px-4 py-4 overflow-x-auto">
                  {agent.ingestionAddress}
                </code>
                <button
                  className={`primary-button rounded-t-none sm:rounded-l-none sm:rounded-r-md glow-on-hover rainbow ${activeGlowButton === "copy-ingestion-address" ? "active-glow" : ""}`}
                  onClick={() => void copyAddress()}
                >
                  <span>
                    <Copy size={20} aria-hidden="true" />
                    {copied ? "Copied" : "Copy"}
                  </span>
                </button>
              </div>
              <button
                className={`secondary-button border-red-300 text-red-600 glow-on-hover rainbow ${activeGlowButton === "mock-copy-failure" ? "active-glow" : ""}`}
                onClick={() => void mockCopyFail()}
              >
                <span>Mock Fail</span>
              </button>
            </div>

            {/* Dynamic Setup Instructions for connected portals */}
            <div className="mt-8">
              <h3 className="m-0 text-2xl font-extrabold border-b border-slate-200 pb-4">Setup Instructions</h3>
              {connectedPortals.length === 0 ? (
                <div className="mt-5 rounded-md border border-dashed border-slate-300 p-8 text-center bg-slate-50">
                  <p className="m-0 text-slate-600">No lead ingestion portals connected yet.</p>
                  <p className="mt-2 text-sm text-slate-500">Connect a portal below to view its forwarding setup instructions.</p>
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {connectedPortals.map((portal) => (
                    <article key={portal.id} className="rounded-md border border-slate-300 bg-slate-50 p-6">
                      <div className="flex items-center gap-4">
                        <div
                          className="brand-mark !w-10 !h-10 !rounded-sm flex items-center justify-center font-black text-white text-xl"
                          style={{ backgroundColor: portal.color }}
                        >
                          {portal.mark}
                        </div>
                        <h4 className="m-0 text-xl font-extrabold">{portal.name}</h4>
                      </div>
                      <ol className="mt-5 grid gap-3 pl-5">
                        {portal.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Available Lead Sources to Add */}
            <div className="mt-8">
              <h3 className="m-0 text-2xl font-extrabold border-b border-slate-200 pb-4">Messaging Integrations</h3>
              <div className="mt-5">
                <article className="rounded-md border border-slate-200 bg-white p-6">
                  <div className="flex items-center gap-4 border-b border-slate-100 pb-4 mb-4">
                    <div className="flex items-center justify-center font-black text-white text-xl rounded-sm w-10 h-10 bg-emerald-500">
                      W
                    </div>
                    <div>
                      <h4 className="m-0 text-xl font-extrabold text-slate-800">WhatsApp Business API</h4>
                      <p className="m-0 text-sm text-slate-500">Send direct WhatsApp messages using your Meta Developer credentials.</p>
                    </div>
                  </div>
                  <form className="grid gap-4" onSubmit={(e) => void handleSaveWhatsApp(e)}>
                    <label className="form-field">
                      <span className="form-label text-sm text-slate-700 font-bold">Phone Number ID</span>
                      <input
                        className="input bg-slate-50 border-slate-200"
                        placeholder="e.g. 102345678901234"
                        value={whatsappForm.phoneNumberId}
                        onChange={(e) => setWhatsappForm({ ...whatsappForm, phoneNumberId: e.target.value })}
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span className="form-label text-sm text-slate-700 font-bold">Permanent Access Token</span>
                      <input
                        type="password"
                        className="input bg-slate-50 border-slate-200"
                        placeholder="EAAB..."
                        value={whatsappForm.accessToken}
                        onChange={(e) => setWhatsappForm({ ...whatsappForm, accessToken: e.target.value })}
                        required
                      />
                    </label>
                    <div className="flex justify-end gap-3 mt-2">
                      {onDeleteWhatsAppCredentials && (
                        <button
                          type="button"
                          className="px-4 py-2 text-red-600 font-semibold hover:bg-red-50 rounded-md transition-colors"
                          onClick={() => void onDeleteWhatsAppCredentials()}
                        >
                          Disconnect
                        </button>
                      )}
                      <button
                        type="submit"
                        className="primary-button bg-emerald-600 hover:bg-emerald-700 !py-2 !px-6"
                        disabled={isSavingWhatsApp}
                      >
                        {isSavingWhatsApp ? "Saving..." : "Connect WhatsApp"}
                      </button>
                    </div>
                  </form>
                </article>
              </div>

              <h3 className="m-0 text-2xl font-extrabold border-b border-slate-200 pb-4 mt-10">Available Lead Sources</h3>
              {availablePortalsToConnect.length === 0 ? (
                <p className="mt-4 text-slate-500 text-sm">All available portals are connected.</p>
              ) : (
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availablePortalsToConnect.map((portal) => (
                    <article key={portal.id} className="flex items-center gap-4 rounded-md border border-slate-200 p-4 bg-white">
                      <div
                        className="avatar small flex items-center justify-center font-black text-white text-lg rounded-sm !w-10 !h-10"
                        style={{ backgroundColor: portal.color }}
                      >
                        {portal.mark}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="m-0 font-extrabold text-base">{portal.name}</h4>
                        <p className="m-0 text-xs text-slate-500 truncate">{portal.description}</p>
                      </div>
                      <button
                        className={`secondary-button !py-1.5 !px-3 text-xs glow-on-hover rainbow ${activeGlowButton === `connect-${portal.id}` ? "active-glow" : ""}`}
                        onClick={() => void connectPortal(portal)}
                      >
                        <span>Connect</span>
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Active Integrations list */}
            <div className="mt-8">
              <h3 className="m-0 text-2xl font-extrabold border-b border-slate-200 pb-4">Active Integrations</h3>
              <div className="mt-5 grid gap-4">
                {integrations.length === 0 ? (
                  <p className="mt-4 text-slate-500 text-sm">No active integrations connected.</p>
                ) : (
                  integrations.map((integration) => {
                    const portal = AVAILABLE_PORTALS.find((p) => p.id === integration.id);
                    return (
                      <article key={integration.id} className="flex items-center gap-4 rounded-md border border-slate-200 p-4">
                        {portal ? (
                          <div
                            className="avatar small flex items-center justify-center font-black text-white text-lg rounded-sm !w-10 !h-10"
                            style={{ backgroundColor: portal.color }}
                          >
                            {portal.mark}
                          </div>
                        ) : (
                          <div className="avatar small bg-slate-100">
                            <Link2 size={18} aria-hidden="true" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="m-0 font-extrabold">{integration.name}</h3>
                          <p className="m-0 text-sm text-slate-600">{integration.description}</p>
                        </div>
                        <span className="status-chip status-ready">Connected</span>
                        <button
                          className={`icon-button text-red-600 hover:bg-red-50 glow-on-hover rainbow ${activeGlowButton === `disconnect-${integration.id}` ? "active-glow" : ""}`}
                          onClick={() => void disconnectPortal(integration.id)}
                          aria-label={`Remove ${integration.name}`}
                        >
                          <Trash2 size={19} aria-hidden="true" />
                        </button>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
