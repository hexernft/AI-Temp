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
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type TeamMember = {
  id: string;
  email: string;
  created_at: string | null;
  last_sign_in_at: string | null;
  role: string | null;
  business_id: string | null;
  school_id: string | null;
};

type Workspace = {
  type: "business" | "school";
  id: string;
  name: string | null;
} | null;

type Profile = {
  id: string;
  role: string | null;
  business_id: string | null;
  school_id: string | null;
};

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

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [workspace, setWorkspace] = useState<Workspace>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isSchoolTeam = profile?.role === "school_admin";
  const memberRoleLabel = isSchoolTeam ? "Teacher" : "Staff";
  const workspaceLabel = isSchoolTeam ? "School" : "Business";

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  async function loadTeam() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/team", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load team.");
      }

      setMembers(result.members || []);
      setWorkspace(result.workspace || null);
      setProfile(result.profile || null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load team."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTeam();
  }, []);

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return members;

    return members.filter((member) => {
      return (
        member.email.toLowerCase().includes(query) ||
        (member.role || "").toLowerCase().includes(query)
      );
    });
  }, [members, searchQuery]);

  function resetForm() {
    setEmail("");
    setPassword("");
    setShowPassword(false);
  }

  async function handleCreateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) {
      setErrorMessage("Email is required.");
      return;
    }

    if (!password.trim() || password.trim().length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    try {
      setIsCreating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create team member.");
      }

      setSuccessMessage(`${memberRoleLabel} account created successfully.`);
      resetForm();
      await loadTeam();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to create team member."
      );
    } finally {
      setIsCreating(false);
    }
  }

  const highlightClasses = isSchoolTeam
    ? {
        pill: "border-indigo-400/20 bg-indigo-400/10 text-indigo-300",
        icon: "text-indigo-400",
        focus: "focus:border-indigo-400/60",
        button: "bg-indigo-400 hover:bg-indigo-300 text-slate-950",
        success: "border-indigo-500/20 bg-indigo-500/10 text-indigo-200",
      }
    : {
        pill: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
        icon: "text-emerald-400",
        focus: "focus:border-emerald-400/60",
        button: "bg-emerald-400 hover:bg-emerald-300 text-slate-950",
        success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
      };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div
            className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${highlightClasses.pill}`}
          >
            {isSchoolTeam ? (
              <GraduationCap className="h-3.5 w-3.5" />
            ) : (
              <Users className="h-3.5 w-3.5" />
            )}
            Team Management
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Team
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {isSchoolTeam
                  ? "Create teacher accounts for your school. Teachers are automatically assigned to your school workspace."
                  : "Create staff accounts for your business. Staff are automatically assigned to your business workspace."}
              </p>

              <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                {isSchoolTeam ? (
                  <GraduationCap className={`h-4 w-4 ${highlightClasses.icon}`} />
                ) : (
                  <Building2 className={`h-4 w-4 ${highlightClasses.icon}`} />
                )}
                {workspaceLabel}: {workspace?.name || "Not assigned"}
              </div>
            </div>

            <button
              onClick={loadTeam}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className={`h-4 w-4 animate-spin ${highlightClasses.icon}`} />
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
          <div
            className={`mb-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${highlightClasses.success}`}
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <form
            onSubmit={handleCreateMember}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center gap-2">
              <UserPlus className={`h-5 w-5 ${highlightClasses.icon}`} />
              <h2 className="text-lg font-semibold">
                Create {memberRoleLabel}
              </h2>
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
                    placeholder="team@email.com"
                    className={`w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 ${highlightClasses.focus}`}
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
                    className={`w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-12 text-sm text-white outline-none placeholder:text-slate-500 ${highlightClasses.focus}`}
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
                  Give this password to the new {memberRoleLabel.toLowerCase()}.
                  They can change it later from Settings.
                </p>
              </div>

              <div
                className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${highlightClasses.pill}`}
              >
                This account will be created as{" "}
                <strong>{memberRoleLabel}</strong> and assigned automatically to{" "}
                <strong>{workspace?.name || `your ${workspaceLabel.toLowerCase()}`}</strong>.
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${highlightClasses.button}`}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create {memberRoleLabel}
                  </>
                )}
              </button>
            </div>
          </form>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {memberRoleLabel} list
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredMembers.length} of {members.length} members shown
                </p>
              </div>

              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search team..."
                  className={`w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 ${highlightClasses.focus}`}
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-400">
                <Loader2
                  className={`mr-2 h-4 w-4 animate-spin ${highlightClasses.icon}`}
                />
                Loading team...
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm leading-6 text-slate-500">
                No {memberRoleLabel.toLowerCase()} accounts found yet.
              </div>
            ) : (
              <div className="grid max-h-[760px] gap-3 overflow-y-auto pr-1">
                {filteredMembers.map((member) => (
                  <article
                    key={member.id}
                    className="rounded-3xl border border-white/10 bg-slate-900/70 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold text-white">
                          {member.email || "No email"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${highlightClasses.pill}`}
                          >
                            {isSchoolTeam ? (
                              <GraduationCap className="h-3.5 w-3.5" />
                            ) : (
                              <Users className="h-3.5 w-3.5" />
                            )}
                            {formatRole(member.role)}
                          </span>

                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-300">
                            {workspace?.name || workspaceLabel}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-1 text-xs leading-5 text-slate-500">
                          <p>Created: {formatDate(member.created_at)}</p>
                          <p>Last sign in: {formatDate(member.last_sign_in_at)}</p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-xs text-slate-500">
                        ID: {member.id.slice(0, 8)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}