"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type StaffRole = "staff" | "manager";

type StaffAssignment = {
  id: string;
  business_id: string;
  user_id: string;
  role: StaffRole;
  created_at: string;
  updated_at: string;
  profile: {
    id: string;
    email: string | null;
    full_name: string | null;
    role: string | null;
  } | null;
};

export default function BusinessStaffPage() {
  const params = useParams();
  const businessId = params.id as string;

  const [staff, setStaff] = useState<StaffAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");

  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadStaff() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/dashboard/businesses/${businessId}/staff`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load staff.");
      }

      setStaff(data.staff || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (businessId) {
      loadStaff();
    }
  }, [businessId]);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return staff;

    return staff.filter((item) => {
      const name = item.profile?.full_name || "";
      const email = item.profile?.email || "";
      const role = item.role || "";

      return (
        name.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query) ||
        role.toLowerCase().includes(query)
      );
    });
  }, [staff, search]);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString("en-NG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getRoleLabel(staffRole: StaffRole) {
    if (staffRole === "manager") return "Manager";
    return "Staff";
  }

  function getRoleClass(staffRole: StaffRole) {
    if (staffRole === "manager") {
      return "border-purple-400/30 bg-purple-500/15 text-purple-300";
    }

    return "border-blue-400/30 bg-blue-500/15 text-blue-300";
  }

  async function handleAddStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage(null);
      setError(null);

      const cleanEmail = email.trim().toLowerCase();

      if (!cleanEmail) {
        throw new Error("Staff email is required.");
      }

      const response = await fetch(
        `/api/dashboard/businesses/${businessId}/staff`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanEmail,
            role,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to assign staff member.");
      }

      setEmail("");
      setRole("staff");
      setMessage(data?.message || "Staff member assigned successfully.");

      await loadStaff();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to assign staff member."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeRole(assignmentId: string, nextRole: StaffRole) {
    try {
      setMessage(null);
      setError(null);

      const response = await fetch(
        `/api/dashboard/businesses/${businessId}/staff`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignmentId,
            role: nextRole,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update staff role.");
      }

      setMessage(data?.message || "Staff role updated successfully.");

      setStaff((currentStaff) =>
        currentStaff.map((item) =>
          item.id === assignmentId ? { ...item, role: nextRole } : item
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update staff role."
      );
    }
  }

  async function handleRemoveStaff(assignmentId: string) {
    const confirmed = window.confirm(
      "Remove this staff member from this business?"
    );

    if (!confirmed) return;

    try {
      setMessage(null);
      setError(null);

      const response = await fetch(
        `/api/dashboard/businesses/${businessId}/staff`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignmentId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to remove staff member.");
      }

      setMessage(data?.message || "Staff member removed successfully.");

      setStaff((currentStaff) =>
        currentStaff.filter((item) => item.id !== assignmentId)
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove staff member."
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#07131f] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href={`/dashboard/businesses/${businessId}`}
              className="text-sm font-medium text-slate-400 transition hover:text-white"
            >
              ← Back to business
            </Link>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
              Staff Management
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Assign team members to this business so they can help manage
              conversations and leads without accessing admin-only settings.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] px-5 py-4 shadow-xl">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Assigned staff
            </p>
            <p className="mt-1 text-3xl font-bold text-white">
              {staff.length}
            </p>
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

        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <section className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Add staff member
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                The staff member must already have an account on the platform.
              </p>
            </div>

            <form onSubmit={handleAddStaff} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="staff-email"
                  className="text-sm font-medium text-slate-300"
                >
                  Staff email
                </label>

                <input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="staff@example.com"
                  className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#122338] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/50"
                />
              </div>

              <div>
                <label
                  htmlFor="staff-role"
                  className="text-sm font-medium text-slate-300"
                >
                  Staff permission
                </label>

                <select
                  id="staff-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as StaffRole)}
                  className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#122338] px-3 text-sm text-white outline-none transition focus:border-emerald-400/50"
                >
                  <option value="staff" className="bg-[#122338]">
                    Staff
                  </option>
                  <option value="manager" className="bg-[#122338]">
                    Manager
                  </option>
                </select>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Staff can help with conversations and leads. Manager is for a
                  senior staff member assigned to the business.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Assigning..." : "Assign staff"}
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Assigned team
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Staff listed here are connected to this business.
                </p>
              </div>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search staff"
                className="h-10 w-full rounded-xl border border-white/10 bg-[#122338] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/50 sm:w-64"
              />
            </div>

            <div className="mt-5">
              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-[#122338] p-6 text-center">
                  <p className="text-sm text-slate-400">Loading staff...</p>
                </div>
              ) : filteredStaff.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#122338] p-6 text-center">
                  <p className="text-sm font-medium text-white">
                    No staff found
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Assign a staff member using the form.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredStaff.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#122338] px-4 py-3 shadow-sm transition hover:border-white/20 hover:bg-[#162c45] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">
                            {item.profile?.full_name || "Unnamed user"}
                          </p>

                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getRoleClass(
                              item.role
                            )}`}
                          >
                            {getRoleLabel(item.role)}
                          </span>
                        </div>

                        <p className="mt-1 truncate text-sm text-slate-400">
                          {item.profile?.email || "No email"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Added {formatDate(item.created_at)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <select
                          value={item.role}
                          onChange={(event) =>
                            handleChangeRole(
                              item.id,
                              event.target.value as StaffRole
                            )
                          }
                          className="h-9 rounded-xl border border-white/10 bg-[#0d1b2a] px-3 text-xs font-medium text-slate-200 outline-none transition focus:border-emerald-400/50"
                        >
                          <option value="staff" className="bg-[#0d1b2a]">
                            Staff
                          </option>
                          <option value="manager" className="bg-[#0d1b2a]">
                            Manager
                          </option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveStaff(item.id)}
                          className="h-9 rounded-xl border border-red-400/30 bg-red-500/10 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-5 rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
          <h2 className="text-lg font-semibold text-white">
            Staff access note
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Assigned staff can access this business, its conversations, and its
            leads. They cannot edit admin-only settings like WhatsApp
            credentials or assistant activation.
          </p>
        </div>
      </div>
    </main>
  );
}