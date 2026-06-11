"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Business = {
  id: string;
  name: string | null;
};

type School = {
  id: string;
  name: string | null;
};

type UserRow = {
  id: string;
  email: string;
  created_at: string | null;
  last_sign_in_at: string | null;
  role: string | null;
  business_id: string | null;
  school_id: string | null;
};

const roleOptions = [
  {
    value: "business_owner",
    label: "Business Owner",
    workspace: "business",
  },
  {
    value: "school_admin",
    label: "School Admin",
    workspace: "school",
  },
  {
    value: "super_admin",
    label: "Super Admin",
    workspace: "platform",
  },
];

function formatDate(value?: string | null) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRole(value?: string | null) {
  if (!value) return "Unknown";

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getWorkspaceType(role: string) {
  if (role === "business_owner") return "business";
  if (role === "school_admin") return "school";
  return "platform";
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [schools, setSchools] = useState<School[]>([]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("business_owner");
  const [businessId, setBusinessId] = useState("");
  const [schoolId, setSchoolId] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedWorkspaceType = getWorkspaceType(role);

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  async function loadUsers() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/admin/users", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load users.");
      }

      setUsers(result.users || []);
      setBusinesses(result.businesses || []);
      setSchools(result.schools || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load users."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const businessMap = useMemo(() => {
    return new Map(businesses.map((business) => [business.id, business]));
  }, [businesses]);

  const schoolMap = useMemo(() => {
    return new Map(schools.map((school) => [school.id, school]));
  }, [schools]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return users;

    return users.filter((user) => {
      const business = user.business_id
        ? businessMap.get(user.business_id)
        : null;

      const school = user.school_id ? schoolMap.get(user.school_id) : null;

      return (
        user.email.toLowerCase().includes(query) ||
        (user.role || "").toLowerCase().includes(query) ||
        (business?.name || "").toLowerCase().includes(query) ||
        (school?.name || "").toLowerCase().includes(query)
      );
    });
  }, [users, searchQuery, businessMap, schoolMap]);

  function resetForm() {
    setEmail("");
    setPassword("");
    setRole("business_owner");
    setBusinessId("");
    setSchoolId("");
    setShowPassword(false);
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const workspaceType = getWorkspaceType(role);

    if (!email.trim()) {
      setErrorMessage("Email is required.");
      return;
    }

    if (!password.trim() || password.trim().length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (workspaceType === "business" && !businessId) {
      setErrorMessage("Business is required for business owner accounts.");
      return;
    }

    if (workspaceType === "school" && !schoolId) {
      setErrorMessage("School is required for school admin accounts.");
      return;
    }

    try {
      setIsCreating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          password,
          role,
          business_id: workspaceType === "business" ? businessId : null,
          school_id: workspaceType === "school" ? schoolId : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create user.");
      }

      setSuccessMessage("User created successfully.");
      resetForm();
      await loadUsers();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create user."
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Users className="h-3.5 w-3.5" />
            Platform Users
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Users
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Super admin creates platform admins, business owners, and school
                admins. Business owners create staff from their own Team page.
                School admins create teachers from their own Team page.
              </p>
            </div>

            <button
              onClick={loadUsers}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
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

        {successMessage ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <form
            onSubmit={handleCreateUser}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold">Create admin user</h2>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Email
                </label>

                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="user@email.com"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Temporary password
                </label>

                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-12 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-3.5 text-slate-500 hover:text-slate-300"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Give this password to the user. They can change it later from
                  Settings.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Role
                </label>

                <select
                  value={role}
                  onChange={(event) => {
                    const nextRole = event.target.value;

                    setRole(nextRole);

                    const nextWorkspace = getWorkspaceType(nextRole);

                    if (nextWorkspace !== "business") {
                      setBusinessId("");
                    }

                    if (nextWorkspace !== "school") {
                      setSchoolId("");
                    }
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedWorkspaceType === "business" ? (
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Assign business
                  </label>

                  <select
                    value={businessId}
                    onChange={(event) => setBusinessId(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60"
                  >
                    <option value="">Select business</option>

                    {businesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name || "Unnamed Business"}
                      </option>
                    ))}
                  </select>

                  {businesses.length === 0 ? (
                    <p className="mt-2 text-xs leading-5 text-amber-200">
                      Create a business first before creating a business owner.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {selectedWorkspaceType === "school" ? (
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Assign school
                  </label>

                  <select
                    value={schoolId}
                    onChange={(event) => setSchoolId(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400/60"
                  >
                    <option value="">Select school</option>

                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name || "Unnamed School"}
                      </option>
                    ))}
                  </select>

                  {schools.length === 0 ? (
                    <p className="mt-2 text-xs leading-5 text-amber-200">
                      Create a school first before creating a school admin.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {selectedWorkspaceType === "platform" ? (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
                  Super admin accounts are for platform management only and are
                  not assigned to a business or school.
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isCreating}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create User
                  </>
                )}
              </button>
            </div>
          </form>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">User list</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredUsers.length} of {users.length} users shown
                </p>
              </div>

              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search users..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm leading-6 text-slate-500">
                No users found. Create a user to give someone dashboard access.
              </div>
            ) : (
              <div className="grid max-h-[760px] gap-3 overflow-y-auto pr-1">
                {filteredUsers.map((user) => {
                  const business = user.business_id
                    ? businessMap.get(user.business_id)
                    : null;

                  const school = user.school_id
                    ? schoolMap.get(user.school_id)
                    : null;

                  const isSuperAdmin = user.role === "super_admin";
                  const isSchoolUser =
                    user.role === "school_admin" || user.role === "teacher";

                  return (
                    <article
                      key={user.id}
                      className="rounded-3xl border border-white/10 bg-slate-900/70 p-4"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold text-white">
                            {user.email || "No email"}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                                isSuperAdmin
                                  ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                                  : isSchoolUser
                                  ? "border-indigo-400/20 bg-indigo-400/10 text-indigo-300"
                                  : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                              }`}
                            >
                              {isSuperAdmin ? (
                                <ShieldCheck className="h-3.5 w-3.5" />
                              ) : isSchoolUser ? (
                                <GraduationCap className="h-3.5 w-3.5" />
                              ) : (
                                <Users className="h-3.5 w-3.5" />
                              )}
                              {formatRole(user.role)}
                            </span>

                            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-300">
                              {isSchoolUser ? (
                                <GraduationCap className="h-3.5 w-3.5" />
                              ) : (
                                <Building2 className="h-3.5 w-3.5" />
                              )}
                              {isSuperAdmin
                                ? "Platform"
                                : isSchoolUser
                                ? school?.name || "No school"
                                : business?.name || "No business"}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-1 text-xs leading-5 text-slate-500">
                            <p>Created: {formatDate(user.created_at)}</p>
                            <p>Last sign in: {formatDate(user.last_sign_in_at)}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-xs text-slate-500">
                          ID: {user.id.slice(0, 8)}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}