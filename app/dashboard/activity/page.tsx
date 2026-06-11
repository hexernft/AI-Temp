"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  Clock,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  role: string | null;
  business_id: string | null;
  school_id: string | null;
};

type Actor = {
  id: string;
  email: string;
} | null;

type Business = {
  id: string;
  name: string | null;
} | null;

type School = {
  id: string;
  name: string | null;
} | null;

type ActivityLog = {
  id: string;
  actor_id: string | null;
  business_id: string | null;
  school_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  actor?: Actor;
  business?: Business;
  school?: School;
};

function formatDate(value?: string | null) {
  if (!value) return "No date";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAction(value?: string | null) {
  if (!value) return "Unknown action";

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatRole(value?: string | null) {
  if (!value) return "Unknown";

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getMode(profile: Profile | null) {
  if (profile?.role === "super_admin") return "platform";
  if (profile?.role === "school_admin" || profile?.role === "teacher") {
    return "school";
  }

  return "business";
}

function getWorkspaceLabel(log: ActivityLog) {
  if (log.school) return log.school.name || "School";
  if (log.business) return log.business.name || "Business";

  const metadataWorkspaceName = log.metadata?.workspace_name;

  if (typeof metadataWorkspaceName === "string" && metadataWorkspaceName) {
    return metadataWorkspaceName;
  }

  return "Platform";
}

function getWorkspaceType(log: ActivityLog) {
  if (log.school_id) return "school";
  if (log.business_id) return "business";

  const metadataWorkspaceType = log.metadata?.workspace_type;

  if (metadataWorkspaceType === "school") return "school";
  if (metadataWorkspaceType === "business") return "business";

  return "platform";
}

function getSafeMetadataEntries(metadata: Record<string, unknown> | null) {
  if (!metadata) return [];

  const hiddenKeys = new Set([
    "raw_message",
    "whatsapp_response",
    "status_payload",
    "customer_message",
    "message_body",
    "body",
    "content",
    "details",
    "activity_details",
    "pupil_notes",
  ]);

  return Object.entries(metadata).filter(([key, value]) => {
    if (hiddenKeys.has(key)) return false;
    if (value === null || value === undefined) return false;
    if (typeof value === "object") return false;

    return true;
  });
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const mode = getMode(profile);
  const isSchool = mode === "school";
  const isPlatform = mode === "platform";

  const theme = isSchool
    ? {
        pill: "border-indigo-400/20 bg-indigo-400/10 text-indigo-300",
        icon: "text-indigo-400",
        active: "bg-indigo-400 text-slate-950",
        focus: "focus:border-indigo-400/60",
        spinner: "text-indigo-400",
      }
    : {
        pill: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
        icon: "text-emerald-400",
        active: "bg-emerald-400 text-slate-950",
        focus: "focus:border-emerald-400/60",
        spinner: "text-emerald-400",
      };

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  async function loadLogs() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/activity-logs?limit=150", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load activity logs.");
      }

      setLogs(result.logs || []);
      setProfile(result.profile || null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load activity logs."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const actionOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.action).filter(Boolean)))
      .sort()
      .map((action) => ({
        value: action,
        label: formatAction(action),
      }));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return logs.filter((log) => {
      if (actionFilter && log.action !== actionFilter) return false;

      if (!query) return true;

      return (
        log.title.toLowerCase().includes(query) ||
        (log.description || "").toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.entity_type.toLowerCase().includes(query) ||
        (log.actor?.email || "").toLowerCase().includes(query) ||
        (log.business?.name || "").toLowerCase().includes(query) ||
        (log.school?.name || "").toLowerCase().includes(query)
      );
    });
  }, [logs, searchQuery, actionFilter]);

  const summary = useMemo(() => {
    const platformCount = logs.filter(
      (log) => getWorkspaceType(log) === "platform"
    ).length;

    const businessCount = logs.filter(
      (log) => getWorkspaceType(log) === "business"
    ).length;

    const schoolCount = logs.filter(
      (log) => getWorkspaceType(log) === "school"
    ).length;

    return {
      platformCount,
      businessCount,
      schoolCount,
      total: logs.length,
    };
  }, [logs]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div
            className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${theme.pill}`}
          >
            {isSchool ? (
              <GraduationCap className="h-3.5 w-3.5" />
            ) : (
              <Activity className="h-3.5 w-3.5" />
            )}
            Activity Log
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Activity
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                {isPlatform
                  ? "View platform setup activity such as workspace creation, admin creation, and WhatsApp number setup. Private business conversations and private pupil activity details are not shown here."
                  : isSchool
                  ? "View school workspace activity for your school only. Pupil activity details stay protected and are not exposed as raw metadata here."
                  : "View business workspace activity for your business only."}
              </p>

              {profile ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                  <ShieldCheck className={`h-4 w-4 ${theme.icon}`} />
                  Role: {formatRole(profile.role)}
                </div>
              ) : null}
            </div>

            <button
              onClick={loadLogs}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className={`h-4 w-4 animate-spin ${theme.spinner}`} />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </button>
          </div>
        </section>

        {errorMessage ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <Activity className={`mb-4 h-5 w-5 ${theme.icon}`} />
            <p className="text-3xl font-black">{summary.total}</p>
            <p className="mt-1 text-xs text-slate-500">Total visible logs</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <ShieldCheck className="mb-4 h-5 w-5 text-amber-300" />
            <p className="text-3xl font-black">{summary.platformCount}</p>
            <p className="mt-1 text-xs text-slate-500">Platform logs</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <Building2 className="mb-4 h-5 w-5 text-emerald-400" />
            <p className="text-3xl font-black">{summary.businessCount}</p>
            <p className="mt-1 text-xs text-slate-500">Business logs</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <GraduationCap className="mb-4 h-5 w-5 text-indigo-400" />
            <p className="text-3xl font-black">{summary.schoolCount}</p>
            <p className="mt-1 text-xs text-slate-500">School logs</p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Recent activity</h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredLogs.length} of {logs.length} logs shown
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:min-w-[560px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search activity..."
                  className={`w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 ${theme.focus}`}
                />
              </div>

              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                className={`w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none ${theme.focus}`}
              >
                <option value="">All actions</option>

                {actionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-400">
              <Loader2 className={`mr-2 h-4 w-4 animate-spin ${theme.spinner}`} />
              Loading activity logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm leading-6 text-slate-500">
              No activity logs found yet.
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredLogs.map((log) => {
                const workspaceType = getWorkspaceType(log);
                const safeMetadataEntries = getSafeMetadataEntries(log.metadata);

                const workspaceClasses =
                  workspaceType === "school"
                    ? "border-indigo-400/20 bg-indigo-400/10 text-indigo-300"
                    : workspaceType === "business"
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                    : "border-amber-400/20 bg-amber-400/10 text-amber-200";

                const WorkspaceIcon =
                  workspaceType === "school"
                    ? GraduationCap
                    : workspaceType === "business"
                    ? Building2
                    : ShieldCheck;

                return (
                  <article
                    key={log.id}
                    className="rounded-3xl border border-white/10 bg-slate-900/70 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap gap-2">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${workspaceClasses}`}
                          >
                            <WorkspaceIcon className="h-3.5 w-3.5" />
                            {workspaceType === "platform"
                              ? "Platform"
                              : workspaceType === "school"
                              ? "School"
                              : "Business"}
                          </span>

                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-300">
                            {formatAction(log.action)}
                          </span>

                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-300">
                            {log.entity_type}
                          </span>
                        </div>

                        <h3 className="text-base font-semibold text-white">
                          {log.title}
                        </h3>

                        {log.description ? (
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {log.description}
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-2">
                            <Clock className={`h-3.5 w-3.5 ${theme.icon}`} />
                            {formatDate(log.created_at)}
                          </span>

                          <span className="inline-flex items-center gap-2">
                            <UserRound className={`h-3.5 w-3.5 ${theme.icon}`} />
                            {log.actor?.email || "System"}
                          </span>

                          <span className="inline-flex items-center gap-2">
                            <WorkspaceIcon className={`h-3.5 w-3.5 ${theme.icon}`} />
                            {getWorkspaceLabel(log)}
                          </span>
                        </div>

                        {safeMetadataEntries.length > 0 ? (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950 p-3">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                              Safe metadata
                            </p>

                            <div className="grid gap-1 text-xs leading-5 text-slate-400 md:grid-cols-2">
                              {safeMetadataEntries.slice(0, 8).map(([key, value]) => (
                                <p key={key} className="truncate">
                                  <span className="text-slate-500">{key}:</span>{" "}
                                  {String(value)}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-xs text-slate-500">
                        ID: {log.id.slice(0, 8)}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}