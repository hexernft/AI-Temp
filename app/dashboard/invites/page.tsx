"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type UserRole = "super_admin" | "business_owner" | "staff" | string;

type InviteRole = "business_owner" | "staff";

type InviteStatus = "pending" | "accepted" | "expired" | "cancelled" | string;

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
};

type Business = {
  id: string;
  business_name: string | null;
  business_type: string | null;
  category: string | null;
  owner_email: string | null;
};

type Invite = {
  id: string;
  business_id: string | null;
  email: string;
  full_name: string | null;
  invited_role: InviteRole;
  status: InviteStatus;
  invited_by: string | null;
  accepted_by: string | null;
  token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  business: Business | Business[] | null;
};

type BusinessOption = {
  id: string;
  business_name: string | null;
  business_type: string | null;
  category: string | null;
  owner_email: string | null;
};

export default function InvitesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);

  const [businessId, setBusinessId] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [invitedRole, setInvitedRole] = useState<InviteRole>("staff");

  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "accepted" | "cancelled" | "expired"
  >("all");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPageData() {
    try {
      setLoading(true);
      setError(null);

      const [invitesResponse, businessesResponse] = await Promise.all([
        fetch("/api/dashboard/invites", {
          method: "GET",
          cache: "no-store",
        }),
        fetch("/api/dashboard/businesses", {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      const invitesData = await invitesResponse.json();
      const businessesData = await businessesResponse.json();

      if (!invitesResponse.ok) {
        throw new Error(invitesData?.error || "Failed to load invites.");
      }

      if (!businessesResponse.ok) {
        throw new Error(
          businessesData?.error || "Failed to load businesses."
        );
      }

      const loadedProfile =
        invitesData.profile || businessesData.profile || null;

      const availableBusinesses = businessesData.businesses || [];

      setProfile(loadedProfile);
      setInvites(invitesData.invites || []);
      setBusinesses(availableBusinesses);

      if (!businessId && availableBusinesses.length > 0) {
        setBusinessId(availableBusinesses[0].id);
      }

      if (loadedProfile?.role === "super_admin") {
        setInvitedRole("business_owner");
      }

      if (loadedProfile?.role === "business_owner") {
        setInvitedRole("staff");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invites.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, []);

  const filteredInvites = useMemo(() => {
    const query = search.trim().toLowerCase();

    return invites.filter((invite) => {
      const business = getInviteBusiness(invite);
      const businessName = getBusinessName(business);

      const matchesSearch =
        !query ||
        invite.email.toLowerCase().includes(query) ||
        String(invite.full_name || "").toLowerCase().includes(query) ||
        businessName.toLowerCase().includes(query) ||
        invite.invited_role.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ? true : invite.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invites, search, statusFilter]);

  const pendingInvitesCount = invites.filter(
    (invite) => invite.status === "pending"
  ).length;

  const acceptedInvitesCount = invites.filter(
    (invite) => invite.status === "accepted"
  ).length;

  const cancelledInvitesCount = invites.filter(
    (invite) => invite.status === "cancelled"
  ).length;

  const canCreateInvites =
    profile?.role === "super_admin" || profile?.role === "business_owner";

  const canInviteBusinessOwner = profile?.role === "super_admin";

  function getInviteBusiness(invite: Invite) {
    if (Array.isArray(invite.business)) {
      return invite.business[0] || null;
    }

    return invite.business || null;
  }

  function getBusinessName(business: Business | BusinessOption | null) {
    if (!business) return "No business";

    return (
      business.business_name ||
      business.business_type ||
      business.category ||
      "Business"
    );
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return "No date";

    return new Date(dateString).toLocaleString("en-NG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getRoleLabel(role: InviteRole) {
    if (role === "business_owner") return "Business Owner";
    return "Staff";
  }

  function getStatusClass(status: InviteStatus) {
    if (status === "pending") {
      return "border-amber-400/30 bg-amber-500/15 text-amber-300";
    }

    if (status === "accepted") {
      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
    }

    if (status === "cancelled") {
      return "border-slate-500/30 bg-slate-500/15 text-slate-300";
    }

    if (status === "expired") {
      return "border-red-400/30 bg-red-500/15 text-red-300";
    }

    return "border-blue-400/30 bg-blue-500/15 text-blue-300";
  }

  async function handleCreateInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setCreating(true);
      setMessage(null);
      setError(null);

      const cleanEmail = email.trim().toLowerCase();

      if (!businessId) {
        throw new Error("Select a business first.");
      }

      if (!cleanEmail) {
        throw new Error("Invite email is required.");
      }

      const response = await fetch("/api/dashboard/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          business_id: businessId,
          email: cleanEmail,
          full_name: fullName.trim(),
          invited_role: invitedRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to create invite.");
      }

      setEmail("");
      setFullName("");
      setMessage(data?.message || "Invite created successfully.");

      await loadPageData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite.");
    } finally {
      setCreating(false);
    }
  }

  async function handleInviteAction(
    inviteId: string,
    action: "cancel" | "accept"
  ) {
    const confirmed =
      action === "cancel"
        ? window.confirm("Cancel this pending invite?")
        : window.confirm("Accept this invite?");

    if (!confirmed) return;

    try {
      setUpdatingId(inviteId);
      setMessage(null);
      setError(null);

      const response = await fetch("/api/dashboard/invites", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invite_id: inviteId,
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update invite.");
      }

      setMessage(data?.message || "Invite updated successfully.");

      await loadPageData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update invite.");
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
              Loading invites...
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
              Invites
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Invite business owners and staff members into the platform, track
              pending invites, and accept invites linked to your email.
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
              href="/dashboard/leads"
              className="rounded-xl border border-white/10 bg-[#0d1b2a] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#122338]"
            >
              Leads
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
              Total invites
            </p>
            <p className="mt-2 text-3xl font-bold text-white">
              {invites.length}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Pending
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-300">
              {pendingInvitesCount}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Accepted
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">
              {acceptedInvitesCount}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Cancelled
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-300">
              {cancelledInvitesCount}
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <section className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Create invite</h2>

            <p className="mt-1 text-sm leading-6 text-slate-400">
              {canCreateInvites
                ? "Create an invite for a user to accept after signing up."
                : "Only admins and business owners can create invites."}
            </p>

            {canCreateInvites ? (
              <form onSubmit={handleCreateInvite} className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="business"
                    className="text-sm font-medium text-slate-300"
                  >
                    Business
                  </label>

                  <select
                    id="business"
                    value={businessId}
                    onChange={(event) => setBusinessId(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#122338] px-3 text-sm text-white outline-none transition focus:border-emerald-400/50"
                  >
                    {businesses.length === 0 ? (
                      <option value="">No businesses available</option>
                    ) : (
                      businesses.map((business) => (
                        <option key={business.id} value={business.id}>
                          {getBusinessName(business)}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="invite-email"
                    className="text-sm font-medium text-slate-300"
                  >
                    Email
                  </label>

                  <input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="client@example.com"
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#122338] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="full-name"
                    className="text-sm font-medium text-slate-300"
                  >
                    Full name optional
                  </label>

                  <input
                    id="full-name"
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Client name"
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#122338] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="invite-role"
                    className="text-sm font-medium text-slate-300"
                  >
                    Invite role
                  </label>

                  <select
                    id="invite-role"
                    value={invitedRole}
                    onChange={(event) =>
                      setInvitedRole(event.target.value as InviteRole)
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#122338] px-3 text-sm text-white outline-none transition focus:border-emerald-400/50"
                  >
                    {canInviteBusinessOwner ? (
                      <option value="business_owner">Business Owner</option>
                    ) : null}
                    <option value="staff">Staff</option>
                  </select>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Super admins can invite business owners or staff. Business
                    owners can invite staff only.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={creating || businesses.length === 0}
                  className="h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? "Creating invite..." : "Create invite"}
                </button>
              </form>
            ) : (
              <div className="mt-5 rounded-2xl border border-white/10 bg-[#122338] p-4">
                <p className="text-sm text-slate-300">
                  You can still accept pending invites that match your account
                  email.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Invite list
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Manage pending and accepted invites.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search invites"
                  className="h-10 w-full rounded-xl border border-white/10 bg-[#122338] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/50 sm:w-56"
                />

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as
                        | "all"
                        | "pending"
                        | "accepted"
                        | "cancelled"
                        | "expired"
                    )
                  }
                  className="h-10 rounded-xl border border-white/10 bg-[#122338] px-3 text-sm text-white outline-none transition focus:border-emerald-400/50"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>

            <div className="mt-5">
              {filteredInvites.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#122338] p-8 text-center">
                  <p className="text-sm font-medium text-white">
                    No invites found
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Create an invite or adjust your filters.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredInvites.map((invite) => {
                    const business = getInviteBusiness(invite);
                    const canAccept =
                      invite.status === "pending" &&
                      profile?.email?.toLowerCase() ===
                        invite.email.toLowerCase();

                    const canCancel =
                      invite.status === "pending" &&
                      (profile?.role === "super_admin" ||
                        profile?.role === "business_owner");

                    return (
                      <div
                        key={invite.id}
                        className="rounded-2xl border border-white/10 bg-[#122338] p-4 shadow-sm transition hover:border-white/20 hover:bg-[#162c45]"
                      >
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-white">
                                {invite.full_name || invite.email}
                              </p>

                              <span
                                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusClass(
                                  invite.status
                                )}`}
                              >
                                {invite.status}
                              </span>

                              <span className="rounded-full border border-purple-400/30 bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-300">
                                {getRoleLabel(invite.invited_role)}
                              </span>
                            </div>

                            <p className="mt-1 truncate text-sm text-slate-400">
                              {invite.email}
                            </p>

                            <p className="mt-1 truncate text-xs text-slate-500">
                              {getBusinessName(business)} • Expires{" "}
                              {formatDate(invite.expires_at)}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {canAccept ? (
                              <button
                                type="button"
                                disabled={updatingId === invite.id}
                                onClick={() =>
                                  handleInviteAction(invite.id, "accept")
                                }
                                className="h-9 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {updatingId === invite.id
                                  ? "Accepting..."
                                  : "Accept"}
                              </button>
                            ) : null}

                            {canCancel ? (
                              <button
                                type="button"
                                disabled={updatingId === invite.id}
                                onClick={() =>
                                  handleInviteAction(invite.id, "cancel")
                                }
                                className="h-9 rounded-xl border border-red-400/30 bg-red-500/10 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {updatingId === invite.id
                                  ? "Cancelling..."
                                  : "Cancel"}
                              </button>
                            ) : null}

                            <Link
                              href={
                                invite.business_id
                                  ? `/dashboard/businesses/${invite.business_id}`
                                  : "/dashboard/businesses"
                              }
                              className="h-9 rounded-xl border border-white/10 bg-[#0d1b2a] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#1a304a]"
                            >
                              Business
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}