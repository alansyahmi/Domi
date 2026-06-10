import { CheckCircle2, Copy, Link2, Mail, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import type { Agent, Integration } from "../types";

export default function SettingsPage({
  agent,
  integrations,
  onSave,
}: {
  agent: Agent;
  integrations: Integration[];
  onSave: (input: Pick<Agent, "fullName" | "email" | "phone">) => Promise<void>;
}) {
  const [form, setForm] = useState({
    fullName: agent.fullName,
    email: agent.email,
    phone: agent.phone,
  });
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave(form);
  }

  async function copyAddress() {
    await navigator.clipboard?.writeText(agent.ingestionAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="page">
      <h1 className="section-title">Settings & Integrations</h1>
      <p className="mt-4 text-xl text-slate-700">Manage account preferences, billing, and automated data pipelines.</p>

      <div className="mt-10 grid grid-cols-1 xl:grid-cols-[minmax(22rem,0.8fr)_minmax(0,1.6fr)] gap-8">
        <div className="grid gap-8 content-start">
          <form className="card p-7" onSubmit={(event) => void submit(event)}>
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
              <button className="primary-button w-full" type="submit">
                Save Changes
              </button>
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
              <p className="text-slate-700">$149.00 / month</p>
              <ul className="mt-5 grid gap-2 p-0 list-none">
                {["Unlimited Property Reports", "Real-time Lead Scoring", "Priority Support API"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <button className="secondary-button w-full mt-5">Manage Billing</button>
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
            <div className="flex flex-col sm:flex-row">
              <code className="flex-1 border border-slate-300 bg-slate-100 rounded-t-md sm:rounded-l-md sm:rounded-r-none px-4 py-4 overflow-x-auto">
                {agent.ingestionAddress}
              </code>
              <button className="primary-button rounded-t-none sm:rounded-l-none sm:rounded-r-md" onClick={() => void copyAddress()}>
                <Copy size={20} aria-hidden="true" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[
                {
                  name: "Zillow Premier Agent",
                  mark: "Z",
                  steps: ["Log into your agent hub.", "Navigate to Settings > Lead Routing.", "Select Add Forwarding Email.", "Paste your Signatis address."],
                },
                {
                  name: "Realtor.com Pro",
                  mark: "R",
                  steps: ["Open the professional dashboard.", "Go to Account Settings > Lead Settings.", "Locate Email Parsing.", "Add your Signatis address and save."],
                },
              ].map((card) => (
                <article key={card.name} className="rounded-md border border-slate-300 bg-slate-50 p-6">
                  <div className="flex items-center gap-4">
                    <div className="brand-mark !w-10 !h-10 !rounded-sm">{card.mark}</div>
                    <h3 className="m-0 text-xl font-extrabold">{card.name}</h3>
                  </div>
                  <ol className="mt-5 grid gap-3 pl-5">
                    {card.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>

            <div className="mt-8">
              <h2 className="m-0 text-2xl font-extrabold border-b border-slate-200 pb-4">Active Integrations</h2>
              <div className="mt-5 grid gap-4">
                {integrations.map((integration) => (
                  <article key={integration.id} className="flex items-center gap-4 rounded-md border border-slate-200 p-4">
                    <div className="avatar small bg-slate-100">
                      <Link2 size={18} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="m-0 font-extrabold">{integration.name}</h3>
                      <p className="m-0 text-sm text-slate-600">{integration.description}</p>
                    </div>
                    <span className="status-chip status-ready">Connected</span>
                    <button className="icon-button" aria-label={`Remove ${integration.name}`}>
                      <Trash2 size={19} aria-hidden="true" />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
