import {
  ArrowRight,
  BarChart3,
  Check,
  FileText,
  Gauge,
  Mail,
  MessageCircle,
  PenLine,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

/* Real-estate photography (Unsplash, verified to load). */
const IMG = {
  skyline: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=1280&q=80&auto=format&fit=crop",
  skylineWide: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=1600&q=70&auto=format&fit=crop",
  villa: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1000&q=80&auto=format&fit=crop",
  towers: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=900&q=80&auto=format&fit=crop",
};

/* Reveal-on-scroll wrapper. Uses IntersectionObserver (no scroll listeners)
   and degrades to instantly-visible under prefers-reduced-motion. */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("in");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("in");
            observer.unobserve(el);
          }
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

/* Counts up to a target when scrolled into view; shows the final value
   immediately under prefers-reduced-motion. */
function Count({ to, decimals = 0, suffix = "" }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }

    let frame = 0;
    let startTime = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        const tick = (now: number) => {
          if (!startTime) startTime = now;
          const progress = Math.min((now - startTime) / 1100, 1);
          const eased = 1 - Math.pow(1 - progress, 4);
          setValue(to * eased);
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to]);

  const display = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString();
  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

const portals = [
  { name: "PropertyGuru", mark: "P", color: "#e31837" },
  { name: "iProperty", mark: "i", color: "#002f6c" },
  { name: "Mudah.my", mark: "M", color: "#f58220" },
  { name: "EdgeProp", mark: "E", color: "#188a44" },
];

function PrimaryCta({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="landing-lift group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#041627] px-6 font-bold text-white"
    >
      {children}
      <ArrowRight
        size={18}
        aria-hidden="true"
        className="transition-transform duration-200 group-hover:translate-x-1"
      />
    </Link>
  );
}

