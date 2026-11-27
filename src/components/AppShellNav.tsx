"use client";

import { Role } from "@prisma/client";
import {
  Activity,
  BookOpenCheck,
  ClipboardList,
  LayoutDashboard,
  Menu,
  MessageSquareWarning,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { Drawer } from "@/components/ui/Drawer";
import type { SessionUser } from "@/lib/auth";

export type NavIconKey =
  | "dashboard"
  | "users"
  | "audit"
  | "health"
  | "questions"
  | "exams"
  | "disputes";

const ICON_MAP: Record<NavIconKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  users: Users,
  audit: ScrollText,
  health: Activity,
  questions: BookOpenCheck,
  exams: ClipboardList,
  disputes: MessageSquareWarning,
};

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
  exact?: boolean;
}

const ROLE_ROOT: Record<Role, string> = {
  ADMIN: "/admin",
  EXAMINER: "/examiner",
  CANDIDATE: "/candidate",
};

function isNavActive(pathname: string, item: NavItem, role: Role): boolean {
  if (item.exact || item.href === ROLE_ROOT[role]) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SidebarContent({
  session,
  items,
  pathname,
  onNavigate,
}: {
  session: SessionUser;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <p className="truncate text-sm font-bold text-white">{session.name}</p>
        <p className="mt-0.5 truncate text-xs text-slate-300">{session.email}</p>
        <span className="mt-2.5 inline-block rounded-full border border-indigo-400/30 bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-indigo-200">
          {session.role}
        </span>
      </div>

      <nav aria-label={`${session.role.toLowerCase()} navigation`} className="mt-5 flex-1 space-y-1">
        {items.map((item) => {
          const Icon = ICON_MAP[item.icon];
          const active = isNavActive(pathname, item, session.role);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
              href={item.href}
              key={item.href}
              onClick={onNavigate}
            >
              <Icon aria-hidden="true" size={17} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-slate-800 pt-4">
        <LogoutButton />
      </div>
    </div>
  );
}

export function AppShellNav({
  session,
  items,
  children,
}: {
  session: SessionUser;
  items: NavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-indigo-700 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
        href="#main-content"
      >
        Skip to main content
      </a>

      {/* Mobile compact navigation header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3 text-white md:hidden">
        <Link className="flex items-center gap-2 text-base font-bold" href={ROLE_ROOT[session.role]}>
          <ShieldCheck aria-hidden="true" className="text-indigo-400" size={20} />
          <span>AegisExam</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-slate-200">
            {session.role}
          </span>
          <button
            aria-expanded={mobileOpen}
            aria-label="Open navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            onClick={() => setMobileOpen(true)}
            type="button"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* Desktop persistent sidebar */}
      <aside className="hidden bg-slate-950 p-5 text-slate-100 md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <Link className="mb-6 flex items-center gap-2.5 px-1 py-1 text-lg font-bold text-white" href="/">
          <ShieldCheck aria-hidden="true" className="text-indigo-400" size={21} />
          <span>AegisExam</span>
        </Link>
        <SidebarContent items={items} pathname={pathname} session={session} />
      </aside>

      {/* Mobile drawer navigation */}
      <Drawer
        closeLabel="Close navigation menu"
        eyebrow="Workspace"
        maxWidthClass="max-w-xs bg-slate-950 text-slate-100 border-slate-800"
        onClose={() => setMobileOpen(false)}
        open={mobileOpen}
        side="left"
        title="AegisExam Navigation"
      >
        <div className="-m-2 rounded-lg bg-slate-950 p-2 text-slate-100">
          <SidebarContent
            items={items}
            onNavigate={() => setMobileOpen(false)}
            pathname={pathname}
            session={session}
          />
        </div>
      </Drawer>

      <main className="min-w-0 p-4 sm:p-6 md:p-8 lg:p-10" id="main-content">
        {children}
      </main>
    </div>
  );
}
