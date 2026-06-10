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
  Users,
} from "lucide-react";
import { type ReactNode } from "react";
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="flex items-center gap-4">
          <div className="brand-mark">D</div>
          <div>
            <div className="text-2xl font-extrabold leading-tight text-[#041627]">Domi</div>
            <div className="text-sm text-slate-600">{agent.plan}</div>
          </div>
        </div>

        <nav className="mt-16 grid gap-2">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <item.icon size={25} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto grid gap-5">
          <Link to="/report-generator" className="primary-button w-full">
            <Plus size={20} aria-hidden="true" />
            New Property Report
          </Link>
          <div className="border-t border-slate-300 pt-5 flex items-center gap-3">
            <div className="avatar small topbar-avatar">{agent.avatarInitials}</div>
            <div className="min-w-0">
              <div className="font-extrabold truncate">{agent.fullName}</div>
              <div className="text-sm text-slate-600 truncate">{agent.email}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <BarChart3 size={24} className="text-[#041627] md:hidden" aria-hidden="true" />
            <div>
              <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-[#041627]">Domi</h1>
              <p className="m-0 text-sm text-slate-500 md:hidden">{activeLabel}</p>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-2 w-[28rem] rounded-full border border-slate-300 bg-white px-4 py-2">
            <Search size={20} className="text-slate-500" aria-hidden="true" />
            <span className="text-slate-500">Search leads, properties...</span>
          </div>
          <div className="topbar-actions flex items-center gap-2">
            {demoMode ? <span className="tag tag-blue demo-pill">Demo mode</span> : null}
            <button className="icon-button" aria-label="Notifications">
              <Bell size={22} aria-hidden="true" />
            </button>
            <button className="icon-button desktop-action" aria-label="Help">
              <HelpCircle size={22} aria-hidden="true" />
            </button>
            <button className="icon-button desktop-action" aria-label="Sign out" onClick={() => void onLogout()}>
              <LogOut size={21} aria-hidden="true" />
            </button>
            <div className="avatar small">{agent.avatarInitials}</div>
          </div>
        </header>

        {notice ? (
          <div className="mx-auto max-w-[92rem] px-4 md:px-10 pt-4">
            <div className="card border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">{notice}</div>
          </div>
        ) : null}

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
