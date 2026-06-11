"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  CheckCircle2,
  GraduationCap,
  Loader2,
  MessageCircle,
  NotebookPen,
  ServerCog,
  Settings,
  ShieldCheck,
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

type Profile = {
  id: string;
  role: string | null;
  business_id: string | null;
  school_id: string | null;
};

type QuickAction = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  ownerOnly?: boolean;
};

type WorkflowStep = {
  title: string;
  description: string;
};

const adminQuickActions: QuickAction[] = [
  {
    title: "Businesses",
    description: "Create and manage business workspaces.",
    href: "/dashboard/businesses",
    icon: Building2,
  },
  {
    title: "Schools",
    description: "Create and manage school workspaces.",
    href: "/dashboard/schools",
    icon: GraduationCap,
  },
  {
    title: "Users",
    description: "Create platform admins, business owners, and school admins.",
    href: "/dashboard/users",
    icon: Users,
  },
  {
    title: "WhatsApp Numbers",
    description: "Assign WhatsApp Cloud API numbers to workspaces.",
    href: "/dashboard/whatsapp-numbers",
    icon: Smartphone,
  },
  {
    title: "Webhook Test",
    description: "Test webhook setup and incoming platform events.",
    href: "/dashboard/webhook-test",
    icon: Webhook,
  },
  {
    title: "System Health",
    description: "Check API keys, environment variables, and setup readiness.",
    href: "/dashboard/system-health",
    icon: ServerCog,
  },
];

