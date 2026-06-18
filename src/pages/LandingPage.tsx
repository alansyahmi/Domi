import {
  ArrowRight,
  BarChart3,
  ChevronRight,
  Clock3,
  Mail,
  MessageSquareText,
  Sparkles,
  Target,
  Workflow,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { SignatisAuthMode } from "../lib/auth-mode";

const logoUrl = new URL("../../logo.png", import.meta.url).href;

const heroStats = [
  { label: "Leads scored", value: "1,284" },
  { label: "Qualified intent", value: "62%" },
  { label: "Reports sent", value: "96" },
];

const featureCards = [
  {
    icon: Target,
    title: "Lead intelligence",
    body: "Sort every inquiry by intent so your next call starts with the prospects most likely to move.",
  },
  {
    icon: BarChart3,
    title: "Client-ready reports",
    body: "Turn a property name into a clean, cited report with the context clients need to say yes.",
  },
  {
    icon: Workflow,
    title: "One simple workflow",
    body: "Capture, qualify, follow up and present, without stitching together a dozen tools.",
  },
];

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
      { threshold: 0.18 },
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

function Count({ to, suffix = "" }: { to: number; suffix?: string }) {
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
          const progress = Math.min((now - startTime) / 1000, 1);
          const eased = 1 - Math.pow(1 - progress, 4);
          setValue(to * eased);
          if (progress < 1) frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to]);

  return (
    <span ref={ref}>
      {Math.round(value).toLocaleString()}
      {suffix}
    </span>
  );
}

function PrimaryButton({
  to,
  children,
  onClick,
  reloadDocument,
  accent = false,
}: {
  to: string;
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  reloadDocument?: boolean;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      reloadDocument={reloadDocument}
      className={`reai-button ${accent ? "reai-button-accent" : "reai-button-ghost"}`}
    >
      <span>{children}</span>
      <ArrowRight size={17} aria-hidden="true" />
    </Link>
  );
}

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`reai-brand-lockup ${compact ? "reai-brand-lockup-compact" : ""}`}>
      <img src={logoUrl} alt="" aria-hidden="true" className="reai-logo-mark" />
      <div className="reai-brand-copy">
        <span className="reai-brand-name">re:AI</span>
        <span className="reai-brand-tag">Real estate intelligence</span>
      </div>
    </div>
  );
}

