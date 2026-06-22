"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/lib/supabase";

type FirstTimerReportRow = {
  id: string;
  full_name: string;
  phone: string;
  location: string;
  status: string;
  stage: string;
  assigned_to: string | null;
  service_date: string;
  created_at: string;
  has_been_baptized: boolean | null;
};

type FollowUpRow = {
  id: string;
  first_timer_id: string;
  worker_id: string | null;
  created_at: string;
};

type WorkerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
};

function isWithinDays(dateString: string, days: number) {
  const date = new Date(dateString);
  const now = new Date();
  const difference = now.getTime() - date.getTime();
  const daysDifference = difference / (1000 * 60 * 60 * 24);

  return daysDifference <= days;
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ReportsPage() {
  const [firstTimers, setFirstTimers] = useState<FirstTimerReportRow[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([]);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");

  useEffect(() => {
    async function loadReports() {
      setLoading(true);

      const { data: firstTimerData, error: firstTimerError } = await supabase
        .from("first_timers")
        .select(
          "id, full_name, phone, location, status, stage, assigned_to, service_date, created_at, has_been_baptized"
        )
        .order("created_at", { ascending: false });

      if (firstTimerError) {
        console.error("Reports first timers load error:", firstTimerError);
        alert(firstTimerError.message || "Could not load reports.");
        setLoading(false);
        return;
      }

      const { data: followUpData, error: followUpError } = await supabase
        .from("follow_ups")
        .select("id, first_timer_id, worker_id, created_at")
        .order("created_at", { ascending: false });

      if (followUpError) {
        console.error("Reports follow-ups load error:", followUpError);
      }

      const { data: workerData, error: workerError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active")
        .order("full_name", { ascending: true });

      if (workerError) {
        console.error("Reports workers load error:", workerError);
      }

      setFirstTimers(firstTimerData || []);
      setFollowUps(followUpData || []);
      setWorkers(workerData || []);
      setLoading(false);
    }

    loadReports();
  }, []);

  const filteredFirstTimers = useMemo(() => {
    if (period === "7") {
      return firstTimers.filter((person) => isWithinDays(person.created_at, 7));
    }

    if (period === "30") {
      return firstTimers.filter((person) => isWithinDays(person.created_at, 30));
    }

    if (period === "90") {
      return firstTimers.filter((person) => isWithinDays(person.created_at, 90));
    }

    return firstTimers;
  }, [firstTimers, period]);

  const filteredIds = useMemo(() => {
    return new Set(filteredFirstTimers.map((person) => person.id));
  }, [filteredFirstTimers]);

  const filteredFollowUps = useMemo(() => {
    return followUps.filter((item) => filteredIds.has(item.first_timer_id));
  }, [filteredIds, followUps]);

  const total = filteredFirstTimers.length;

  const newCount = filteredFirstTimers.filter(
    (person) => person.status === "new"
  ).length;

  const contactedCount = filteredFirstTimers.filter(
    (person) => person.status === "contacted"
  ).length;

  const noResponseCount = filteredFirstTimers.filter(
    (person) => person.status === "no_response"
  ).length;

  const needsAttentionCount = filteredFirstTimers.filter(
    (person) => person.status === "needs_attention"
  ).length;

  const activeCount = filteredFirstTimers.filter(
    (person) => person.status === "active"
  ).length;

  const assignedCount = filteredFirstTimers.filter(
    (person) => person.assigned_to
  ).length;

  const unassignedCount = filteredFirstTimers.filter(
    (person) => !person.assigned_to
  ).length;

  const foundationCount = filteredFirstTimers.filter(
    (person) =>
      person.stage === "foundation_school" ||
      person.stage === "foundation_school_completed"
  ).length;

  const baptismReadyCount = filteredFirstTimers.filter(
    (person) => person.stage === "baptism_ready"
  ).length;

  const baptizedCount = filteredFirstTimers.filter(
    (person) => person.has_been_baptized === true || person.stage === "baptized"
  ).length;

  const notBaptizedCount = filteredFirstTimers.filter(
    (person) => person.has_been_baptized === false
  ).length;

  const membershipCount = filteredFirstTimers.filter(
    (person) => person.stage === "membership"
  ).length;

  const followUpCount = filteredFollowUps.length;

  const followUpRate =
    total > 0 ? Math.round((contactedCount / total) * 100) : 0;

  const assignmentRate =
    total > 0 ? Math.round((assignedCount / total) * 100) : 0;

  const workerPerformance = workers
    .filter((worker) => worker.is_active)
    .map((worker) => {
      const assignedPeople = filteredFirstTimers.filter(
        (person) => person.assigned_to === worker.id
      );

      const workerFollowUps = filteredFollowUps.filter(
        (followUp) => followUp.worker_id === worker.id
      );

      return {
        id: worker.id,
        name: worker.full_name || worker.email || "Unnamed Worker",
        role: worker.role,
        assigned: assignedPeople.length,
        followUps: workerFollowUps.length,
      };
    })
    .sort((a, b) => b.assigned - a.assigned || b.followUps - a.followUps);

  const stageBreakdown = [
    { label: "First Visit", value: "first_visit" },
    { label: "Follow-Up", value: "follow_up" },
    { label: "Second Visit", value: "second_visit" },
    { label: "Foundation", value: "foundation_school" },
    { label: "Foundation Completed", value: "foundation_school_completed" },
    { label: "Baptism Ready", value: "baptism_ready" },
    { label: "Baptized", value: "baptized" },
    { label: "Membership", value: "membership" },
    { label: "Serving", value: "serving" },
    { label: "General Growth", value: "general_growth" },
  ].map((stage) => ({
    ...stage,
    count: filteredFirstTimers.filter((person) => person.stage === stage.value)
      .length,
  }));

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="grid gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Reports
                </p>

                <h1 className="mt-1 font-display text-[1.55rem] font-black leading-tight tracking-[-0.045em] text-slate-950">
                  Growth overview
                </h1>

                <p className="mt-1 max-w-2xl text-[0.86rem] leading-5 text-slate-500">
                  Review first timer capture, follow-up progress, worker
                  activity, foundation school, baptism, and membership.
                </p>
              </div>

              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="w-fit rounded-xl border border-slate-200 bg-white px-3 py-2 text-[0.85rem] font-bold text-slate-700 outline-none transition focus:border-slate-950"
              >
                <option value="all">All time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
          </section>

          {loading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-500">
                Loading reports...
              </p>
            </section>
          ) : (
            <>
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ReportCard
                  title="Total first timers"
                  value={total}
                  description="Captured records"
                />

                <ReportCard
                  title="Follow-up rate"
                  value={`${followUpRate}%`}
                  description={`${contactedCount} contacted`}
                />

                <ReportCard
                  title="Assignment rate"
                  value={`${assignmentRate}%`}
                  description={`${assignedCount} assigned`}
                />

                <ReportCard
                  title="Follow-up notes"
                  value={followUpCount}
                  description="Logged interactions"
                />
              </section>

              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ReportCard title="New" value={newCount} description="Waiting" />
                <ReportCard
                  title="No response"
                  value={noResponseCount}
                  description="Could not reach"
                />
                <ReportCard
                  title="Needs attention"
                  value={needsAttentionCount}
                  description="Requires care"
                />
                <ReportCard
                  title="Active"
                  value={activeCount}
                  description="Currently growing"
                />
              </section>

              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ReportCard
                  title="Unassigned"
                  value={unassignedCount}
                  description="Need worker"
                />
                <ReportCard
                  title="Foundation"
                  value={foundationCount}
                  description="In progress/completed"
                />
                <ReportCard
                  title="Not baptized"
                  value={notBaptizedCount}
                  description="Needs follow-up"
                />
                <ReportCard
                  title="Baptized"
                  value={baptizedCount}
                  description="Baptism completed"
                />
              </section>

              <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-[1rem] font-black text-slate-950">
                        Growth stages
                      </h2>
                      <p className="mt-0.5 text-[0.78rem] text-slate-500">
                        Current position in the follow-up journey.
                      </p>
                    </div>

                    <Link
                      href="/first-timers"
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-600 transition hover:bg-slate-200"
                    >
                      View
                    </Link>
                  </div>

                  <div className="grid gap-2">
                    {stageBreakdown.map((stage) => (
                      <div
                        key={stage.value}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <p className="text-[0.82rem] font-bold text-slate-700">
                          {stage.label}
                        </p>
                        <p className="rounded-lg bg-white px-2 py-1 text-[0.75rem] font-black text-slate-950">
                          {stage.count}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-[1rem] font-black text-slate-950">
                        Worker activity
                      </h2>
                      <p className="mt-0.5 text-[0.78rem] text-slate-500">
                        Active workers, assignments, and notes.
                      </p>
                    </div>

                    <Link
                      href="/workers"
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-600 transition hover:bg-slate-200"
                    >
                      Workers
                    </Link>
                  </div>

                  {workerPerformance.length === 0 ? (
                    <div className="rounded-xl bg-slate-50 p-5 text-center">
                      <p className="text-sm font-bold text-slate-700">
                        No worker activity yet.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {workerPerformance.map((worker) => (
                        <div
                          key={worker.id}
                          className="rounded-xl bg-slate-50 p-3"
                        >
                          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                            <div>
                              <p className="text-[0.88rem] font-black text-slate-950">
                                {worker.name}
                              </p>
                              <p className="mt-0.5 text-[0.72rem] font-bold uppercase tracking-wide text-slate-400">
                                {formatLabel(worker.role)}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-lg bg-white px-2 py-1 text-[0.72rem] font-black text-slate-700">
                                {worker.assigned} assigned
                              </span>
                              <span className="rounded-lg bg-white px-2 py-1 text-[0.72rem] font-black text-slate-700">
                                {worker.followUps} notes
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="font-display text-[1rem] font-black text-slate-950">
                  Leadership summary
                </h2>

                <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <SummaryItem
                    label="Need assignment"
                    value={unassignedCount}
                    href="/first-timers"
                  />

                  <SummaryItem
                    label="Need attention"
                    value={needsAttentionCount}
                    href="/first-timers"
                  />

                  <SummaryItem
                    label="Baptism ready"
                    value={baptismReadyCount}
                    href="/baptism"
                  />

                  <SummaryItem
                    label="Membership stage"
                    value={membershipCount}
                    href="/baptism"
                  />

                  <SummaryItem
                    label="Foundation records"
                    value={foundationCount}
                    href="/foundation-school"
                  />

                  <SummaryItem
                    label="Not baptized"
                    value={notBaptizedCount}
                    href="/baptism"
                  />
                </div>
              </section>
            </>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function ReportCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number | string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[0.72rem] font-bold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <p className="mt-1 font-display text-[1.45rem] font-black leading-none text-slate-950">
        {value}
      </p>
      <p className="mt-1 text-[0.76rem] text-slate-500">{description}</p>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl bg-slate-50 p-3 transition hover:bg-slate-100"
    >
      <p className="text-[0.78rem] font-bold text-slate-500">{label}</p>
      <p className="mt-1 font-display text-[1.35rem] font-black text-slate-950">
        {value}
      </p>
    </Link>
  );
}