const businessQuickActions: QuickAction[] = [
  {
    title: "Analytics",
    description: "Track conversations, customers, orders, and handoffs.",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
  {
    title: "Business Profile",
    description: "Update contact details, location, and delivery settings.",
    href: "/dashboard/business-profile",
    icon: Store,
  },
  {
    title: "Team",
    description: "Create staff accounts for this workspace.",
    href: "/dashboard/team",
    icon: UserPlus,
    ownerOnly: true,
  },
  {
    title: "Chats",
    description: "Monitor WhatsApp chats and reply manually when needed.",
    href: "/dashboard/conversations",
    icon: MessageCircle,
  },
  {
    title: "Customers",
    description: "View customers captured from WhatsApp and Instagram conversations.",
    href: "/dashboard/customers",
    icon: UsersRound,
  },
  {
    title: "Instagram",
    description: "Connect Instagram DMs to the same AI knowledge base.",
    href: "/dashboard/instagram",
    icon: MessageCircle,
  },
  {
    title: "Orders",
    description: "Track order status, payment progress, and delivery updates.",
    href: "/dashboard/orders",
    icon: ShoppingBag,
  },
  {
    title: "Handoff",
    description: "Handle conversations that need human attention.",
    href: "/dashboard/handoff",
    icon: AlertTriangle,
  },
  {
    title: "Knowledge",
    description: "Add products, prices, FAQs, policies, and website imports.",
    href: "/dashboard/knowledge",
    icon: BookOpen,
  },
  {
    title: "AI Test",
    description: "Test how the assistant replies before customers see it.",
    href: "/dashboard/ai-test",
    icon: Bot,
  },
  {
    title: "AI Settings",
    description: "Control auto-reply, handoff, and fallback messages.",
    href: "/dashboard/ai-settings",
    icon: Settings,
  },
];

const schoolQuickActions: QuickAction[] = [
  {
    title: "School Profile",
    description: "View or update school contact details and notes.",
    href: "/dashboard/school-profile",
    icon: GraduationCap,
  },
  {
    title: "Pupils",
    description: "Create and manage pupil profiles for your school.",
    href: "/dashboard/pupils",
    icon: UserRound,
  },
  {
    title: "School AI Test",
    description: "Test guardian questions using pupil activity notes.",
    href: "/dashboard/school-ai-test",
    icon: Bot,
  },
  {
    title: "Team",
    description: "Create teacher accounts for this school.",
    href: "/dashboard/team",
    icon: UserPlus,
    ownerOnly: true,
  },
  {
    title: "Pupil Activity",
    description: "Add dated notes and activity details for pupils.",
    href: "/dashboard/pupils",
    icon: NotebookPen,
  },
  {
    title: "Guardian Access",
    description: "Assign two authorized phone numbers to each pupil.",
    href: "/dashboard/pupils",
    icon: ShieldCheck,
  },
  {
    title: "Settings",
    description: "Manage your account access and password.",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

const adminWorkflowSteps: WorkflowStep[] = [
  {
    title: "Create workspace",
    description: "Create either a business workspace or a school workspace.",
  },
  {
    title: "Assign admin",
    description: "Create a business owner or school admin for the workspace.",
  },
  {
    title: "Connect WhatsApp",
    description: "Assign WhatsApp numbers and Meta Phone Number IDs.",
  },
  {
    title: "Check system",
    description: "Confirm webhook, environment variables, and platform health.",
  },
];

const businessWorkflowSteps: WorkflowStep[] = [
  {
    title: "Update profile",
    description: "Confirm contact details, location, and delivery settings.",
  },
  {
    title: "Add knowledge",
    description: "Add products, prices, FAQs, delivery info, and policies.",
  },
  {
    title: "Test AI",
    description: "Preview replies before relying on automated responses.",
  },
  {
    title: "Monitor operations",
    description: "Track conversations, handoffs, customers, and orders.",
  },
];

const schoolWorkflowSteps: WorkflowStep[] = [
  {
    title: "Check profile",
    description: "Confirm school name, contact details, and location.",
  },
  {
    title: "Add pupils",
    description: "Create pupil profiles with class and notes.",
  },
  {
    title: "Authorize guardians",
    description: "Assign up to two phone numbers per pupil.",
  },
  {
    title: "Add activity notes",
    description: "Save dated school activity updates for guardians.",
  },
  {
    title: "Test replies",
    description: "Preview guardian replies before WhatsApp goes live.",
  },
];

function getRoleMode(role?: string | null) {
  if (role === "super_admin") return "admin";
  if (role === "school_admin" || role === "teacher") return "school";
  return "business";
}

function getPageTheme(mode: "admin" | "business" | "school") {
  if (mode === "admin") {
    return {
      page:
        "bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.13),transparent_30%),linear-gradient(135deg,#020617_0%,#061726_45%,#111827_100%)]",
      badge: "border-sky-400/20 bg-sky-400/10 text-sky-200",
      iconBox:
        "border-sky-400/20 bg-sky-400/10 text-sky-300 group-hover:bg-sky-500 group-hover:text-white",
      button: "bg-sky-500 text-white hover:bg-sky-400",
      text: "text-sky-300",
      number: "bg-sky-500 text-white",
      spinner: "text-sky-400",
    };
  }

  if (mode === "school") {
    return {
      page:
        "bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.15),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.12),transparent_34%),linear-gradient(135deg,#020617_0%,#1e1238_45%,#111827_100%)]",
      badge: "border-purple-400/20 bg-purple-400/10 text-purple-200",
      iconBox:
        "border-purple-400/20 bg-purple-400/10 text-purple-300 group-hover:bg-purple-500 group-hover:text-white",
      button: "bg-purple-500 text-white hover:bg-purple-400",
      text: "text-purple-300",
      number: "bg-purple-500 text-white",
      spinner: "text-purple-400",
    };
  }

  return {
    page:
      "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.13),transparent_30%),linear-gradient(135deg,#020617_0%,#05251c_45%,#111827_100%)]",
    badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    iconBox:
      "border-emerald-400/20 bg-emerald-400/10 text-emerald-300 group-hover:bg-emerald-500 group-hover:text-white",
    button: "bg-emerald-500 text-white hover:bg-emerald-400",
    text: "text-emerald-300",
    number: "bg-emerald-500 text-white",
    spinner: "text-emerald-400",
  };
}

function getPageCopy(mode: "admin" | "business" | "school") {
  if (mode === "admin") {
    return {
      title: "Admin Center",
      description:
        "Manage workspaces, users, WhatsApp numbers, and system setup.",
      badge: "Platform",
      recommendedHref: "/dashboard/system-health",
      recommendedLabel: "Check System Health",
      recommendedText:
        "Confirm platform readiness, then create workspaces and assign admins.",
    };
  }

  if (mode === "school") {
    return {
      title: "School Center",
      description:
        "Manage pupils, guardian access, activity notes, and school AI replies.",
      badge: "School Workspace",
      recommendedHref: "/dashboard/school-profile",
      recommendedLabel: "Check School Profile",
      recommendedText:
        "Start with the school profile, then add pupils and guardian numbers.",
    };
  }

  return {
    title: "Business Center",
    description:
      "Manage WhatsApp conversations, customers, orders, knowledge, and AI replies.",
    badge: "Business Workspace",
    recommendedHref: "/dashboard/business-profile",
    recommendedLabel: "Update Business Profile",
    recommendedText:
      "Start with the business profile, then add knowledge and test AI replies.",
  };
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session) {
        window.location.replace("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, role, business_id, school_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (!profileData) {
        await supabase.auth.signOut();
        window.location.replace("/login?error=profile_missing");
        return;
      }

      setProfile(profileData);
      setIsLoading(false);
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const mode = getRoleMode(profile?.role);
  const theme = getPageTheme(mode);
  const copy = getPageCopy(mode);

  const isAdmin = mode === "admin";
  const isSchool = mode === "school";
  const isBusinessOwner = profile?.role === "business_owner";
  const isSchoolAdmin = profile?.role === "school_admin";

  const quickActions = useMemo(() => {
    if (isAdmin) return adminQuickActions;

    if (isSchool) {
      return schoolQuickActions.filter((item) => {
        if (item.ownerOnly && !isSchoolAdmin) return false;
        return true;
      });
    }

    return businessQuickActions.filter((item) => {
      if (item.ownerOnly && !isBusinessOwner) return false;
      return true;
    });
  }, [isAdmin, isSchool, isBusinessOwner, isSchoolAdmin]);

  const workflowSteps = useMemo(() => {
    if (isAdmin) return adminWorkflowSteps;
    if (isSchool) return schoolWorkflowSteps;
    return businessWorkflowSteps;
  }, [isAdmin, isSchool]);

  if (isLoading) {
    return (
      <main
        className={`flex min-h-screen items-center justify-center px-4 text-white ${theme.page}`}
      >
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-4 shadow-2xl backdrop-blur">
          <Loader2 className={`h-5 w-5 animate-spin ${theme.spinner}`} />
          <span className="text-sm text-slate-300">Loading dashboard...</span>
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen px-4 py-6 text-white ${theme.page}`}>
      <div className="mx-auto max-w-7xl">
        <section className="mb-5 flex flex-col gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-4 shadow-2xl shadow-black/20 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <div
              className={`mb-2 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${theme.badge}`}
            >
              {copy.badge}
            </div>

            <h1 className="text-2xl font-black tracking-tight md:text-3xl">
              {copy.title}
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              {copy.description}
            </p>
          </div>

          <Link
            href={copy.recommendedHref}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${theme.button}`}
          >
            {copy.recommendedLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="mb-5 rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-4 shadow-xl shadow-black/10 backdrop-blur">
          <div className="flex items-start gap-3">
            <CheckCircle2 className={`mt-0.5 h-5 w-5 ${theme.text}`} />

            <div>
              <p className="text-sm font-semibold text-white">
                Recommended next step
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {copy.recommendedText}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/10 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-slate-950/75"
              >
                <div
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border transition ${theme.iconBox}`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <h2 className="text-base font-bold text-white">{item.title}</h2>

                <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-400">
                  {item.description}
                </p>

                <div
                  className={`mt-4 inline-flex items-center gap-2 text-sm font-medium ${theme.text}`}
                >
                  Open
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <CheckCircle2 className={`h-5 w-5 ${theme.text}`} />
            Setup flow
          </h2>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
              >
                <div className="flex gap-4">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black ${theme.number}`}
                  >
                    {index + 1}
                  </div>

                  <div>
                    <h3 className="font-semibold text-white">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}