"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type School = {
  id: string;
  name: string | null;
  type: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  location: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AssignedUser = {
  id: string;
  email: string;
  role: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

type PhoneNumber = {
  id: string | null;
  school_id: string;
  phone_number: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  provider: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type SetupCheck = {
  key: string;
  label: string;
  ok: boolean;
};

type Counts = {
  pupils: number;
  guardian_numbers: number;
  activity_logs: number;
  active_phone_numbers: number;
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

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat("en-NG").format(value || 0);
}

export default function SchoolDetailPage() {
  const router = useRouter();
  const params = useParams();

  const schoolId = typeof params.id === "string" ? params.id : params.id?.[0];

  const [school, setSchool] = useState<School | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [setupChecks, setSetupChecks] = useState<SetupCheck[]>([]);
  const [counts, setCounts] = useState<Counts>({
    pupils: 0,
    guardian_numbers: 0,
    activity_logs: 0,
    active_phone_numbers: 0,
  });

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const readiness = useMemo(() => {
    if (setupChecks.length === 0) {
      return {
        ready: 0,
        total: 0,
        percent: 0,
      };
    }

    const ready = setupChecks.filter((item) => item.ok).length;
    const total = setupChecks.length;
    const percent = Math.round((ready / total) * 100);

    return {
      ready,
      total,
      percent,
    };
  }, [setupChecks]);

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  function fillForm(nextSchool: School) {
    setSchool(nextSchool);
    setName(nextSchool.name || "");
    setType(nextSchool.type || "");
    setDescription(nextSchool.description || "");
    setPhone(nextSchool.phone || "");
    setWhatsapp(nextSchool.whatsapp || "");
    setEmail(nextSchool.email || "");
    setLocation(nextSchool.location || "");
  }

  async function loadSchool() {
    if (!schoolId) return;

    try {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch(`/api/admin/schools/${schoolId}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load school.");
      }

      fillForm(result.school);
      setAssignedUsers(result.assignedUsers || []);
      setPhoneNumbers(result.phoneNumbers || []);
      setSetupChecks(result.setupChecks || []);
      setCounts(
        result.counts || {
          pupils: 0,
          guardian_numbers: 0,
          activity_logs: 0,
          active_phone_numbers: 0,
        }
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load school."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSchool();
  }, [schoolId]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!schoolId) return;

    if (!name.trim()) {
      setErrorMessage("School name is required.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch(`/api/admin/schools/${schoolId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          type,
          description,
          phone,
          whatsapp,
          email,
          location,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save school.");
      }

      fillForm(result.school);
      setSuccessMessage("School updated successfully.");

      await loadSchool();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save school."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-center py-24">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
            <span className="text-sm text-slate-300">
              Loading school setup...
            </span>
          </div>
        </div>
      </main>
    );
  }

  if (errorMessage && !school) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
        <div className="mx-auto max-w-6xl">
          <button
            onClick={() => router.back()}
            className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-200">
            {errorMessage}
          </div>
        </div>
      </main>
    );
  }

  if (!school) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-slate-400">
            School not found.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to schools
        </button>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-300">
                <GraduationCap className="h-3.5 w-3.5" />
                School Setup
              </div>

              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {school.name || "Unnamed School"}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Admin setup page for school profile, assigned users, WhatsApp
                number configuration, pupil counts, guardian authorization, and
                readiness checks. Private pupil activity details are not shown
                here.
              </p>
            </div>

            <div className="rounded-3xl border border-indigo-400/20 bg-indigo-400/10 p-5 md:min-w-[220px]">
              <p className="text-sm text-indigo-100/80">Setup readiness</p>
              <p className="mt-2 text-4xl font-black">{readiness.percent}%</p>
              <p className="mt-1 text-xs text-indigo-100/70">
                {readiness.ready} of {readiness.total} checks ready
              </p>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        ) : null}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <UserRound className="mb-4 h-5 w-5 text-indigo-400" />
            <p className="text-3xl font-black">
              {formatNumber(counts.pupils)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Pupil count</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <Users className="mb-4 h-5 w-5 text-indigo-400" />
            <p className="text-3xl font-black">
              {formatNumber(counts.guardian_numbers)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Guardian numbers</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <Smartphone className="mb-4 h-5 w-5 text-indigo-400" />
            <p className="text-3xl font-black">
              {formatNumber(counts.active_phone_numbers)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Active school numbers</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <ShieldCheck className="mb-4 h-5 w-5 text-indigo-400" />
            <p className="text-3xl font-black">
              {formatNumber(counts.activity_logs)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Activity notes</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form
            onSubmit={handleSave}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
          >
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <GraduationCap className="h-5 w-5 text-indigo-400" />
              School information
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  School name
                </label>

                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="School name"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  School type
                </label>

                <input
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  placeholder="Primary school, nursery, secondary school..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Phone
                </label>

                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="School phone"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  WhatsApp
                </label>

                <div className="relative">
                  <Smartphone className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                  <input
                    value={whatsapp}
                    onChange={(event) => setWhatsapp(event.target.value)}
                    placeholder="School WhatsApp"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Email
                </label>

                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="School email"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Location
                </label>

                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="School location"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Description / setup notes
                </label>

                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={5}
                  placeholder="School description, setup notes, operating information..."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save School
                </>
              )}
            </button>
          </form>

          <div className="grid gap-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <CheckCircle2 className="h-5 w-5 text-indigo-400" />
                Setup checklist
              </h2>

              <div className="grid gap-3">
                {setupChecks.map((check) => (
                  <div
                    key={check.key}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3"
                  >
                    <span className="text-sm text-slate-300">
                      {check.label}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        check.ok
                          ? "bg-indigo-400/10 text-indigo-300"
                          : "bg-amber-400/10 text-amber-200"
                      }`}
                    >
                      {check.ok ? "Ready" : "Needed"}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Users className="h-5 w-5 text-indigo-400" />
                Assigned school users
              </h2>

              {assignedUsers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-500">
                  No users assigned to this school yet.
                </div>
              ) : (
                <div className="grid gap-3">
                  {assignedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
                    >
                      <p className="font-semibold text-white">
                        {user.email || "No email"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatRole(user.role)}
                      </p>
                      <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5 text-indigo-400" />
                        Last sign in: {formatDate(user.last_sign_in_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <Link
                href="/dashboard/users"
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
              >
                Manage Users
              </Link>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Smartphone className="h-5 w-5 text-indigo-400" />
                School WhatsApp numbers
              </h2>

              {phoneNumbers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-500">
                  No school WhatsApp number connected yet.
                </div>
              ) : (
                <div className="grid gap-3">
                  {phoneNumbers.map((item, index) => (
                    <div
                      key={item.id || index}
                      className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
                    >
                      <p className="font-semibold text-white">
                        {item.display_phone_number ||
                          item.phone_number ||
                          "School WhatsApp Number"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Phone number ID: {item.phone_number_id || "Not set"}
                      </p>

                      <span
                        className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          item.is_active
                            ? "bg-indigo-400/10 text-indigo-300"
                            : "bg-slate-400/10 text-slate-300"
                        }`}
                      >
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <Link
                href="/dashboard/whatsapp-numbers"
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
              >
                Manage WhatsApp Numbers
              </Link>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}