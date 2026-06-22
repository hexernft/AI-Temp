"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatusBadge from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase";

type AssignedFirstTimer = {
  id: string;
  full_name: string;
  phone: string;
  whatsapp: string | null;
  location: string;
  status: string;
  stage: string;
  service_date: string;
  created_at: string;
};

function formatStage(value: string) {
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

function cleanPhoneNumber(value: string) {
  return value.replace(/\D/g, "");
}

function getWhatsAppLink(value: string) {
  const cleaned = cleanPhoneNumber(value);

  if (cleaned.startsWith("0")) {
    return `https://wa.me/234${cleaned.slice(1)}`;
  }

  if (cleaned.startsWith("234")) {
    return `https://wa.me/${cleaned}`;
  }

  return `https://wa.me/${cleaned}`;
}

export default function MyFollowUpsPage() {
  const [assignedPeople, setAssignedPeople] = useState<AssignedFirstTimer[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadAssignedPeople() {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("User load error:", userError);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("first_timers")
        .select(
          "id, full_name, phone, whatsapp, location, status, stage, service_date, created_at"
        )
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Assigned first timers load error:", error);
        alert(error.message || "Could not load your follow-ups.");
        setLoading(false);
        return;
      }

      setAssignedPeople(data || []);
      setLoading(false);
    }

    loadAssignedPeople();
  }, []);

  const filteredPeople = useMemo(() => {
    return assignedPeople.filter((person) => {
      const matchesStatus =
        statusFilter === "all" || person.status === statusFilter;

      const searchValue = search.toLowerCase().trim();

      const matchesSearch =
        !searchValue ||
        person.full_name.toLowerCase().includes(searchValue) ||
        person.phone.toLowerCase().includes(searchValue) ||
        person.location.toLowerCase().includes(searchValue) ||
        person.stage.toLowerCase().includes(searchValue);

      return matchesStatus && matchesSearch;
    });
  }, [assignedPeople, search, statusFilter]);

  const newCount = assignedPeople.filter(
    (person) => person.status === "new"
  ).length;

  const needsAttentionCount = assignedPeople.filter(
    (person) => person.status === "needs_attention"
  ).length;

  const contactedCount = assignedPeople.filter(
    (person) => person.status === "contacted"
  ).length;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="grid gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  My Follow-Ups
                </p>

                <h1 className="mt-1 font-display text-[1.55rem] font-black leading-tight tracking-[-0.045em] text-slate-950">
                  Assigned to me
                </h1>

                <p className="mt-1 max-w-2xl text-[0.86rem] leading-5 text-slate-500">
                  Focus on the people you are responsible for contacting,
                  encouraging, and guiding through their next steps.
                </p>
              </div>

              <Link
                href="/first-timers"
                className="w-fit rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition hover:bg-slate-50"
              >
                View All First Timers
              </Link>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Total assigned" value={assignedPeople.length} />
            <MiniStat label="New" value={newCount} />
            <MiniStat label="Contacted" value={contactedCount} />
            <MiniStat label="Needs attention" value={needsAttentionCount} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid gap-2 md:grid-cols-[1fr_180px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[0.85rem] outline-none transition focus:border-slate-950"
                placeholder="Search by name, phone, location, or stage"
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
            </div>
          </section>

          {loading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-500">
                Loading your follow-ups...
              </p>
            </section>
          ) : filteredPeople.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-black text-slate-800">
                No assigned follow-ups found.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Once a first timer is assigned to you, they will appear here.
              </p>
            </section>
          ) : (
            <section className="grid gap-3">
              {filteredPeople.map((person) => {
                const whatsappNumber = person.whatsapp || person.phone;

                return (
                  <div
                    key={person.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-display text-[1.05rem] font-black text-slate-950">
                            {person.full_name}
                          </h2>

                          <StatusBadge status={person.status} />
                        </div>

                        <p className="mt-1 text-[0.78rem] text-slate-500">
                          First visited on {formatDate(person.service_date)}
                        </p>

                        <div className="mt-3 grid gap-2 text-[0.82rem] text-slate-600 md:grid-cols-3">
                          <Info label="Phone" value={person.phone} />
                          <Info label="Location" value={person.location} />
                          <Info label="Stage" value={formatStage(person.stage)} />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <a
                          href={`tel:${person.phone}`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition hover:bg-slate-50"
                        >
                          Call
                        </a>

                        <a
                          href={getWhatsAppLink(whatsappNumber)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-[#25D366] px-3 py-2 text-[11px] font-black text-white transition hover:opacity-90"
                        >
                          WhatsApp
                        </a>

                        <Link
                          href={`/first-timers/${person.id}`}
                          className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800"
                        >
                          View Profile
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-black text-slate-800">{label}:</span> {value}
    </p>
  );
}