"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatusBadge from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase";

type WorkerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type FirstTimerRow = {
  id: string;
  full_name: string;
  phone: string;
  whatsapp: string | null;
  gender: string | null;
  age_range: string | null;
  location: string;
  status: string;
  stage: string;
  source: string;
  assigned_to: string | null;
  service_date: string;
  created_at: string;
};

type FirstTimer = FirstTimerRow & {
  assigned_worker: WorkerProfile | null;
};

function formatLabel(value: string | null | undefined) {
  if (!value) return "Not provided";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  return new Date(value).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function FirstTimersPage() {
  const [firstTimers, setFirstTimers] = useState<FirstTimer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadFirstTimers() {
      setLoading(true);

      const { data: firstTimerData, error: firstTimerError } = await supabase
        .from("first_timers")
        .select(
          "id, full_name, phone, whatsapp, gender, age_range, location, status, stage, source, assigned_to, service_date, created_at"
        )
        .order("created_at", { ascending: false });

      if (firstTimerError) {
        console.error("First timers load error:", firstTimerError);
        alert(firstTimerError.message || "Could not load first timers.");
        setLoading(false);
        return;
      }

      const { data: workerData, error: workerError } = await supabase
        .from("profiles")
        .select("id, full_name, email");

      if (workerError) {
        console.error("Workers load error:", workerError);
      }

      const workers = workerData || [];
      const rows = firstTimerData || [];

      const normalized: FirstTimer[] = rows.map((person) => {
        const assignedWorker =
          workers.find((worker) => worker.id === person.assigned_to) || null;

        return {
          ...person,
          assigned_worker: assignedWorker,
        };
      });

      setFirstTimers(normalized);
      setLoading(false);
    }

    loadFirstTimers();
  }, []);

  const filteredFirstTimers = useMemo(() => {
    return firstTimers.filter((person) => {
      const matchesStatus =
        statusFilter === "all" || person.status === statusFilter;

      const matchesAssignment =
        assignmentFilter === "all" ||
        (assignmentFilter === "assigned" && person.assigned_worker) ||
        (assignmentFilter === "unassigned" && !person.assigned_worker);

      const searchValue = search.toLowerCase().trim();

      const assignedWorkerName =
        person.assigned_worker?.full_name ||
        person.assigned_worker?.email ||
        "";

      const matchesSearch =
        !searchValue ||
        person.full_name.toLowerCase().includes(searchValue) ||
        person.phone.toLowerCase().includes(searchValue) ||
        person.location.toLowerCase().includes(searchValue) ||
        person.stage.toLowerCase().includes(searchValue) ||
        assignedWorkerName.toLowerCase().includes(searchValue);

      return matchesStatus && matchesAssignment && matchesSearch;
    });
  }, [assignmentFilter, firstTimers, search, statusFilter]);

  const newCount = firstTimers.filter((person) => person.status === "new").length;
  const assignedCount = firstTimers.filter((person) => person.assigned_worker).length;
  const unassignedCount = firstTimers.filter(
    (person) => !person.assigned_worker
  ).length;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="grid gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  First Timers
                </p>

                <h1 className="mt-1 font-display text-[1.55rem] font-black leading-tight tracking-[-0.045em] text-slate-950">
                  Captured visitors
                </h1>

                <p className="mt-1 max-w-2xl text-[0.86rem] leading-5 text-slate-500">
                  View, search, assign, and manage people who submitted the
                  public QR form.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/welcome"
                  className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800"
                >
                  Open Form
                </Link>

                <Link
                  href="/workers/my-follow-ups"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition hover:bg-slate-50"
                >
                  My Follow-Ups
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Total" value={firstTimers.length} />
            <MiniStat label="New" value={newCount} />
            <MiniStat label="Assigned" value={assignedCount} />
            <MiniStat label="Unassigned" value={unassignedCount} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid gap-2 md:grid-cols-[1fr_180px_180px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[0.85rem] outline-none transition focus:border-slate-950"
                placeholder="Search name, phone, location, stage, or worker"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[0.85rem] outline-none transition focus:border-slate-950"
              >
                <option value="all">All statuses</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="no_response">No Response</option>
                <option value="interested">Interested</option>
                <option value="visited_again">Visited Again</option>
                <option value="needs_attention">Needs Attention</option>
                <option value="inactive">Inactive</option>
                <option value="active">Active</option>
              </select>

              <select
                value={assignmentFilter}
                onChange={(event) => setAssignmentFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[0.85rem] outline-none transition focus:border-slate-950"
              >
                <option value="all">All assignments</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
          </section>

          {loading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-500">
                Loading first timers...
              </p>
            </section>
          ) : filteredFirstTimers.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-black text-slate-800">
                No first timers found.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                New form submissions will appear here.
              </p>
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="hidden grid-cols-[1.15fr_0.8fr_0.85fr_0.8fr_0.95fr_0.65fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-400 md:grid">
                <p>Name</p>
                <p>Phone</p>
                <p>Location</p>
                <p>Status</p>
                <p>Assigned To</p>
                <p>Action</p>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredFirstTimers.map((person) => {
                  const workerName =
                    person.assigned_worker?.full_name ||
                    person.assigned_worker?.email ||
                    "Not assigned";

                  return (
                    <div
                      key={person.id}
                      className="grid gap-3 px-4 py-3 transition hover:bg-slate-50 md:grid-cols-[1.15fr_0.8fr_0.85fr_0.8fr_0.95fr_0.65fr] md:items-center"
                    >
                      <div>
                        <p className="text-[0.9rem] font-black text-slate-950">
                          {person.full_name}
                        </p>
                        <p className="mt-0.5 text-[0.76rem] text-slate-500">
                          {formatDate(person.service_date)} •{" "}
                          {formatLabel(person.stage)}
                        </p>
                      </div>

                      <p className="text-[0.82rem] font-semibold text-slate-700">
                        {person.phone}
                      </p>

                      <p className="text-[0.82rem] font-medium text-slate-600">
                        {person.location}
                      </p>

                      <div>
                        <StatusBadge status={person.status} />
                      </div>

                      <p className="text-[0.82rem] font-semibold text-slate-600">
                        {workerName}
                      </p>

                      <Link
                        href={`/first-timers/${person.id}`}
                        className="w-fit rounded-lg bg-slate-950 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-slate-800"
                      >
                        View
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[0.72rem] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-display text-[1.45rem] font-black leading-none text-slate-950">
        {value}
      </p>
    </div>
  );
}