"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Loader2,
  NotebookPen,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Guardian = {
  id: string;
  school_id: string;
  pupil_id: string;
  guardian_name: string | null;
  relationship: string | null;
  phone: string;
  slot_number: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type Pupil = {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string | null;
  class_name: string | null;
  admission_number: string | null;
  date_of_birth: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  guardians: Guardian[];
  guardian_count: number;
  activity_count: number;
};

function getPupilName(pupil: Pupil) {
  return `${pupil.first_name || ""} ${pupil.last_name || ""}`.trim();
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default function PupilsPage() {
  const [pupils, setPupils] = useState<Pupil[]>([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [className, setClassName] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [notes, setNotes] = useState("");

  const [guardian1Name, setGuardian1Name] = useState("");
  const [guardian1Relationship, setGuardian1Relationship] = useState("");
  const [guardian1Phone, setGuardian1Phone] = useState("");

  const [guardian2Name, setGuardian2Name] = useState("");
  const [guardian2Relationship, setGuardian2Relationship] = useState("");
  const [guardian2Phone, setGuardian2Phone] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  async function loadPupils() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/pupils", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load pupils.");
      }

      setPupils(result.pupils || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load pupils."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPupils();
  }, []);

  const filteredPupils = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return pupils;

    return pupils.filter((pupil) => {
      const guardianPhones = (pupil.guardians || [])
        .map((guardian) => guardian.phone)
        .join(" ");

      return (
        getPupilName(pupil).toLowerCase().includes(query) ||
        (pupil.class_name || "").toLowerCase().includes(query) ||
        (pupil.admission_number || "").toLowerCase().includes(query) ||
        guardianPhones.toLowerCase().includes(query)
      );
    });
  }, [pupils, searchQuery]);

  function resetForm() {
    setFirstName("");
    setLastName("");
    setClassName("");
    setAdmissionNumber("");
    setDateOfBirth("");
    setNotes("");

    setGuardian1Name("");
    setGuardian1Relationship("");
    setGuardian1Phone("");

    setGuardian2Name("");
    setGuardian2Relationship("");
    setGuardian2Phone("");
  }

  async function handleCreatePupil(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firstName.trim()) {
      setErrorMessage("Pupil first name is required.");
      return;
    }

    if (
      guardian1Phone.trim() &&
      guardian2Phone.trim() &&
      guardian1Phone.replace(/[^\d]/g, "") ===
        guardian2Phone.replace(/[^\d]/g, "")
    ) {
      setErrorMessage("Authorized phone 1 and phone 2 must be different.");
      return;
    }

    try {
      setIsCreating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/pupils", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          class_name: className,
          admission_number: admissionNumber,
          date_of_birth: dateOfBirth,
          notes,

          guardian_1_name: guardian1Name,
          guardian_1_relationship: guardian1Relationship,
          guardian_1_phone: guardian1Phone,

          guardian_2_name: guardian2Name,
          guardian_2_relationship: guardian2Relationship,
          guardian_2_phone: guardian2Phone,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create pupil.");
      }

      setSuccessMessage("Pupil created successfully.");
      resetForm();
      await loadPupils();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create pupil."
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-300">
            <GraduationCap className="h-3.5 w-3.5" />
            School Center
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Pupils
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Create pupil records and assign up to two authorized guardian
                phone numbers. Only those numbers can request AI information
                about the pupil.
              </p>
            </div>

            <button
              onClick={loadPupils}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
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
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form
            onSubmit={handleCreatePupil}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-400" />
              <h2 className="text-lg font-semibold">Create pupil</h2>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    First name
                  </label>

                  <input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="First name"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Last name
                  </label>

                  <input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Last name"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Class
                  </label>

                  <input
                    value={className}
                    onChange={(event) => setClassName(event.target.value)}
                    placeholder="Nursery 1, Primary 3..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Admission number
                  </label>

                  <input
                    value={admissionNumber}
                    onChange={(event) => setAdmissionNumber(event.target.value)}
                    placeholder="Admission number"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Date of birth
                </label>

                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400/60"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Notes
                </label>

                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="General pupil notes"
                  className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                />
              </div>

              <div className="rounded-3xl border border-indigo-400/20 bg-indigo-400/10 p-4">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-indigo-200">
                  <ShieldCheck className="h-5 w-5" />
                  Authorized phone 1
                </h3>

                <div className="grid gap-4">
                  <input
                    value={guardian1Name}
                    onChange={(event) => setGuardian1Name(event.target.value)}
                    placeholder="Guardian name"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />

                  <input
                    value={guardian1Relationship}
                    onChange={(event) =>
                      setGuardian1Relationship(event.target.value)
                    }
                    placeholder="Relationship e.g. Mother, Father"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />

                  <input
                    value={guardian1Phone}
                    onChange={(event) => setGuardian1Phone(event.target.value)}
                    placeholder="Phone with country code e.g. 234..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-indigo-400/20 bg-indigo-400/10 p-4">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-indigo-200">
                  <ShieldCheck className="h-5 w-5" />
                  Authorized phone 2
                </h3>

                <div className="grid gap-4">
                  <input
                    value={guardian2Name}
                    onChange={(event) => setGuardian2Name(event.target.value)}
                    placeholder="Guardian name"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />

                  <input
                    value={guardian2Relationship}
                    onChange={(event) =>
                      setGuardian2Relationship(event.target.value)
                    }
                    placeholder="Relationship e.g. Mother, Father"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />

                  <input
                    value={guardian2Phone}
                    onChange={(event) => setGuardian2Phone(event.target.value)}
                    placeholder="Phone with country code e.g. 234..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Pupil
                  </>
                )}
              </button>
            </div>
          </form>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Pupil list</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredPupils.length} of {pupils.length} pupils shown
                </p>
              </div>

              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search pupils..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-400" />
                Loading pupils...
              </div>
            ) : filteredPupils.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm leading-6 text-slate-500">
                No pupils found yet. Create your first pupil record.
              </div>
            ) : (
              <div className="grid max-h-[860px] gap-3 overflow-y-auto pr-1">
                {filteredPupils.map((pupil) => (
                  <article
                    key={pupil.id}
                    className="rounded-3xl border border-white/10 bg-slate-900/70 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold text-white">
                          {getPupilName(pupil)}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          {pupil.class_name || "No class"} · Admission:{" "}
                          {pupil.admission_number || "Not set"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-300">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {pupil.guardian_count} authorized numbers
                          </span>

                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-300">
                            <NotebookPen className="h-3.5 w-3.5" />
                            {pupil.activity_count} activity notes
                          </span>

                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              pupil.is_active
                                ? "bg-indigo-400/10 text-indigo-300"
                                : "bg-slate-400/10 text-slate-300"
                            }`}
                          >
                            {pupil.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-2 text-sm text-slate-400">
                          {(pupil.guardians || []).map((guardian) => (
                            <p
                              key={guardian.id}
                              className="flex items-center gap-2"
                            >
                              <Phone className="h-4 w-4 text-indigo-400" />
                              Slot {guardian.slot_number}: {guardian.phone}
                              {guardian.guardian_name
                                ? ` · ${guardian.guardian_name}`
                                : ""}
                            </p>
                          ))}
                        </div>

                        <p className="mt-3 text-xs text-slate-500">
                          Date of birth: {formatDate(pupil.date_of_birth)}
                        </p>
                      </div>

                      <Link
                        href={`/dashboard/pupils/${pupil.id}`}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300"
                      >
                        Open Pupil
                        <ArrowRight className="h-4 w-4" />
                      </Link>
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