export default function LandingPage({ authMode }: { authMode: SignatisAuthMode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (authMode === "demo") {
      const loggedIn = sessionStorage.getItem("demo_logged_in") !== "false";
      setIsAuthenticated(loggedIn);
      return;
    }

    fetch("/api/me")
      .then((res) => setIsAuthenticated(res.ok))
      .catch(() => setIsAuthenticated(false));
  }, [authMode]);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 6);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const loginUrl = "/login?prompt=login";

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (authMode === "demo") {
      sessionStorage.setItem("demo_logged_in", "false");
      setIsAuthenticated(false);
      navigate("/");
      return;
    }

    try {
      const csrfResp = await fetch("/api/csrf-token");
      const { csrfToken } = await csrfResp.json();
      const resp = await fetch("/logout", {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        redirect: "manual",
      });

      if (resp.type === "opaqueredirect" || resp.status === 302) {
        const location = resp.headers.get("Location");
        if (location) {
          window.location.href = location;
          return;
        }
      }

      window.location.href = "/?logout=true";
    } catch {
      window.location.href = "/?logout=true";
    }
  };

  const handleCtaClick = (e: React.MouseEvent) => {
    if (authMode === "demo" && !isAuthenticated) {
      e.preventDefault();
      sessionStorage.setItem("demo_logged_in", "true");
      setIsAuthenticated(true);
      navigate("/dashboard");
    }
  };

  return (
    <div className="reai-landing">
      <div className="reai-backdrop" aria-hidden="true" />

      <header className={`reai-topbar ${isScrolled ? "is-scrolled" : ""}`}>
        <div className="reai-topbar-inner">
          <Link to="/" className="reai-brand-link" aria-label="re:AI home">
            <BrandLockup compact />
          </Link>

          <nav className="reai-topnav" aria-label="Primary">
            <a href="#why">Why re:AI</a>
            <a href="#workflow">Workflow</a>
            <a href="#contact">Contact</a>
          </nav>

          <div className="reai-topbar-actions">
            {isAuthenticated === null ? (
              <span className="reai-loading-text">Loading...</span>
            ) : isAuthenticated ? (
              <>
                <button className="reai-toplink" onClick={handleLogout} type="button">
                  Sign out
                </button>
                <PrimaryButton to="/dashboard" accent>
                  Dashboard
                </PrimaryButton>
              </>
            ) : (
              <>
                <PrimaryButton to={loginUrl} onClick={handleCtaClick}>
                  Sign in
                </PrimaryButton>
                <PrimaryButton to={loginUrl} onClick={handleCtaClick} accent reloadDocument={authMode !== "demo"}>
                  Start free
                </PrimaryButton>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="reai-hero-section">
          <div className="reai-shell reai-hero-grid">
            <div className="reai-hero-copy">
              <Reveal>
                <p className="reai-kicker">Launching soon - for agents</p>
              </Reveal>
              <Reveal delay={40}>
                <h1>Stop chasing leads that go nowhere.</h1>
              </Reveal>
              <Reveal delay={90}>
                <p className="reai-hero-text">
                  re:AI turns every portal inquiry into a clear signal, a useful follow-up, and a property report that
                  feels ready for a client meeting from the first glance.
                </p>
              </Reveal>
              <Reveal delay={140}>
                <div className="reai-hero-actions">
                  <PrimaryButton
                    to={isAuthenticated ? "/dashboard" : loginUrl}
                    onClick={handleCtaClick}
                    accent
                    reloadDocument={authMode !== "demo" && !isAuthenticated}
                  >
                    {isAuthenticated ? "Open dashboard" : "Start free"}
                  </PrimaryButton>
                  <a href="#why" className="reai-button reai-button-ghost">
                    <span>See the flow</span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </a>
                </div>
              </Reveal>
              <Reveal delay={180}>
                <p className="reai-caption">Built for Malaysian agents who want signal, not noise.</p>
              </Reveal>
            </div>

            <Reveal className="reai-hero-panel-wrap" delay={80}>
              <section className="reai-hero-panel" aria-label="Brand preview">
                <div className="reai-hero-panel-top">
                  <BrandLockup />
                  <span className="reai-live-pill">
                    <span className="reai-live-dot" />
                    Launch mode
                  </span>
                </div>

                <div className="reai-bars" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>

                <div className="reai-hero-stats">
                  {heroStats.map((stat) => (
                    <article key={stat.label} className="reai-stat-card">
                      <span className="reai-stat-value">{stat.value}</span>
                      <span className="reai-stat-label">{stat.label}</span>
                    </article>
                  ))}
                </div>

              <div className="reai-hero-metrics">
                <div>
                  <span className="reai-metric-label">Best time saved</span>
                  <span className="reai-metric-value">14m</span>
                </div>
                <div>
                  <span className="reai-metric-label">Lead clarity</span>
                  <span className="reai-metric-value">86%</span>
                </div>
              </div>
              </section>
            </Reveal>
          </div>
        </section>

        <section id="why" className="reai-section">
          <div className="reai-shell">
            <Reveal>
              <p className="reai-section-kicker">Why re:AI</p>
            </Reveal>
            <Reveal delay={30}>
              <h2>One calm place for the whole lead-to-close loop.</h2>
            </Reveal>
            <div className="reai-feature-grid">
              {featureCards.map((card, index) => (
                <Reveal key={card.title} delay={index * 70}>
                  <article className="reai-feature-card">
                    <card.icon size={22} aria-hidden="true" />
                    <h3>{card.title}</h3>
                    <p>{card.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="reai-section reai-section-tight">
          <div className="reai-shell">
            <Reveal>
              <p className="reai-section-kicker">Workflow</p>
            </Reveal>
            <Reveal delay={30}>
              <h2>Three steps. Less friction. Better conversations.</h2>
            </Reveal>
            <div className="reai-step-grid">
              {[
                {
                  step: "01",
                  title: "Inquiries land cleanly",
                  body: "Forward portal emails into re:AI and every new lead appears with context already attached.",
                  icon: Mail,
                },
                {
                  step: "02",
                  title: "Signals turn into intent",
                  body: "Open behaviour, report views and message tone combine into a lead score you can act on.",
                  icon: Sparkles,
                },
                {
                  step: "03",
                  title: "Reports move the deal forward",
                  body: "Generate a polished property report and send it by the channel your prospect actually uses.",
                  icon: MessageSquareText,
                },
              ].map((item, index) => (
                <Reveal key={item.step} delay={index * 80}>
                  <article className="reai-step-card">
                    <div className="reai-step-head">
                      <span className="reai-step-index">{item.step}</span>
                      <item.icon size={18} aria-hidden="true" />
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="reai-section reai-cta-section">
          <div className="reai-shell">
            <Reveal>
              <div className="reai-cta-card">
                <div>
                  <p className="reai-section-kicker">Ready when you are</p>
                  <h2>Spend your day with the buyers who are actually ready.</h2>
                </div>
                <div className="reai-cta-actions">
                  <PrimaryButton
                    to={isAuthenticated ? "/dashboard" : loginUrl}
                    onClick={handleCtaClick}
                    accent
                    reloadDocument={authMode !== "demo" && !isAuthenticated}
                  >
                    {isAuthenticated ? "Open dashboard" : "Start free"}
                  </PrimaryButton>
                  <a href="mailto:hello@re-ai.app" className="reai-toplink reai-mail-link">
                    hello@re-ai.app
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="reai-footer">
        <div className="reai-shell reai-footer-inner">
          <BrandLockup />
          <div className="reai-footer-links">
            <a href="#why">Why re:AI</a>
            <a href="#workflow">Workflow</a>
            <Link to="/legal-support">Legal & support</Link>
          </div>
          <p>© {new Date().getFullYear()} re:AI. Real estate intelligence for agents.</p>
        </div>
      </footer>
    </div>
  );
}
