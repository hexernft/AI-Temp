"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Loader2,
  NotebookPen,
  Save,
  ShieldCheck,
  UserRound,
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

type Activity = {
  id: string;
  school_id: string;
  pupil_id: string;
  activity_date: string;
  title: string | null;
  details: string;
  created_by: string | null;
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
  activities: Activity[];
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getPupilName(pupil: Pupil | null) {
  if (!pupil) return "Pupil";

  return `${pupil.first_name || ""} ${pupil.last_name || ""}`.trim();
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getGuardianBySlot(pupil: Pupil | null, slot: number) {
  return (pupil?.guardians || []).find(
    (guardian) => guardian.slot_number === slot
  );
}

export default function PupilDetailPage() {
  const router = useRouter();
  const params = useParams();

  const pupilId = typeof params.id === "string" ? params.id : params.id?.[0];

  const [pupil, setPupil] = useState<Pupil | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [className, setClassName] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [guardian1Name, setGuardian1Name] = useState("");
  const [guardian1Relationship, setGuardian1Relationship] = useState("");
  const [guardian1Phone, setGuardian1Phone] = useState("");

  const [guardian2Name, setGuardian2Name] = useState("");
  const [guardian2Relationship, setGuardian2Relationship] = useState("");
  const [guardian2Phone, setGuardian2Phone] = useState("");

  const [activityDate, setActivityDate] = useState(todayDate());
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDetails, setActivityDetails] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPupil, setIsSavingPupil] = useState(false);
  const [isAddingActivity, setIsAddingActivity] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const sortedActivities = useMemo(() => {
    return [...(pupil?.activities || [])].sort((a, b) => {
      const first = new Date(a.activity_date || a.created_at || "").getTime();
      const second = new Date(b.activity_date || b.created_at || "").getTime();

      return second - first;
    });
  }, [pupil?.activities]);

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  function fillForm(nextPupil: Pupil) {
    const guardian1 = getGuardianBySlot(nextPupil, 1);
    const guardian2 = getGuardianBySlot(nextPupil, 2);

    setPupil(nextPupil);

    setFirstName(nextPupil.first_name || "");
    setLastName(nextPupil.last_name || "");
    setClassName(nextPupil.class_name || "");
    setAdmissionNumber(nextPupil.admission_number || "");
    setDateOfBirth(nextPupil.date_of_birth || "");
    setNotes(nextPupil.notes || "");
    setIsActive(nextPupil.is_active !== false);

    setGuardian1Name(guardian1?.guardian_name || "");
    setGuardian1Relationship(guardian1?.relationship || "");
    setGuardian1Phone(guardian1?.phone || "");

    setGuardian2Name(guardian2?.guardian_name || "");
    setGuardian2Relationship(guardian2?.relationship || "");
    setGuardian2Phone(guardian2?.phone || "");
  }

  async function loadPupil() {
    if (!pupilId) return;

    try {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch(`/api/pupils/${pupilId}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load pupil.");
      }

      fillForm(result.pupil);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load pupil."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPupil();
  }, [pupilId]);

  async function handleSavePupil(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pupilId) return;

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
      setIsSavingPupil(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch(`/api/pupils/${pupilId}`, {
        method: "PATCH",
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
          is_active: isActive,

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
        throw new Error(result.error || "Failed to save pupil.");
      }

      setSuccessMessage("Pupil updated successfully.");
      await loadPupil();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save pupil."
      );
    } finally {
      setIsSavingPupil(false);
    }
  }

  async function handleAddActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pupilId) return;

    if (!activityDetails.trim()) {
      setErrorMessage("Activity details are required.");
      return;
    }

    try {
      setIsAddingActivity(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch(`/api/pupils/${pupilId}/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          activity_date: activityDate,
          title: activityTitle,
          details: activityDetails,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to add activity.");
      }

      setSuccessMessage("Activity note added successfully.");
      setActivityDate(todayDate());
      setActivityTitle("");
      setActivityDetails("");

      await loadPupil();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to add activity."
      );
    } finally {
      setIsAddingActivity(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-center py-24">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
            <span className="text-sm text-slate-300">Loading pupil...</span>
          </div>
        </div>
      </main>
    );
  }

  if (errorMessage && !pupil) {
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

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to pupils
        </button>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-300">
            <GraduationCap className="h-3.5 w-3.5" />
            Pupil Profile
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {getPupilName(pupil)}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Edit pupil information, manage two authorized guardian numbers,
                and add dated activity notes.
              </p>
            </div>

            <div className="rounded-3xl border border-indigo-400/20 bg-indigo-400/10 p-5 md:min-w-[220px]">
              <p className="text-sm text-indigo-100/80">Activity notes</p>
              <p className="mt-2 text-4xl font-black">
                {pupil?.activities?.length || 0}
              </p>
              <p className="mt-1 text-xs text-indigo-100/70">
                Guardian numbers: {pupil?.guardians?.length || 0}
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

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <form
            onSubmit={handleSavePupil}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
          >
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <UserRound className="h-5 w-5 text-indigo-400" />
              Pupil information
            </h2>

            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="First name"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                />

                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Last name"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                  placeholder="Class"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                />

                <input
                  value={admissionNumber}
                  onChange={(event) => setAdmissionNumber(event.target.value)}
                  placeholder="Admission number"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                />
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

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                placeholder="General pupil notes"
                className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
              />

              <button
                type="button"
                onClick={() => setIsActive((current) => !current)}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                  isActive
                    ? "border-indigo-400/20 bg-indigo-400/10 text-indigo-300"
                    : "border-slate-400/20 bg-slate-400/10 text-slate-300"
                }`}
              >
                {isActive ? "Pupil active" : "Pupil inactive"}
              </button>

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
                    placeholder="Relationship"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />

                  <input
                    value={guardian1Phone}
                    onChange={(event) => setGuardian1Phone(event.target.value)}
                    placeholder="Phone with country code"
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
                    placeholder="Relationship"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />

                  <input
                    value={guardian2Phone}
                    onChange={(event) => setGuardian2Phone(event.target.value)}
                    placeholder="Phone with country code"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingPupil}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingPupil ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Pupil
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="grid gap-6">
            <form
              onSubmit={handleAddActivity}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
            >
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <NotebookPen className="h-5 w-5 text-indigo-400" />
                Add activity note
              </h2>

              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Date
                  </label>

                  <input
                    type="date"
                    value={activityDate}
                    onChange={(event) => setActivityDate(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400/60"
                  />
                </div>

                <input
                  value={activityTitle}
                  onChange={(event) => setActivityTitle(event.target.value)}
                  placeholder="Optional title e.g. Classwork, Feeding, Behaviour"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                />

                <textarea
                  value={activityDetails}
                  onChange={(event) => setActivityDetails(event.target.value)}
                  rows={6}
                  placeholder="Write details about the pupil's school activity for this date..."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                />

                <button
                  type="submit"
                  disabled={isAddingActivity}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAddingActivity ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding
                    </>
                  ) : (
                    <>
                      <NotebookPen className="h-4 w-4" />
                      Add Activity
                    </>
                  )}
                </button>
              </div>
            </form>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <CalendarDays className="h-5 w-5 text-indigo-400" />
                Activity history
              </h2>

              {sortedActivities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-500">
                  No activity notes have been added for this pupil yet.
                </div>
              ) : (
                <div className="grid max-h-[720px] gap-3 overflow-y-auto pr-1">
                  {sortedActivities.map((activity) => (
                    <article
                      key={activity.id}
                      className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-300">
                          {formatDate(activity.activity_date)}
                        </span>

                        {activity.title ? (
                          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-300">
                            {activity.title}
                          </span>
                        ) : null}
                      </div>

                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {activity.details}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}