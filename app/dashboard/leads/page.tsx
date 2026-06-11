"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type LeadStatus =
  | "new"
  | "collecting_details"
  | "qualified"
  | "needs_human_follow_up"
  | "closed"
  | string;

type Lead = {
  id: string;
  business_id: string | null;
  customer_id: string | null;
  conversation_id: string | null;
  customer_name: string | null;
  whatsapp_number: string | null;
  business_name: string | null;
  business_type: string | null;
  service_requested: string | null;
  budget: string | null;
  date_needed: string | null;
  location: string | null;
  notes: string | null;
  status: LeadStatus;
  created_at: string | null;
  updated_at: string | null;
};

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
};

const leadStatuses = [
  "new",
  "collecting_details",
  "qualified",
  "needs_human_follow_up",
  "closed",
];

export default function LeadsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "new" | "collecting_details" | "qualified" | "needs_human_follow_up" | "closed"
  >("all");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadLeads() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/dashboard/leads", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load leads.");
      }

      setLeads(data.leads || []);
      setProfile(data.profile || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesSearch =
        !query ||
        String(lead.customer_name || "").toLowerCase().includes(query) ||
        String(lead.whatsapp_number || "").toLowerCase().includes(query) ||
        String(lead.business_name || "").toLowerCase().includes(query) ||
        String(lead.service_requested || "").toLowerCase().includes(query) ||
        String(lead.location || "").toLowerCase().includes(query) ||
        String(lead.notes || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ? true : lead.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [leads, search, statusFilter]);

  const newCount = leads.filter((lead) => lead.status === "new").length;
  const collectingCount = leads.filter(
    (lead) => lead.status === "collecting_details"
  ).length;
  const qualifiedCount = leads.filter(
    (lead) => lead.status === "qualified"
  ).length;
  const humanCount = leads.filter(
    (lead) => lead.status === "needs_human_follow_up"
  ).length;

  function formatDate(dateString: string | null) {
    if (!dateString) return "No date";

    return new Date(dateString).toLocaleString("en-NG", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatStatus(status: string | null) {
    if (!status) return "new";

    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function getStatusClass(status: string | null) {
    if (status === "qualified") {
      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
    }

    if (status === "needs_human_follow_up") {
      return "border-amber-400/30 bg-amber-500/15 text-amber-300";
    }

    if (status === "closed") {
      return "border-slate-500/30 bg-slate-500/15 text-slate-300";
    }

    if (status === "collecting_details") {
      return "border-blue-400/30 bg-blue-500/15 text-blue-300";
    }

    return "border-purple-400/30 bg-purple-500/15 text-purple-300";
  }

  async function handleStatusChange(leadId: string, nextStatus: string) {
    try {
      setUpdatingId(leadId);
      setMessage(null);
      setError(null);

      const response = await fetch(`/api/dashboard/leads/${leadId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update lead status.");
      }

      setMessage(data?.message || "Lead status updated successfully.");

      setLeads((currentLeads) =>
        currentLeads.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                status: nextStatus,
                updated_at: new Date().toISOString(),
              }
            : lead
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update lead status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07131f] px-4 py-6 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-8 text-center shadow-xl">
            <p className="text-sm font-medium text-slate-300">
              Loading leads...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07131f] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-400 transition hover:text-white"
            >
              ← Back to dashboard
            </Link>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
              Leads
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Review captured WhatsApp leads, qualify opportunities, and send
              important cases to human follow-up.
            </p>

            {profile?.email ? (
              <p className="mt-2 text-xs text-slate-500">
                Logged in as {profile.email}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/businesses"
              className="rounded-xl border border-white/10 bg-[#0d1b2a] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#122338]"
            >
              Businesses
            </Link>

            <Link
              href="/dashboard/conversations"
              className="rounded-xl border border-white/10 bg-[#0d1b2a] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#122338]"
            >
              Conversations
            </Link>

            <Link
              href="/dashboard/invites"
              className="rounded-xl border border-white/10 bg-[#0d1b2a] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#122338]"
            >
              Invites
            </Link>
          </div>
        </div>

        {message ? (
          <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Total leads
            </p>
            <p className="mt-2 text-3xl font-bold text-white">{leads.length}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              New
            </p>
            <p className="mt-2 text-3xl font-bold text-purple-300">
              {newCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {collectingCount} collecting
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Qualified
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">
              {qualifiedCount}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Human follow-up
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-300">
              {humanCount}
            </p>
          </div>
        </div>

        <section className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Lead list</h2>
              <p className="mt-1 text-sm text-slate-400">
                Update lead statuses and track customer intent.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search leads"
                className="h-10 w-full rounded-xl border border-white/10 bg-[#122338] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/50 sm:w-72"
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | "all"
                      | "new"
                      | "collecting_details"
                      | "qualified"
                      | "needs_human_follow_up"
                      | "closed"
                  )
                }
                className="h-10 rounded-xl border border-white/10 bg-[#122338] px-3 text-sm text-white outline-none transition focus:border-emerald-400/50"
              >
                <option value="all">All</option>
                <option value="new">New</option>
                <option value="collecting_details">Collecting details</option>
                <option value="qualified">Qualified</option>
                <option value="needs_human_follow_up">Needs human</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#122338] p-8 text-center">
              <p className="text-sm font-medium text-white">No leads found</p>
              <p className="mt-1 text-sm text-slate-400">
                Try changing your search or filter.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-2xl border border-white/10 bg-[#122338] p-4 shadow-sm transition hover:border-white/20 hover:bg-[#162c45]"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-white">
                          {lead.customer_name || "Unknown Customer"}
                        </h3>

                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusClass(
                            lead.status
                          )}`}
                        >
                          {formatStatus(lead.status)}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-sm text-slate-400">
                        {lead.business_name || "Business"} •{" "}
                        {lead.whatsapp_number || "No phone"}
                      </p>

                      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border border-white/10 bg-[#0d1b2a] px-3 py-2">
                          <p className="text-xs text-slate-500">Service</p>
                          <p className="mt-1 truncate font-medium text-slate-200">
                            {lead.service_requested || "Not provided"}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-[#0d1b2a] px-3 py-2">
                          <p className="text-xs text-slate-500">Budget</p>
                          <p className="mt-1 truncate font-medium text-slate-200">
                            {lead.budget || "Not provided"}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-[#0d1b2a] px-3 py-2">
                          <p className="text-xs text-slate-500">Date needed</p>
                          <p className="mt-1 truncate font-medium text-slate-200">
                            {lead.date_needed || "Not provided"}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-[#0d1b2a] px-3 py-2">
                          <p className="text-xs text-slate-500">Location</p>
                          <p className="mt-1 truncate font-medium text-slate-200">
                            {lead.location || "Not provided"}
                          </p>
                        </div>
                      </div>

                      {lead.notes ? (
                        <p className="mt-3 rounded-xl border border-white/10 bg-[#0d1b2a] px-3 py-2 text-sm leading-6 text-slate-300">
                          {lead.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 sm:w-56">
                      <select
                        value={lead.status || "new"}
                        disabled={updatingId === lead.id}
                        onChange={(event) =>
                          handleStatusChange(lead.id, event.target.value)
                        }
                        className="h-10 rounded-xl border border-white/10 bg-[#0d1b2a] px-3 text-sm text-white outline-none transition focus:border-emerald-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {leadStatuses.map((status) => (
                          <option key={status} value={status}>
                            {formatStatus(status)}
                          </option>
                        ))}
                      </select>

                      {lead.conversation_id ? (
                        <Link
                          href={`/dashboard/conversations/${lead.conversation_id}`}
                          className="rounded-xl border border-white/10 bg-[#0d1b2a] px-3 py-2 text-center text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#1a304a]"
                        >
                          Open conversation
                        </Link>
                      ) : null}

                      <p className="text-xs text-slate-500">
                        Created {formatDate(lead.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}