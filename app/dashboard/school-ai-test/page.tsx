"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  GraduationCap,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
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
  guardians: Guardian[];
};

type School = {
  id: string;
  name: string | null;
  type: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  location: string | null;
};

type TestResult = {
  reply: string;
  authorization: {
    authorized: boolean;
    guardian: Guardian;
    pupil: {
      id: string;
      name: string;
      class_name: string | null;
      admission_number: string | null;
    };
  };
  context: {
    school_name: string | null;
    activity_count: number;
  };
};

function getPupilName(pupil: Pupil) {
  return `${pupil.first_name || ""} ${pupil.last_name || ""}`.trim();
}

export default function SchoolAiTestPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [pupils, setPupils] = useState<Pupil[]>([]);

  const [selectedPupilId, setSelectedPupilId] = useState("");
  const [selectedPhone, setSelectedPhone] = useState("");
  const [message, setMessage] = useState("");

  const [result, setResult] = useState<TestResult | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedPupil = useMemo(() => {
    return pupils.find((pupil) => pupil.id === selectedPupilId) || null;
  }, [pupils, selectedPupilId]);

  const selectedGuardians = selectedPupil?.guardians || [];

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  async function loadTestData() {
    try {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/school-ai-test", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load school AI test data.");
      }

      setSchool(data.school || null);
      setPupils(data.pupils || []);

      const firstPupil = data.pupils?.[0];

      if (firstPupil) {
        setSelectedPupilId(firstPupil.id);
        setSelectedPhone(firstPupil.guardians?.[0]?.phone || "");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load school AI test data."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTestData();
  }, []);

  useEffect(() => {
    if (!selectedPupil) {
      setSelectedPhone("");
      return;
    }

    const firstGuardianPhone = selectedPupil.guardians?.[0]?.phone || "";
    setSelectedPhone(firstGuardianPhone);
    setResult(null);
    setErrorMessage("");
    setSuccessMessage("");
  }, [selectedPupilId]);

  async function handleTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPupilId) {
      setErrorMessage("Select a pupil first.");
      return;
    }

    if (!selectedPhone.trim()) {
      setErrorMessage("Select an authorized guardian phone number.");
      return;
    }

    if (!message.trim()) {
      setErrorMessage("Enter a test message.");
      return;
    }

    try {
      setIsTesting(true);
      setErrorMessage("");
      setSuccessMessage("");
      setResult(null);

      const token = await getAccessToken();

      const response = await fetch("/api/school-ai-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pupil_id: selectedPupilId,
          guardian_phone: selectedPhone,
          message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate test reply.");
      }

      setResult(data);
      setSuccessMessage("School AI test reply generated.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to generate test reply."
      );
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-300">
            <Bot className="h-3.5 w-3.5" />
            School AI Test
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Test School AI Replies
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Test guardian questions before using real WhatsApp. The test
                checks the selected guardian number against the selected pupil,
                then generates a reply using school profile and pupil activity
                notes.
              </p>

              {school ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                  <GraduationCap className="h-4 w-4 text-indigo-400" />
                  {school.name || "School"}
                </div>
              ) : null}
            </div>

            <button
              onClick={loadTestData}
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

        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-400" />
            Loading test data...
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <form
              onSubmit={handleTest}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
            >
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <MessageCircle className="h-5 w-5 text-indigo-400" />
                Test message
              </h2>

              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Pupil
                  </label>

                  <select
                    value={selectedPupilId}
                    onChange={(event) => setSelectedPupilId(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400/60"
                  >
                    <option value="">Select pupil</option>

                    {pupils.map((pupil) => (
                      <option key={pupil.id} value={pupil.id}>
                        {getPupilName(pupil)}{" "}
                        {pupil.class_name ? `· ${pupil.class_name}` : ""}
                      </option>
                    ))}
                  </select>

                  {pupils.length === 0 ? (
                    <p className="mt-2 text-xs leading-5 text-amber-200">
                      Add pupils first before testing school AI replies.
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Authorized guardian phone
                  </label>

                  <select
                    value={selectedPhone}
                    onChange={(event) => setSelectedPhone(event.target.value)}
                    disabled={!selectedPupil}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Select phone</option>

                    {selectedGuardians.map((guardian) => (
                      <option key={guardian.id} value={guardian.phone}>
                        Slot {guardian.slot_number}: {guardian.phone}
                        {guardian.guardian_name
                          ? ` · ${guardian.guardian_name}`
                          : ""}
                      </option>
                    ))}
                  </select>

                  {selectedPupil && selectedGuardians.length === 0 ? (
                    <p className="mt-2 text-xs leading-5 text-amber-200">
                      This pupil has no authorized guardian numbers yet.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-indigo-400/20 bg-indigo-400/10 p-4 text-sm leading-6 text-indigo-100">
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4" />
                    Authorization test
                  </div>
                  The selected phone must belong to the selected pupil. If it
                  does not, the API blocks the request just like the live webhook.
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Parent / guardian question
                  </label>

                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={6}
                    placeholder="Example: What did my child do today?"
                    className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isTesting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Testing
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Generate Test Reply
                    </>
                  )}
                </button>
              </div>
            </form>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Bot className="h-5 w-5 text-indigo-400" />
                AI reply preview
              </h2>

              {!result ? (
                <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm leading-6 text-slate-500">
                  Generate a test reply to preview what the guardian would
                  receive.
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="rounded-2xl border border-indigo-400/20 bg-indigo-400/10 p-4">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-300">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Authorized
                      </span>

                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-300">
                        <UserRound className="h-3.5 w-3.5" />
                        {result.authorization.pupil.name}
                      </span>

                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-300">
                        <Phone className="h-3.5 w-3.5" />
                        {result.authorization.guardian.phone}
                      </span>
                    </div>

                    <p className="text-xs text-indigo-100/80">
                      Context used: {result.context.activity_count} activity
                      notes from {result.context.school_name || "school"}.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Reply
                    </p>

                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
                      {result.reply}
                    </p>
                  </div>
                </div>
              )}
            </section>
          </section>
        )}
      </div>
    </main>
  );
}