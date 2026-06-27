"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type AppShellProps = {
  children: React.ReactNode;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "D" },
  { href: "/first-timers", label: "First Timers", icon: "+" },
  { href: "/evangelism", label: "Evangelism", icon: "E" },
  { href: "/workers/my-follow-ups", label: "My Follow-Ups", icon: "M" },
  { href: "/foundation-school", label: "Foundation", icon: "F" },
  { href: "/baptism", label: "Baptism", icon: "B" },
  { href: "/reports", label: "Reports", icon: "R" },
  { href: "/programmes", label: "Programmes", icon: "P" },
  { href: "/qr-code", label: "QR Codes", icon: "Q" },
  { href: "/workers", label: "Workers", icon: "W" },
];

function getPageTitle(pathname: string) {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/first-timers/")) return "First Timer Profile";
  if (pathname.startsWith("/first-timers")) return "First Timers";
  if (pathname.startsWith("/evangelism")) return "Evangelism";
  if (pathname.startsWith("/workers/my-follow-ups")) return "My Follow-Ups";
  if (pathname.startsWith("/workers")) return "Workers";
  if (pathname.startsWith("/foundation-school")) return "Foundation School";
  if (pathname.startsWith("/baptism")) return "Baptism";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/programmes")) return "Programmes";
  if (pathname.startsWith("/qr-code")) return "QR Codes";
  return "WelCare";
}

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/workers/login");
  }

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname.startsWith(href);
  }

  const pageTitle = getPageTitle(pathname);

  return (
    <main className="app-shell min-h-screen">
      <aside
        className={`app-sidebar fixed left-0 top-0 z-50 hidden h-screen transition-[width] duration-200 lg:flex lg:flex-col ${
          sidebarCollapsed ? "w-[84px]" : "w-[276px]"
        }`}
      >
        <div className={`px-4 py-4 ${sidebarCollapsed ? "px-3" : ""}`}>
          <div
            className={`flex items-center gap-2 ${
              sidebarCollapsed ? "flex-col justify-center" : "justify-between"
            }`}
          >
            <Link
              href="/dashboard"
              className={`brand-card flex min-w-0 items-center gap-3 ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
              title={sidebarCollapsed ? "WelCare" : undefined}
              aria-label={sidebarCollapsed ? "WelCare dashboard" : undefined}
            >
            <div className="relative h-11 w-11 overflow-hidden rounded-2xl border border-white/10 bg-white shadow-lg shadow-blue-500/10">
              <Image
                src="/image/welcare-logo.png"
                alt="WelCare logo"
                fill
                sizes="44px"
                className="object-contain p-1.5"
                priority
              />
            </div>

            <div className={sidebarCollapsed ? "hidden" : ""}>
              <p className="font-display text-[1.08rem] font-black leading-none tracking-tight text-white">
                WelCare
              </p>
              <p className="mt-1 text-[0.72rem] font-semibold text-slate-400">
                Church care system
              </p>
            </div>
            </Link>

            <button
              type="button"
              onClick={() => setSidebarCollapsed((current) => !current)}
              className="sidebar-collapse-btn"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? ">" : "<"}
            </button>
          </div>
        </div>

        <nav
          className={`flex-1 space-y-1 py-2 ${
            sidebarCollapsed ? "px-3" : "px-3"
          }`}
        >
          <p
            className={`px-3 pb-2 text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500 ${
              sidebarCollapsed ? "hidden" : ""
            }`}
          >
            Workspace
          </p>

          {navItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={sidebarCollapsed ? item.label : undefined}
                aria-label={sidebarCollapsed ? item.label : undefined}
                className={`sidebar-link group ${
                  sidebarCollapsed ? "justify-center" : ""
                } ${active ? "sidebar-link-active" : ""}`}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                <span className={sidebarCollapsed ? "hidden" : ""}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div
        className={`app-content transition-[padding] duration-200 ${
          sidebarCollapsed ? "lg:pl-[84px]" : "lg:pl-[276px]"
        }`}
      >
        <header className="app-topbar sticky top-0 z-40">
          <div className="hidden items-center justify-between gap-4 px-5 py-3 lg:flex">
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-[var(--text-faint)]">
                WelCare
              </p>
              <h1 className="font-display text-[1.25rem] font-black leading-tight text-[var(--text-main)]">
                {pageTitle}
              </h1>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <div className="top-search hidden max-w-md flex-1 items-center gap-2 rounded-2xl px-3 py-2 xl:flex">
                <span className="text-[0.86rem] text-[var(--text-faint)]">
                  Search
                </span>
                <input
                  aria-label="Search placeholder"
                  className="w-full bg-transparent text-[0.82rem] font-semibold text-[var(--text-soft)] outline-none placeholder:text-[var(--text-faint)]"
                  placeholder="Use page filters to search records"
                  readOnly
                />
              </div>

              <Link href="/qr-code" className="topbar-button hidden md:inline-flex">
                QR Codes
              </Link>

              <Link href="/welcome" className="topbar-button hidden md:inline-flex">
                Public Form
              </Link>

              <button onClick={handleLogout} className="topbar-button-danger">
                Logout
              </button>
            </div>
          </div>

          <div className="lg:hidden">
            <div className="flex items-center justify-between px-3 py-3">
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-white/10 bg-white">
                  <Image
                    src="/image/welcare-logo.png"
                    alt="WelCare logo"
                    fill
                    sizes="36px"
                    className="object-contain p-1"
                    priority
                  />
                </div>

                <div>
                  <p className="font-display text-sm font-black leading-none text-[var(--text-main)]">
                    WelCare
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                    Church care system
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-2">
                <button onClick={handleLogout} className="topbar-button-danger">
                  Logout
                </button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto border-t border-white/10 px-3 py-2">
              {navItems.map((item) => {
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`mobile-nav-chip ${active ? "mobile-nav-chip-active" : ""}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-3 py-4 md:px-5 md:py-5">
          {children}
        </section>
      </div>
    </main>
  );
}