function PlanCard({
  name,
  price,
  period,
  blurb,
  features,
  featured = false,
}: {
  name: string;
  price: string;
  period?: string;
  blurb: string;
  features: string[];
  featured?: boolean;
}) {
  return (
    <div
      className={`landing-lift relative flex h-full flex-col rounded-2xl bg-white p-8 text-left ${
        featured ? "landing-card-shadow border-2 border-[#041627]" : "border border-slate-200"
      }`}
    >
      {featured ? (
        <span className="absolute right-6 top-6 rounded-full bg-[#ffd45a] px-3 py-1 text-xs font-bold text-[#574500]">
          Most popular
        </span>
      ) : null}
      <p className="text-sm font-bold uppercase tracking-wide text-slate-500">{name}</p>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-5xl font-extrabold text-[#041627]">{price}</span>
        {period ? <span className="text-slate-500">{period}</span> : null}
      </div>
      <p className="mt-3 text-sm text-slate-600">{blurb}</p>
      <ul className="mb-8 mt-7 space-y-3">
        {features.map((item) => (
          <li key={item} className="flex items-start gap-3 text-slate-700">
            <Check size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
      <Link
        to="/dashboard"
        className={`group mt-auto flex h-12 w-full items-center justify-center gap-2 rounded-full font-bold transition-colors ${
          featured ? "bg-[#041627] text-white" : "border border-slate-300 bg-white text-[#041627] hover:border-slate-400"
        }`}
      >
        Start free
        <ArrowRight
          size={18}
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-1"
        />
      </Link>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="landing">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Signatis home">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#041627] text-white">
              <PenLine size={20} aria-hidden="true" />
            </span>
            <span className="wordmark text-xl text-[#041627]">Signatis</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#041627]">
              Features
            </a>
            <a href="#how" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#041627]">
              How it works
            </a>
            <a href="#pricing" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#041627]">
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="hidden text-sm font-semibold text-[#041627] transition-opacity hover:opacity-70 sm:inline"
            >
              Sign in
            </Link>
            <Link
              to="/dashboard"
              className="landing-lift inline-flex h-10 items-center gap-1.5 rounded-full bg-[#041627] px-5 text-sm font-bold text-white"
            >
              Start free
            </Link>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="landing-hero-wash" aria-hidden="true" />
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-6 pt-16 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24 lg:pb-28">
          <div>
            <span
              className="hero-rise inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600"
              style={{ animationDelay: "40ms" }}
            >
              <Sparkles size={14} className="text-[#b8860b]" aria-hidden="true" />
              Built for Malaysian property agents
            </span>

            <h1
              className="hero-rise mt-6 text-4xl font-bold leading-[1.05] text-[#041627] sm:text-5xl lg:text-6xl"
              style={{ animationDelay: "120ms" }}
            >
              Know which leads
              <br />
              are ready to buy.
            </h1>

            <p
              className="hero-rise mt-6 max-w-xl text-lg leading-relaxed text-slate-600"
              style={{ animationDelay: "220ms" }}
            >
              Signatis scores every portal inquiry and writes the property report that wins the viewing, so you spend
              your day on the buyers who convert.
            </p>

            <div
              className="hero-rise mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={{ animationDelay: "320ms" }}
            >
              <PrimaryCta to="/dashboard">Start free</PrimaryCta>
              <a
                href="#how"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 font-semibold text-[#041627] transition-colors hover:border-slate-400"
              >
                See how it works
              </a>
            </div>

            <p className="hero-rise mt-5 text-sm text-slate-500" style={{ animationDelay: "420ms" }}>
              No card required. Free while you set up your first pipeline.
            </p>
          </div>

          {/* Real product preview floating over a KL property visual */}
          <Reveal>
            <div className="relative">
              <img
                src={IMG.skyline}
                alt="Kuala Lumpur skyline at dusk"
                className="landing-card-shadow h-52 w-full rounded-3xl object-cover object-[50%_28%] sm:h-64"
              />
              <div className="landing-card-shadow relative z-10 mx-4 -mt-16 rounded-2xl border border-slate-200 bg-white p-5 sm:mx-6">
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge size={18} className="text-[#041627]" aria-hidden="true" />
                  <span className="font-bold text-[#041627]">Lead pipeline</span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Live
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { label: "Leads scored", to: 1284, decimals: 0 },
                  { label: "Avg intent", to: 0.62, decimals: 2 },
                  { label: "Reports", to: 96, decimals: 0 },
                ].map((tile) => (
                  <div key={tile.label} className="rounded-xl bg-slate-50 p-3.5">
                    <p className="text-2xl font-extrabold text-[#041627]">
                      <Count to={tile.to} decimals={tile.decimals} />
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{tile.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2.5">
                {[
                  { name: "Aisyah Rahman", area: "Mont Kiara condo", intent: 1, fill: 86 },
                  { name: "Wei Jian Tan", area: "Bangsar South", intent: 1, fill: 71 },
                  { name: "Praveen Kumar", area: "Cyberjaya link", intent: 0, fill: 28 },
                ].map((lead) => (
                  <div
                    key={lead.name}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ffd45a] text-sm font-bold text-[#574500]">
                      {lead.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#041627]">{lead.name}</p>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="bar-fill h-full w-full rounded-full bg-[#041627]"
                          style={{ "--fill": lead.fill / 100 } as CSSProperties}
                        />
                      </div>
                    </div>
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-lg text-base font-bold ${
                        lead.intent === 1 ? "bg-[#fff7df] text-[#574500]" : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {lead.intent}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-slate-400">Sample workspace</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-y border-slate-200 bg-slate-50/60">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-center text-sm font-medium text-slate-500">Plugs into the portals you already use</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
            {portals.map((portal) => (
              <div key={portal.name} className="flex items-center gap-2.5">
                <span
                  className="grid h-9 w-9 place-items-center rounded-lg text-lg font-black text-white"
                  style={{ backgroundColor: portal.color }}
                >
                  {portal.mark}
                </span>
                <span className="text-base font-bold text-slate-700">{portal.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURE 1: scoring (text left / visual right) */}
      <section id="features" className="scroll-mt-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <Reveal>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#041627] text-white">
              <Users size={22} aria-hidden="true" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-[#041627] sm:text-4xl">
              Score every inquiry the moment it lands.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">
              Opens, clicks, report views and the tone of each message roll into one clear intent score. Hot leads rise
              to the top automatically, so the next call is never a guess.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                "A single intent score from real behaviour, not a hunch",
                "Hot, warm and cold tiers you can filter in one click",
                "Sentiment read on every inbound message",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-700">
                  <Check size={20} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={80}>
            <div className="landing-card-shadow rounded-2xl border border-slate-200 bg-white p-6">
              <div className="space-y-3">
                {[
                  { name: "Aisyah Rahman", tier: "Hot", score: 86, tone: "bg-amber-100 text-amber-800" },
                  { name: "Wei Jian Tan", tier: "Hot", score: 71, tone: "bg-amber-100 text-amber-800" },
                  { name: "Nurul Hidayah", tier: "Warm", score: 48, tone: "bg-blue-100 text-blue-800" },
                  { name: "Lim Chee Kong", tier: "Cold", score: 19, tone: "bg-slate-100 text-slate-600" },
                ].map((row) => (
                  <div key={row.name} className="flex items-center gap-4">
                    <span className="w-32 shrink-0 truncate text-sm font-semibold text-[#041627]">{row.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="bar-fill h-full w-full rounded-full bg-[#041627]"
                        style={{ "--fill": row.score / 100 } as CSSProperties}
                      />
                    </div>
                    <span className={`w-14 shrink-0 rounded-full py-0.5 text-center text-xs font-bold ${row.tone}`}>
                      {row.tier}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FEATURE 2: reports (visual left / text right) */}
      <section className="bg-slate-50/60">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <Reveal className="order-2 lg:order-1" delay={80}>
            <div className="landing-card-shadow overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <img
                src={IMG.villa}
                alt="Modern villa exterior with pool"
                className="h-44 w-full object-cover"
                loading="lazy"
              />
              <div className="p-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#041627] text-white">
                    <FileText size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report ready</p>
                    <p className="font-bold text-[#041627]">Residensi Mont Kiara, KL</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { label: "Pricing trend", value: "Holding firm" },
                    { label: "Buyer sentiment", value: "Active" },
                    { label: "Confidence", value: "88%" },
                    { label: "Sources", value: "3 cited" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-slate-50 p-3.5">
                      <p className="text-xs font-semibold text-slate-500">{stat.label}</p>
                      <p className="mt-1 font-bold text-[#041627]">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal className="order-1 lg:order-2">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#041627] text-white">
              <BarChart3 size={22} aria-hidden="true" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-[#041627] sm:text-4xl">
              Send a property report that wins the viewing.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">
              Type a property name and Signatis pulls comparable listings, pricing signals and neighbourhood data into a
              clean, cited report. Export a PDF or share a client-ready link in seconds.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                "Comparable pricing from PropertyGuru and iProperty",
                "Neighbourhood ratings from Google Places",
                "Shareable link with read tracking, plus PDF export",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-700">
                  <Check size={20} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* CAPABILITIES BENTO (breaks the zigzag pattern) */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <Reveal>
          <h2 className="max-w-2xl text-3xl font-bold text-[#041627] sm:text-4xl">
            Everything between the first inquiry and the signed offer.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {/* Wide navy feature cell */}
          <Reveal className="md:col-span-2">
            <div className="landing-lift relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-[#041627] p-7 text-white">
              <img
                src={IMG.towers}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover opacity-25"
                loading="lazy"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-[#041627] via-[#041627]/85 to-[#041627]/55"
                aria-hidden="true"
              />
              <MessageCircle size={26} className="relative z-10 text-[#ffd45a]" aria-hidden="true" />
              <div className="relative z-10 mt-10">
                <h3 className="text-2xl font-bold text-white">Reach leads on the channel they actually answer.</h3>
                <p className="mt-3 max-w-md text-slate-300">
                  WhatsApp, Telegram, Messenger, Instagram, email or a call. One outreach button picks the prospect's
                  preferred channel for you.
                </p>
              </div>
            </div>
          </Reveal>

          {/* Gold-tinted cell */}
          <Reveal delay={60}>
            <div className="landing-lift flex h-full flex-col justify-between rounded-2xl border border-amber-200 bg-[#fff8e5] p-7">
              <Mail size={26} className="text-[#b8860b]" aria-hidden="true" />
              <div className="mt-10">
                <h3 className="text-xl font-bold text-[#041627]">Inbox to pipeline, automatically.</h3>
                <p className="mt-3 text-slate-700">
                  Forward portal emails to your Signatis address and every inquiry becomes a scored lead.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={60}>
            <div className="landing-lift flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7">
              <Sparkles size={26} className="text-[#041627]" aria-hidden="true" />
              <div className="mt-10">
                <h3 className="text-xl font-bold text-[#041627]">Sentiment on every message.</h3>
                <p className="mt-3 text-slate-600">
                  Know whether a prospect sounds keen or hesitant before you reply.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal className="md:col-span-2" delay={120}>
            <div className="landing-lift flex h-full items-center justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-7">
              <div>
                <ShieldCheck size={26} className="text-emerald-600" aria-hidden="true" />
                <h3 className="mt-5 text-xl font-bold text-[#041627]">Transparent and PDPA-minded by design.</h3>
                <p className="mt-3 max-w-md text-slate-600">
                  A clear binary score, no dark patterns, and data scoped to your account. Your clients can trust how
                  the numbers were reached.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* HOW IT WORKS (real 3-step sequence) */}
      <section id="how" className="scroll-mt-24 bg-slate-50/60">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
          <Reveal>
            <h2 className="text-center text-3xl font-bold text-[#041627] sm:text-4xl">Up and running in an afternoon</h2>
          </Reveal>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Connect your portals",
                body: "Point your PropertyGuru, iProperty, Mudah or EdgeProp lead emails at your Signatis address.",
              },
              {
                step: "02",
                title: "Let leads score themselves",
                body: "Every inquiry is scored and tiered as it arrives. Your pipeline sorts the buyers for you.",
              },
              {
                step: "03",
                title: "Report, send, close",
                body: "Generate a cited property report and send it on the prospect's preferred channel.",
              },
            ].map((item, index) => (
              <Reveal key={item.step} delay={index * 80}>
                <div className="landing-lift relative h-full rounded-2xl border border-slate-200 bg-white p-7">
                  <span className="text-sm font-black text-[#ffd45a]">{item.step}</span>
                  <h3 className="mt-3 text-xl font-bold text-[#041627]">{item.title}</h3>
                  <p className="mt-3 text-slate-600">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="grid gap-6 md:grid-cols-2">
          {[
            {
              quote:
                "I used to chase every lead the same way. Now I see who is actually ready and my viewings convert far more often.",
              name: "Aisyah Rahman",
              role: "Agent, Kuala Lumpur",
            },
            {
              quote:
                "The property reports look like something a research desk made. Clients reply faster when I send the share link.",
              name: "Wei Jian Tan",
              role: "Negotiator, Petaling Jaya",
            },
          ].map((item) => (
            <Reveal key={item.name}>
              <figure className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-8">
                <div className="flex gap-1 text-[#ffd45a]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={18} className="fill-current" aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="mt-5 flex-1 text-lg leading-relaxed text-[#1f2a36]">{item.quote}</blockquote>
                <figcaption className="mt-6">
                  <p className="font-bold text-[#041627]">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.role}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="scroll-mt-24 bg-slate-50/60">
        <div className="mx-auto max-w-2xl px-6 py-20 text-center lg:py-28">
          <Reveal>
            <h2 className="text-3xl font-bold text-[#041627] sm:text-4xl">One plan, everything included</h2>
            <p className="mt-4 text-lg text-slate-600">Start free while you set up. Upgrade when leads start closing.</p>
          </Reveal>

          <Reveal delay={80}>
            <div className="landing-card-shadow mx-auto mt-12 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-left">
              <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Professional</p>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-5xl font-extrabold text-[#041627]">RM 499</span>
                <span className="text-slate-500">/ month</span>
              </div>
              <ul className="mt-7 space-y-3">
                {[
                  "Unlimited property reports",
                  "Real-time lead scoring and tiers",
                  "Multi-channel outreach",
                  "Email lead ingestion",
                  "Priority support",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-700">
                    <Check size={18} className="shrink-0 text-emerald-600" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/dashboard"
                className="landing-lift group mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#041627] font-bold text-white"
              >
                Start free
                <ArrowRight
                  size={18}
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>
            </div>
          </Reveal>
          <p className="mt-6 text-sm text-slate-500">
            Running a team?{" "}
            <a href="mailto:hello@signatis.app" className="font-semibold text-[#041627] underline underline-offset-2">
              Talk to us
            </a>
          </p>
        </div>
      </section>

      {/* FINAL CTA (deliberate dark color block) */}
      <section className="relative overflow-hidden bg-[#041627]">
        <img
          src={IMG.skylineWide}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-20"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-[#041627]/70" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 text-center lg:py-24">
          <Reveal>
            <h2 className="mx-auto max-w-2xl text-3xl font-bold text-white sm:text-4xl">
              Spend your day on the buyers who convert.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
              Connect your first portal and watch your pipeline sort itself.
            </p>
            <div className="mt-9 flex justify-center">
              <Link
                to="/dashboard"
                className="landing-lift group inline-flex h-12 items-center gap-2 rounded-full bg-[#ffd45a] px-7 font-bold text-[#574500]"
              >
                Start free
                <ArrowRight
                  size={18}
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <Link to="/" className="flex items-center gap-2.5" aria-label="Signatis home">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#041627] text-white">
                <PenLine size={20} aria-hidden="true" />
              </span>
              <span className="wordmark text-xl text-[#041627]">Signatis</span>
            </Link>
            <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-slate-600">
              <a href="#features" className="transition-colors hover:text-[#041627]">
                Features
              </a>
              <a href="#how" className="transition-colors hover:text-[#041627]">
                How it works
              </a>
              <a href="#pricing" className="transition-colors hover:text-[#041627]">
                Pricing
              </a>
              <Link to="/legal-support" className="transition-colors hover:text-[#041627]">
                Legal and support
              </Link>
            </nav>
          </div>
          <div className="mt-10 flex flex-col gap-2 border-t border-slate-100 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Signatis. Real estate intelligence for Malaysian agents.</p>
            <p>Made in Malaysia.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
