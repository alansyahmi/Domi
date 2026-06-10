import { Download, Filter, Frown, Meh, Search, SlidersHorizontal, Smile } from "lucide-react";
import { useMemo, useState } from "react";
import { initials, sourceTone } from "../lib/format";
import type { Lead, Sentiment } from "../types";

function SentimentIcon({ sentiment }: { sentiment: Sentiment }) {
  if (sentiment === "positive") return <Smile size={22} className="text-emerald-600" aria-hidden="true" />;
  if (sentiment === "negative") return <Frown size={22} className="text-red-600" aria-hidden="true" />;
  return <Meh size={22} className="text-slate-600" aria-hidden="true" />;
}

export default function LeadManagementPage({ leads }: { leads: Lead[] }) {
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState("all");
  const [source, setSource] = useState("all");
  const [sentiment, setSentiment] = useState("all");

  const sources = useMemo(() => Array.from(new Set(leads.map((lead) => lead.source))), [leads]);
  const filtered = leads.filter((lead) => {
    const search = `${lead.name} ${lead.email} ${lead.propertyInterest}`.toLowerCase();
    return (
      search.includes(query.toLowerCase()) &&
      (intent === "all" || String(lead.intent) === intent) &&
      (source === "all" || lead.source === source) &&
      (sentiment === "all" || lead.sentiment === sentiment)
    );
  });
  const hotCount = leads.filter((lead) => lead.intent === 1).length;
  const avgEngagement = Math.round(
    leads.reduce((total, lead) => total + Math.min(100, lead.emailOpens * 5 + lead.linkClicks * 8), 0) / leads.length,
  );

  return (
    <main className="page">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="section-title">Lead Pipeline</h1>
          <p className="mt-4 text-xl text-slate-700">Analyze and prioritize prospects based on behavioral data.</p>
        </div>
        <div className="flex gap-3">
          <button className="secondary-button">
            <Filter size={19} aria-hidden="true" />
            Filters
          </button>
          <button className="secondary-button">
            <Download size={19} aria-hidden="true" />
            Export
          </button>
        </div>
      </div>

      <section className="card mt-8 p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(14rem,1fr)_repeat(3,12rem)_auto] gap-4 items-center">
          <label className="flex items-center gap-3 rounded-full border border-slate-300 bg-white px-4 py-2">
            <Search size={20} className="text-slate-500" aria-hidden="true" />
            <input
              className="w-full border-0 outline-none bg-transparent"
              placeholder="Search leads, properties..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select className="select" value={intent} onChange={(event) => setIntent(event.target.value)}>
            <option value="all">Intent: All</option>
            <option value="1">Intent: 1</option>
            <option value="0">Intent: 0</option>
          </select>
          <select className="select" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="all">Source: All</option>
            {sources.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="select" value={sentiment} onChange={(event) => setSentiment(event.target.value)}>
            <option value="all">Sentiment: All</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
          <button
            className="ghost-button"
            onClick={() => {
              setQuery("");
              setIntent("all");
              setSource("all");
              setSentiment("all");
            }}
          >
            Clear Filters
          </button>
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[repeat(3,1fr)_minmax(16rem,1fr)] gap-5">
        <section className="card p-6">
          <p className="metric-label">Total Leads</p>
          <strong className="text-3xl">{leads.length.toLocaleString()}</strong>
          <p className="text-emerald-600 mt-2">+12% this week</p>
        </section>
        <section className="card p-6">
          <p className="metric-label">High Intent (Score 1)</p>
          <strong className="text-3xl">{hotCount}</strong>
          <p className="text-slate-600 mt-2">27% conversion probability</p>
        </section>
        <section className="card p-6">
          <p className="metric-label">Avg Engagement</p>
          <strong className="text-3xl">{avgEngagement}%</strong>
          <p className="text-emerald-600 mt-2">+4% open rate</p>
        </section>
        <section className="card p-6 bg-[#041627] text-white relative overflow-hidden">
          <SlidersHorizontal size={22} className="opacity-70" aria-hidden="true" />
          <p className="mt-2 text-slate-300">Priority Actions</p>
          <strong className="text-2xl">{hotCount} Hot Leads</strong>
          <p className="text-slate-300">Review now</p>
        </section>
      </div>

      <section className="card mt-8 overflow-hidden">
        <div className="hidden lg:grid grid-cols-[2fr_0.7fr_1.7fr_1.2fr_1.1fr] gap-6 px-8 py-5 bg-slate-100 eyebrow">
          <span>Prospect Name</span>
          <span>Score</span>
          <span>Engagement</span>
          <span>Sentiment</span>
          <span>Source</span>
        </div>
        {filtered.map((lead) => (
          <article
            key={lead.id}
            className={`grid grid-cols-1 lg:grid-cols-[2fr_0.7fr_1.7fr_1.2fr_1.1fr] gap-4 lg:gap-6 px-6 lg:px-8 py-6 border-t border-slate-200 ${
              lead.intent === 1 ? "border-l-4 border-l-[#ffd45a]" : ""
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="avatar small bg-[#ffd45a]">{initials(lead.name)}</div>
              <div>
                <h2 className="m-0 text-xl font-extrabold">{lead.name}</h2>
                <p className="m-0 text-slate-600">{lead.email}</p>
              </div>
            </div>
            <div className={`intent-badge ${lead.intent === 0 ? "zero" : ""}`}>{lead.intent}</div>
            <div>
              <div className="flex gap-8 text-sm">
                <span>Opens: {lead.emailOpens}</span>
                <span>Clicks: {lead.linkClicks}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-[#041627]"
                  style={{ width: `${Math.min(100, lead.emailOpens * 6 + lead.linkClicks * 9)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SentimentIcon sentiment={lead.sentiment} />
              <span className="capitalize">{lead.sentiment}</span>
            </div>
            <div>
              <span className={`tag ${sourceTone(lead.source)}`}>{lead.source}</span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
