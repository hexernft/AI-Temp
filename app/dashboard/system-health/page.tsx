"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  GraduationCap,
  KeyRound,
  Loader2,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type CheckGroup = "environment" | "business" | "school";

type HealthCheck = {
  key: string;
  label: string;
  ok: boolean;
  required: boolean;
  count?: number;
  group?: CheckGroup;
};

type HealthSummary = {
  readyCount: number;
  totalRequired: number;
  isReady: boolean;
  businessReadyCount: number;
  businessTotal: number;
  schoolReadyCount: number;
  schoolTotal: number;
};

type HealthResponse = {
  summary: HealthSummary;
  envChecks: HealthCheck[];
  dataChecks: HealthCheck[];
};

function getStatusLabel(check: HealthCheck) {
  if (check.ok) return "Ready";
  if (check.required) return "Required";
  return "Optional";
}

function getStatusClasses(check: HealthCheck) {
  if (check.ok) {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  }

  if (check.required) {
    return "border-red-400/20 bg-red-400/10 text-red-200";
  }

  return "border-amber-400/20 bg-amber-400/10 text-amber-200";
}

function formatCount(value?: number) {
  return new Intl.NumberFormat("en-NG").format(value || 0);
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  async function loadHealth() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/system-health", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load system health.");
      }

      setHealth(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load system health."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadHealth();
  }, []);

  const environmentChecks = health?.envChecks || [];

  const businessChecks = useMemo(() => {
    return (health?.dataChecks || []).filter(
      (check) => check.group === "business"
    );
  }, [health]);

  const schoolChecks = useMemo(() => {
    return (health?.dataChecks || []).filter(
      (check) => check.group === "school"
    );
  }, [health]);

  const requiredMissing = useMemo(() => {
    const checks = [
      ...(health?.envChecks || []),
      ...(health?.dataChecks || []),
    ];

    return checks.filter((check) => check.required && !check.ok);
  }, [health]);

  const summary = health?.summary;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <ServerCog className="h-3.5 w-3.5" />
            Platform Readiness
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                System Health
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Check required environment variables and setup readiness across
                the platform, Business Center, and School Center.
              </p>
            </div>

            <button
              onClick={loadHealth}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
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

        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
            Loading system health...
          </div>
        ) : health && summary ? (
          <>
            <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <ShieldCheck className="mb-4 h-5 w-5 text-emerald-400" />
                <p className="text-3xl font-black">
                  {summary.readyCount}/{summary.totalRequired}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Required checks ready
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                {summary.isReady ? (
                  <CheckCircle2 className="mb-4 h-5 w-5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="mb-4 h-5 w-5 text-amber-300" />
                )}
                <p className="text-3xl font-black">
                  {summary.isReady ? "Ready" : "Needs setup"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Platform status
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <Building2 className="mb-4 h-5 w-5 text-emerald-400" />
                <p className="text-3xl font-black">
                  {summary.businessReadyCount}/{summary.businessTotal}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Business Center checks
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <GraduationCap className="mb-4 h-5 w-5 text-indigo-400" />
                <p className="text-3xl font-black">
                  {summary.schoolReadyCount}/{summary.schoolTotal}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  School Center checks
                </p>
              </div>
            </section>

            {requiredMissing.length > 0 ? (
              <section className="mb-6 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-amber-100">
                  <AlertTriangle className="h-5 w-5" />
                  Required setup still missing
                </h2>

                <div className="grid gap-2 md:grid-cols-2">
                  {requiredMissing.map((check) => (
                    <div
                      key={check.key}
                      className="rounded-2xl border border-amber-400/20 bg-slate-950/40 px-4 py-3 text-sm text-amber-100"
                    >
                      {check.label}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="grid gap-6 xl:grid-cols-3">
              <HealthPanel
                title="Environment"
                description="Required keys and server configuration."
                icon={<KeyRound className="h-5 w-5 text-emerald-400" />}
                checks={environmentChecks}
              />

              <HealthPanel
                title="Business Center"
                description="Business workspaces, WhatsApp numbers, knowledge, conversations, and orders."
                icon={<Building2 className="h-5 w-5 text-emerald-400" />}
                checks={businessChecks}
              />

              <HealthPanel
                title="School Center"
                description="School workspaces, school WhatsApp numbers, pupils, guardians, and activity notes."
                icon={<GraduationCap className="h-5 w-5 text-indigo-400" />}
                checks={schoolChecks}
              />
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function HealthPanel({
  title,
  description,
  icon,
  checks,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  checks: HealthCheck[];
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-900">
          {icon}
        </div>

        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>

      {checks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-500">
          No checks available.
        </div>
      ) : (
        <div className="grid gap-3">
          {checks.map((check) => (
            <div
              key={check.key}
              className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{check.label}</p>

                  {"count" in check ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Count: {formatCount(check.count)}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">
                      Environment variable
                    </p>
                  )}
                </div>

                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(
                    check
                  )}`}
                >
                  {getStatusLabel(check)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}