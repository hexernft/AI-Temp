"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  PlugZap,
  ServerCog,
  Settings,
  ShoppingBag,
  Smartphone,
  Store,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
  Webhook,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

type Profile = {
  id: string;
  role: string | null;
  business_id: string | null;
  school_id: string | null;
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  adminOnly?: boolean;
  businessOnly?: boolean;
  schoolOnly?: boolean;
  allowedRoles?: string[];
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        label: "Activity",
        href: "/dashboard/activity",
        icon: Activity,
      },
    ],
  },
  {
    label: "Business",
    items: [
      {
        label: "Analytics",
        href: "/dashboard/analytics",
        icon: BarChart3,
        businessOnly: true,
      },
      {
        label: "Business Profile",
        href: "/dashboard/business-profile",
        icon: Store,
        businessOnly: true,
      },
      {
        label: "Chats",
        href: "/dashboard/conversations",
        icon: MessageCircle,
        businessOnly: true,
      },
      {
        label: "Channels",
        href: "/dashboard/channels",
        icon: PlugZap,
        businessOnly: true,
      },
      {
        label: "Customers",
        href: "/dashboard/customers",
        icon: UsersRound,
        businessOnly: true,
      },
      {
        label: "Instagram",
        href: "/dashboard/instagram",
        icon: MessageCircle,
        businessOnly: true,
      },
      {
        label: "Orders",
        href: "/dashboard/orders",
        icon: ShoppingBag,
        businessOnly: true,
      },
      {
        label: "Handoff",
        href: "/dashboard/handoff",
        icon: AlertTriangle,
        businessOnly: true,
      },
    ],
  },
  {
    label: "AI",
    items: [
      {
        label: "Knowledge",
        href: "/dashboard/knowledge",
        icon: BookOpen,
        businessOnly: true,
      },
      {
        label: "AI Test",
        href: "/dashboard/ai-test",
        icon: Bot,
        businessOnly: true,
      },
      {
        label: "AI Settings",
        href: "/dashboard/ai-settings",
        icon: Settings,
        businessOnly: true,
      },
    ],
  },
  {
    label: "School",
    items: [
      {
        label: "School Profile",
        href: "/dashboard/school-profile",
        icon: GraduationCap,
        schoolOnly: true,
      },
      {
        label: "Pupils",
        href: "/dashboard/pupils",
        icon: UserRound,
        schoolOnly: true,
      },
      {
        label: "School AI Test",
        href: "/dashboard/school-ai-test",
        icon: Bot,
        schoolOnly: true,
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        label: "Team",
        href: "/dashboard/team",
        icon: UserPlus,
        allowedRoles: ["business_owner", "school_admin"],
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        label: "Businesses",
        href: "/dashboard/businesses",
        icon: Building2,
        adminOnly: true,
      },
      {
        label: "Schools",
        href: "/dashboard/schools",
        icon: GraduationCap,
        adminOnly: true,
      },
      {
        label: "Users",
        href: "/dashboard/users",
        icon: Users,
        adminOnly: true,
      },
      {
        label: "WhatsApp Numbers",
        href: "/dashboard/whatsapp-numbers",
        icon: Smartphone,
        adminOnly: true,
      },
      {
        label: "Webhook Test",
        href: "/dashboard/webhook-test",
        icon: Webhook,
        adminOnly: true,
      },
      {
        label: "System Health",
        href: "/dashboard/system-health",
        icon: ServerCog,
        adminOnly: true,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        label: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
      },
    ],
  },
];

const allNavItems = navSections.flatMap((section) => section.items);

function getRoleType(role?: string | null) {
  const isSuperAdmin = role === "super_admin";
  const isSchoolUser = role === "school_admin" || role === "teacher";
  const isBusinessUser = role === "business_owner" || role === "staff";

  return {
    isSuperAdmin,
    isSchoolUser,
    isBusinessUser,
  };
}

function canSeeItem(item: NavItem, profile: Profile | null) {
  const role = profile?.role || null;
  const { isSuperAdmin, isBusinessUser, isSchoolUser } = getRoleType(role);

  if (item.allowedRoles && !item.allowedRoles.includes(role || "")) {
    return false;
  }

  if (item.adminOnly && !isSuperAdmin) {
    return false;
  }

  if (item.businessOnly && !isBusinessUser) {
    return false;
  }

  if (item.schoolOnly && !isSchoolUser) {
    return false;
  }

  return true;
}

