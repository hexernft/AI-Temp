"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Save,
  Settings,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  role: string | null;
  business_id: string | null;
  school_id: string | null;
};

function formatRole(role?: string | null) {
  if (!role) return "Unknown";

  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getWorkspaceType(profile: Profile | null) {
  if (profile?.role === "super_admin") return "Platform";
  if (profile?.role === "school_admin" || profile?.role === "teacher") {
    return "School Center";
  }

  return "Business Center";
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isSchoolTheme =
    profile?.role === "school_admin" || profile?.role === "teacher";

  const theme = isSchoolTheme
    ? {
        badge: "border-indigo-400/20 bg-indigo-400/10 text-indigo-300",
        button: "bg-indigo-400 hover:bg-indigo-300 text-slate-950",
        icon: "text-indigo-400",
        focus: "focus:border-indigo-400/60",
        success: "border-indigo-500/20 bg-indigo-500/10 text-indigo-200",
        spinner: "text-indigo-400",
      }
    : {
        badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
        button: "bg-emerald-400 hover:bg-emerald-300 text-slate-950",
        icon: "text-emerald-400",
        focus: "focus:border-emerald-400/60",
        success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
        spinner: "text-emerald-400",
      };

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        setSuccessMessage("");

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        if (!session) {
          window.location.replace("/login");
          return;
        }

        const userEmail = session.user.email || "";

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, role, business_id, school_id")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (profileError) {
          throw new Error(profileError.message);
        }

        setEmail(userEmail);
        setProfile(profileData || null);
      } catch (error) {
        if (!mounted) return;

        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load settings."
        );
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadAccount();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const cleanPassword = newPassword.trim();
    const cleanConfirmPassword = confirmPassword.trim();

    if (!cleanPassword) {
      setErrorMessage("Enter a new password.");
      return;
    }

    if (cleanPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (cleanPassword !== cleanConfirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      setIsSaving(true);

      const { error } = await supabase.auth.updateUser({
        password: cleanPassword,
      });

      if (error) {
        throw new Error(error.message);
      }

      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);

      setSuccessMessage(
        "Password changed successfully. You can continue using your account."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to change password."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 shadow-2xl">
          <Loader2 className={`h-5 w-5 animate-spin ${theme.spinner}`} />
          <span className="text-sm text-slate-300">Loading settings...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-5xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div
            className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${theme.badge}`}
          >
            <Settings className="h-3.5 w-3.5" />
            Account Settings
          </div>

          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Settings
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Manage your account details and update your password.
          </p>
        </section>

        {errorMessage ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {successMessage ? (
          <div
            className={`mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${theme.success}`}
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <UserRound className={`h-5 w-5 ${theme.icon}`} />
              Account
            </h2>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Email
                </p>
                <p className="mt-2 text-sm text-white">{email || "Not set"}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Role
                </p>
                <p className="mt-2 text-sm text-white">
                  {formatRole(profile?.role)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Workspace
                </p>
                <p className="mt-2 text-sm text-white">
                  {getWorkspaceType(profile)}
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 text-sm leading-6 ${theme.badge}`}
              >
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  Security note
                </div>
                Use a password that is hard to guess and different from other
                accounts.
              </div>
            </div>
          </section>

          <form
            onSubmit={handleChangePassword}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
          >
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Lock className={`h-5 w-5 ${theme.icon}`} />
              Change password
            </h2>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  New password
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setSuccessMessage("");
                      setErrorMessage("");
                    }}
                    placeholder="Enter new password"
                    className={`w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 pr-12 text-sm text-white outline-none placeholder:text-slate-500 ${theme.focus}`}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-3.5 text-slate-500 hover:text-white"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Confirm new password
                </label>

                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setSuccessMessage("");
                      setErrorMessage("");
                    }}
                    placeholder="Confirm new password"
                    className={`w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 pr-12 text-sm text-white outline-none placeholder:text-slate-500 ${theme.focus}`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword((current) => !current)
                    }
                    className="absolute right-4 top-3.5 text-slate-500 hover:text-white"
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${theme.button}`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Changing password
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Change Password
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}