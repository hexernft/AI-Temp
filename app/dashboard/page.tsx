"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/lib/supabase";

type DashboardStats = {
  total: number;
  newCount: number;
  contacted: number;
  needsAttention: number;
  assigned: number;
  unassigned: number;
  foundationSchool: number;
  baptismReady: number;
  baptized: number;
  notBaptized: number;
};

type RecentFirstTimer = {
  id: string;
  full_name: string;
  phone: string;
  location: string;
  status: string;
  stage: string;
  created_at: string;
};

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    newCount: 0,
    contacted: 0,
    needsAttention: 0,
    assigned: 0,
    unassigned: 0,
    foundationSchool: 0,
    baptismReady: 0,
    baptized: 0,
    notBaptized: 0,
  });

  const [recentFirstTimers, setRecentFirstTimers] = useState<
    RecentFirstTimer[]
  >([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);

      const { data, error } = await supabase
        .from("first_timers")
        .select(
          "id, full_name, phone, location, status, stage, assigned_to, has_been_baptized, created_at"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Dashboard load error:", error);
        setLoading(false);
        return;
      }

      const rows = data || [];

      setStats({
        total: rows.length,
        newCount: rows.filter((item) => item.status === "new").length,
        contacted: rows.filter((item) => item.status === "contacted").length,
        needsAttention: rows.filter((item) => item.status === "needs_attention")
          .length,
        assigned: rows.filter((item) => item.assigned_to).length,
        unassigned: rows.filter((item) => !item.assigned_to).length,
        foundationSchool: rows.filter(
          (item) =>
            item.stage === "foundation_school" ||
            item.stage === "foundation_school_completed"
        ).length,
        baptismReady: rows.filter((item) => item.stage === "baptism_ready")
          .length,
        baptized: rows.filter(
          (item) => item.has_been_baptized === true || item.stage === "baptized"
        ).length,
        notBaptized: rows.filter((item) => item.has_been_baptized === false)
          .length,
      });

      setRecentFirstTimers(rows.slice(0, 7));
      setLoading(false);
    }

    loadDashboard();
  }, []);

  const followUpRate =
    stats.total > 0 ? Math.round((stats.contacted / stats.total) * 100) : 0;

  const assignmentRate =
    stats.total > 0 ? Math.round((stats.assigned / stats.total) * 100) : 0;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="grid gap-4">
          <section className="dark-card glow-border overflow-hidden rounded-[2rem] p-4 md:p-5">
            <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-stretch">
              <div>
                <div className="mb-4 inline-flex rounded-full border border-black/10 bg-white px-3 py-1 text-[0.72rem] font-black uppercase tracking-[0.18em] text-[var(--brand-green)]">
                  WelCare Command Center
                </div>

                <h1 className="max-w-3xl font-display text-[2.15rem] font-black leading-[1.02] tracking-[-0.06em] text-slate-950 md:text-[3rem]">
                  Track every first timer from welcome to growth.
                </h1>

                <p className="mt-3 max-w-2xl text-[0.9rem] leading-6 text-slate-600">
                  Monitor capture, follow-up, assignments, foundation school,
                  baptism, and ongoing care from one premium dashboard.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href="/qr-code"
                    className="rounded-2xl bg-[var(--brand-green)] px-4 py-2.5 text-[0.84rem] font-black shadow-lg shadow-black/5 transition hover:opacity-90" style={{ color: "#ffffff" }}
                  >
                    Show QR Code
                  </Link>

                  <Link
                    href="/first-timers"
                    className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-[0.78rem] font-black text-slate-950 transition hover:bg-slate-50"
                  >
                    View Records
                  </Link>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-black/10 bg-white p-4">
                <p className="text-[0.75rem] font-black uppercase tracking-[0.18em] text-slate-400">
                  Care Pulse
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <PulseBox label="Follow-Up" value={`${followUpRate}%`} />
                  <PulseBox label="Assigned" value={`${assignmentRate}%`} />
                  <PulseBox label="Unassigned" value={stats.unassigned} />
                  <PulseBox label="Attention" value={stats.needsAttention} />
                </div>
              </div>
            </div>
          </section>

          {loading ? (
            <section className="dark-card-soft rounded-[1.6rem] p-6 text-center">
              <p className="text-sm font-bold text-slate-400">
                Loading dashboard...
              </p>
            </section>
          ) : (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Total first timers"
                  value={stats.total}
                  helper="All captured records"
                  tone="blue"
                />

                <StatCard
                  label="New"
                  value={stats.newCount}
                  helper="Waiting for care"
                  tone="violet"
                />

                <StatCard
                  label="Foundation"
                  value={stats.foundationSchool}
                  helper="Started or completed"
                  tone="cyan"
                />

                <StatCard
                  label="Not baptized"
                  value={stats.notBaptized}
                  helper="Needs baptism follow-up"
                  tone="pink"
                />
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                <div className="dark-card-soft overflow-hidden rounded-[1.7rem]">
                  <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
                    <div>
                      <h2 className="font-display text-[1.05rem] font-black text-slate-950">
                        Recent First Timers
                      </h2>
                      <p className="mt-0.5 text-[0.78rem] text-slate-600">
                        Latest submissions from the QR form.
                      </p>
                    </div>

                    <Link
                      href="/first-timers"
                      className="rounded-xl bg-slate-100 px-3 py-1.5 text-[0.72rem] font-black text-slate-950 transition hover:bg-slate-50"
                    >
                      View all
                    </Link>
                  </div>

                  {recentFirstTimers.length === 0 ? (
                    <div className="p-7 text-center">
                      <p className="text-sm font-bold text-slate-300">
                        No records yet.
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        New form submissions will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/8">
                      {recentFirstTimers.map((person) => (
                        <Link
                          key={person.id}
                          href={`/first-timers/${person.id}`}
                          className="grid gap-3 px-4 py-3 transition hover:bg-white/5 md:grid-cols-[1.25fr_0.8fr_0.75fr_0.55fr]"
                        >
                          <div>
                            <p className="text-[0.9rem] font-black text-slate-950">
                              {person.full_name}
                            </p>
                            <p className="mt-0.5 text-[0.76rem] text-slate-600">
                              {person.phone}
                            </p>
                          </div>

                          <InfoCell label="Location" value={person.location} />
                          <InfoCell
                            label="Status"
                            value={formatLabel(person.status)}
                          />
                          <InfoCell
                            label="Added"
                            value={formatDate(person.created_at)}
                          />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-4">
                  <div className="dark-card-soft rounded-[1.7rem] p-4">
                    <h2 className="font-display text-[1.05rem] font-black text-slate-950">
                      Growth Progress
                    </h2>

                    <p className="mt-0.5 text-[0.78rem] text-slate-600">
                      Movement through key church care stages.
                    </p>

                    <div className="mt-4 grid gap-3">
                      <ProgressRow
                        label="Foundation"
                        value={stats.foundationSchool}
                        total={stats.total}
                        accent="from-cyan-400 to-blue-500"
                      />

                      <ProgressRow
                        label="Baptism ready"
                        value={stats.baptismReady}
                        total={stats.total}
                        accent="from-violet-400 to-fuchsia-500"
                      />

                      <ProgressRow
                        label="Baptized"
                        value={stats.baptized}
                        total={stats.total}
                        accent="from-emerald-400 to-cyan-500"
                      />

                      <ProgressRow
                        label="Assigned"
                        value={stats.assigned}
                        total={stats.total}
                        accent=""
                      />
                    </div>
                  </div>

                  <div className="dark-card-soft rounded-[1.7rem] p-4">
                    <h2 className="font-display text-[1.05rem] font-black text-slate-950">
                      Quick Actions
                    </h2>

                    <div className="mt-3 grid gap-2">
                      <QuickAction href="/welcome" label="Open public form" />
                      <QuickAction href="/qr-code" label="Show QR code" />
                      <QuickAction
                        href="/workers/my-follow-ups"
                        label="My follow-ups"
                      />
                      <QuickAction href="/reports" label="Reports" />
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function PulseBox({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div
      className="rounded-2xl border border-[#0f4638]/20 bg-[#10483a] p-3 shadow-sm"
      style={{ color: "#ffffff" }}
    >
      <p
        className="text-[0.78rem] font-black uppercase tracking-wide"
        style={{ color: "#d9f99d" }}
      >
        {label}
      </p>
      <p
        className="mt-1 font-display text-[1.45rem] font-black"
        style={{ color: "#ffffff" }}
      >
        {value}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: number | string;
  helper: string;
  tone: "blue" | "violet" | "cyan" | "pink";
}) {
  const tones = {
    blue: " text-[var(--brand-green)]",
    violet: " text-[var(--brand-green)]",
    cyan: " text-[var(--brand-green)]",
    pink: " text-[var(--brand-green)]",
  };

  return (
    <div
      className={`rounded-[1.6rem] border border-black/10 bg-white ${tones[tone]} p-4 shadow-xl shadow-black/5`}
    >
      <p className="text-[0.7rem] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 font-display text-[2rem] font-black leading-none text-slate-950">
        {value}
      </p>
      <p className="mt-1 text-[0.76rem] font-medium text-slate-600">{helper}</p>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-[0.82rem] font-semibold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
  accent,
}: {
  label: string;
  value: number;
  total: number;
  accent: string;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[0.78rem] font-bold text-slate-800">{label}</p>
        <p className="text-[0.75rem] font-black text-slate-950">{percentage}%</p>
      </div>

      <div className="h-2 rounded-full bg-white">
        <div
          className={`h-2 rounded-full bg-[var(--brand-green)] ${accent}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-[0.82rem] font-bold text-slate-950 transition hover:bg-slate-50"
    >
      <span>{label}</span>
      <span className="text-[var(--brand-green)]">→</span>
    </Link>
  );
}