function getDashboardLabel(role?: string | null) {
  if (role === "super_admin") {
    return {
      title: "Admin Center",
      initials: "AD",
    };
  }

  if (role === "school_admin" || role === "teacher") {
    return {
      title: "School Center",
      initials: "SC",
    };
  }

  return {
    title: "Business Center",
    initials: "BC",
  };
}

function pathMatchesItem(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getRestrictedItem(pathname: string, profile: Profile) {
  return allNavItems.find((item) => {
    const matches = pathMatchesItem(pathname, item.href);

    if (!matches) return false;

    return !canSeeItem(item, profile);
  });
}

function getTheme(role?: string | null) {
  if (role === "school_admin" || role === "teacher") {
    return {
      appBg:
        "bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.14),transparent_34%),linear-gradient(135deg,#020617_0%,#1e1238_45%,#111827_100%)]",
      sidebarBg:
        "bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(39,18,72,0.98)_52%,rgba(2,6,23,0.98)_100%)]",
      sidebarBorder: "border-purple-400/10",
      logo: "bg-purple-500 text-white shadow-lg shadow-purple-500/20",
      active:
        "bg-purple-500 text-white shadow-lg shadow-purple-500/20 ring-1 ring-purple-300/20",
      hover: "hover:bg-purple-400/10 hover:text-purple-100",
      spinner: "text-purple-400",
      rail: "bg-purple-400",
      mobileActive: "bg-purple-500 text-white",
    };
  }

  if (role === "super_admin") {
    return {
      appBg:
        "bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_32%),linear-gradient(135deg,#020617_0%,#061726_45%,#111827_100%)]",
      sidebarBg:
        "bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(6,30,48,0.98)_52%,rgba(2,6,23,0.98)_100%)]",
      sidebarBorder: "border-sky-400/10",
      logo: "bg-sky-500 text-white shadow-lg shadow-sky-500/20",
      active:
        "bg-sky-500 text-white shadow-lg shadow-sky-500/20 ring-1 ring-sky-300/20",
      hover: "hover:bg-sky-400/10 hover:text-sky-100",
      spinner: "text-sky-400",
      rail: "bg-sky-400",
      mobileActive: "bg-sky-500 text-white",
    };
  }

  return {
    appBg:
      "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_32%),linear-gradient(135deg,#020617_0%,#05251c_45%,#111827_100%)]",
    sidebarBg:
      "bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(6,37,30,0.98)_52%,rgba(2,6,23,0.98)_100%)]",
    sidebarBorder: "border-emerald-400/10",
    logo: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20",
    active:
      "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-300/20",
    hover: "hover:bg-emerald-400/10 hover:text-emerald-100",
    spinner: "text-emerald-400",
    rail: "bg-emerald-400",
    mobileActive: "bg-emerald-500 text-white",
  };
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const visibleSections = useMemo(() => {
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => canSeeItem(item, profile)),
      }))
      .filter((section) => section.items.length > 0);
  }, [profile]);

  const mobileItems = useMemo(() => {
    return visibleSections.flatMap((section) => section.items);
  }, [visibleSections]);

  const dashboardLabel = getDashboardLabel(profile?.role);
  const theme = getTheme(profile?.role);

  useEffect(() => {
    const saved = window.localStorage.getItem("dashboard-sidebar-collapsed");

    if (saved === "true") {
      setIsCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "dashboard-sidebar-collapsed",
      String(isCollapsed)
    );
  }, [isCollapsed]);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!data.session) {
        window.location.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, business_id, school_id")
        .eq("id", data.session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profileError || !profileData) {
        await supabase.auth.signOut();
        window.location.replace("/login?error=profile_missing");
        return;
      }

      const restrictedItem = getRestrictedItem(pathname, profileData);

      if (restrictedItem) {
        window.location.replace("/dashboard");
        return;
      }

      setProfile(profileData);
      setIsChecking(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        window.location.replace("/login");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname]);

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await supabase.auth.signOut();
      window.location.replace("/login");
    } catch {
      setIsLoggingOut(false);
    }
  }

  if (isChecking) {
    return (
      <main
        className={`flex min-h-screen items-center justify-center px-4 text-white ${theme.appBg}`}
      >
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-4 shadow-2xl backdrop-blur">
          <Loader2 className={`h-5 w-5 animate-spin ${theme.spinner}`} />
          <span className="text-sm text-slate-300">Preparing dashboard...</span>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell dashboard-reference-dark min-h-screen text-white">
      <aside
        className={`app-sidebar fixed left-0 top-0 z-40 hidden h-screen transition-all duration-300 xl:flex xl:flex-col ${
          isCollapsed ? "w-[5.5rem]" : "w-[19rem]"
        }`}
      >
        <div className="border-b border-white/10 p-4">
          <div
            className={`flex items-center ${
              isCollapsed ? "justify-center" : "justify-between gap-3"
            }`}
          >
            <Link
              href="/dashboard"
              className={`brand-card group flex min-w-0 items-center ${
                isCollapsed ? "justify-center p-3" : "gap-3 p-3"
              }`}
              title={isCollapsed ? dashboardLabel.title : undefined}
            >
              <div
                className="brand-mark flex h-11 w-11 shrink-0 items-center justify-center text-xs font-black"
              >
                {dashboardLabel.initials}
              </div>

              {!isCollapsed ? (
                <>
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-sm font-bold tracking-tight">
                      {dashboardLabel.title}
                    </h1>
                  </div>

                  <ChevronRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
                </>
              ) : null}
            </Link>

            {!isCollapsed ? (
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400 transition hover:bg-white/10 hover:text-white"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {isCollapsed ? (
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="mx-auto mt-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400 transition hover:bg-white/10 hover:text-white"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <nav
          className={`flex-1 overflow-y-auto py-5 ${
            isCollapsed ? "px-3" : "space-y-6 px-4"
          }`}
        >
          {visibleSections.map((section) => (
            <div key={section.label} className={isCollapsed ? "mb-3" : ""}>
              {!isCollapsed ? (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {section.label}
                </p>
              ) : (
                <div className="mx-auto mb-2 h-px w-8 bg-white/10" />
              )}

              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;

                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={`${section.label}-${item.href}-${item.label}`}
                      href={item.href}
                      title={isCollapsed ? item.label : undefined}
                      className={`sidebar-link group relative flex items-center ${
                        isCollapsed
                          ? "h-12 justify-center px-0"
                          : "gap-3 px-3 py-2.5"
                      } ${
                        isActive
                          ? "sidebar-link-active"
                          : ""
                      }`}
                    >
                      {isActive ? (
                        <span
                          className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-white/90"
                        />
                      ) : null}

                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isActive
                            ? "text-white"
                            : "text-slate-500 group-hover:text-current"
                        }`}
                      />

                      {!isCollapsed ? (
                        <>
                          <span className="flex-1">{item.label}</span>
                          {isActive ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                          ) : null}
                        </>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            title={isCollapsed ? "Logout" : undefined}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 text-sm font-medium text-red-200 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-60 ${
              isCollapsed ? "h-12 px-0" : "px-4 py-3"
            }`}
          >
            {isLoggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}

            {!isCollapsed ? <span>Logout</span> : null}
          </button>
        </div>
      </aside>

      <header
        className="app-topbar sticky top-0 z-30 px-4 py-3 xl:hidden"
      >
        <div className="mb-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div
              className="brand-mark flex h-10 w-10 items-center justify-center text-xs font-black"
            >
              {dashboardLabel.initials}
            </div>

            <p className="text-sm font-bold">{dashboardLabel.title}</p>
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400">
              <Menu className="h-4 w-4" />
            </div>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200 disabled:opacity-60"
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Logout
            </button>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-1">
          {mobileItems.map((item) => {
            const Icon = item.icon;

            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={`mobile-nav-chip flex shrink-0 items-center gap-2 ${
                  isActive
                    ? "mobile-nav-chip-active"
                    : ""
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div
        className={`transition-all duration-300 ${
          isCollapsed ? "xl:pl-[5.5rem]" : "xl:pl-[19rem]"
        }`}
      >
        <div className="min-h-screen">{children}</div>
      </div>
    </div>
  );
}