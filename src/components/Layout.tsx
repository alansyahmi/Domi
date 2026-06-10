import {
  BarChart3,
  Bell,
  FileText,
  Gauge,
  Gavel,
  HelpCircle,
  Home,
  LogOut,
  Plus,
  Search,
  Settings,
  PenLine,
  Users,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import type { Agent } from "../types";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/report-generator", label: "Report Generator", icon: Home },
  { to: "/leads", label: "Lead Management", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/legal-support", label: "Legal & Support", icon: Gavel },
];

interface LayoutProps {
  agent: Agent;
  children: ReactNode;
  demoMode: boolean;
  notice: string | null;
  onLogout: () => void | Promise<void>;
}

export default function Layout({ agent, children, demoMode, notice, onLogout }: LayoutProps) {
  const location = useLocation();
  const activeLabel = navItems.find((item) => location.pathname.startsWith(item.to))?.label ?? "Dashboard";
  const [isScrolled, setIsScrolled] = useState(false);
  const [activePill, setActivePill] = useState({ left: 0, width: 0 });
  const navRef = useRef<HTMLElement | null>(null);
  const navLinkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    function updateTopbarState() {
      setIsScrolled(window.scrollY > 8);
    }

    updateTopbarState();
    window.addEventListener("scroll", updateTopbarState, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateTopbarState);
    };
  }, []);

  useEffect(() => {
    function updateActivePill() {
      const nav = navRef.current;
      const activeLink = navLinkRefs.current[activeLabel];

      if (!nav || !activeLink) return;

      const navBounds = nav.getBoundingClientRect();
      const linkBounds = activeLink.getBoundingClientRect();

      setActivePill({
        left: linkBounds.left - navBounds.left,
        width: linkBounds.width,
      });
    }

    updateActivePill();
    window.addEventListener("resize", updateActivePill);

    return () => {
      window.removeEventListener("resize", updateActivePill);
    };
  }, [activeLabel]);

  return (
    <div className="app-shell">
      <header className={`topbar ${isScrolled ? "scrolled" : ""}`}>
        <div className="topbar-container">
          {/* Left: Brand logo & motto */}
          <Link to="/dashboard" className="brand-group">
            <div className="brand-mark">
              <PenLine size={24} aria-hidden="true" />
            </div>
            <div className="brand-info">
              <span className="brand-name">Signatis</span>
              <span className="brand-plan">Signatis Tabulis</span>
            </div>
          </Link>

          {/* Center: Navigation Links (Desktop) */}
          <nav className="topbar-nav" aria-label="Desktop navigation" ref={navRef}>
            <span
              className="nav-active-pill"
              aria-hidden="true"
              style={{
                transform: `translate(${activePill.left}px, -50%)`,
                width: `${activePill.width}px`,
              }}
            />
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                ref={(element) => {
                  navLinkRefs.current[item.label] = element;
                }}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              >
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right: Actions, Search, Avatar */}
          <div className="topbar-actions">
            <div className="search-container">
              <Search size={18} className="search-icon" aria-hidden="true" />
              <span className="search-placeholder">Search...</span>
            </div>

            <button className="icon-button" aria-label="Notifications">
              <Bell size={20} aria-hidden="true" />
            </button>
            <button className="icon-button desktop-action" aria-label="Help">
              <HelpCircle size={20} aria-hidden="true" />
            </button>
            <button className="icon-button desktop-action" aria-label="Sign out" onClick={() => void onLogout()}>
              <LogOut size={20} aria-hidden="true" />
            </button>

            <div className="profile-group">
              <div className="avatar small topbar-avatar">{agent.avatarInitials}</div>
              <div className="profile-info">
                <div className="profile-name">{agent.fullName}</div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className="topbar-spacer" aria-hidden="true" />

      {notice ? (
        <div className="mx-auto max-w-368 px-4 md:px-10 pt-4">
          <div className="card border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">{notice}</div>
        </div>
      ) : null}

      <div className="main-area">
        {children}
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} aria-label={item.label}>
            <item.icon size={24} aria-hidden="true" />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
