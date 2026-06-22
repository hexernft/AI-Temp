"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatusBadge from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase";

type FirstTimer = {
  id: string;
  full_name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  gender: string | null;
  age_range: string | null;
  location: string;
  invited_by: string | null;
  how_heard: string | null;
  prayer_request: string | null;
  preferred_contact_method: string | null;
  has_been_baptized: boolean | null;
  baptized_when: string | null;
  baptized_where: string | null;
  wants_contact: boolean;
  interested_foundation_school: boolean;
  interested_baptism: boolean;
  status: string;
  stage: string;
  source: string;
  assigned_to: string | null;
  service_date: string;
  created_at: string;
};

type FollowUp = {
  id: string;
  method: string;
  outcome: string;
  note: string | null;
  next_action: string | null;
  next_action_date: string | null;
  created_at: string;
};

type WorkerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
};

const statusOptions = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "no_response", label: "No Response" },
  { value: "interested", label: "Interested" },
  { value: "visited_again", label: "Visited Again" },
  { value: "needs_attention", label: "Needs Attention" },
  { value: "inactive", label: "Inactive" },
  { value: "active", label: "Active" },
];

const stageOptions = [
  { value: "first_visit", label: "First Visit" },
  { value: "follow_up", label: "Follow-Up" },
  { value: "second_visit", label: "Second Visit" },
  { value: "foundation_school", label: "Foundation School" },
  {
    value: "foundation_school_completed",
    label: "Foundation Completed",
  },
  { value: "baptism_ready", label: "Baptism Ready" },
  { value: "baptized", label: "Baptized" },
  { value: "membership", label: "Membership" },
  { value: "serving", label: "Serving" },
  { value: "general_growth", label: "General Growth" },
];

const methodOptions = [
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "physical_visit", label: "Physical Visit" },
  { value: "church_conversation", label: "Church Conversation" },
  { value: "other", label: "Other" },
];

function formatLabel(value: string | null | undefined) {
  if (!value) return "Not provided";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatRole(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  return new Date(value).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function cleanPhoneNumber(value: string) {
  return value.replace(/\D/g, "");
}

function getWhatsAppLink(value: string) {
  const cleaned = cleanPhoneNumber(value);

  if (cleaned.startsWith("0")) {
    return `https://wa.me/234${cleaned.slice(1)}`;
  }

  if (cleaned.startsWith("234")) {
    return `https://wa.me/${cleaned}`;
  }

  return `https://wa.me/${cleaned}`;
}

function formatBaptizedStatus(value: boolean | null) {
  if (value === null) return "Not provided";
  return value ? "Yes" : "No";
}

export default function FirstTimerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [person, setPerson] = useState<FirstTimer | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [savingStatus, setSavingStatus] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);

  const [status, setStatus] = useState("new");
  const [stage, setStage] = useState("first_visit");
  const [assignedTo, setAssignedTo] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [deletingFirstTimer, setDeletingFirstTimer] = useState(false);

  const [followUpForm, setFollowUpForm] = useState({
    method: "call",
    outcome: "",
    note: "",
    next_action: "",
    next_action_date: "",
  });

  const whatsappNumber = useMemo(() => {
    if (!person) return "";
    return person.whatsapp || person.phone;
  }, [person]);

  const assignedWorkerId = person?.assigned_to || "";

  const assignedWorker = useMemo(() => {
    if (!assignedWorkerId) return null;
    return workers.find((worker) => worker.id === assignedWorkerId) || null;
  }, [assignedWorkerId, workers]);

  useEffect(() => {
    async function loadProfile() {
      if (!id) return;

      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        setCurrentUserRole(currentProfile?.role || "");
      }

      const { data: firstTimerData, error: firstTimerError } = await supabase
        .from("first_timers")
        .select("*")
        .eq("id", id)
        .single();

      if (firstTimerError) {
        console.error("First timer profile load error:", firstTimerError);
        setLoading(false);
        return;
      }

      setPerson(firstTimerData);
      setStatus(firstTimerData.status);
      setStage(firstTimerData.stage);
      setAssignedTo(firstTimerData.assigned_to || "");

      const { data: followUpData, error: followUpError } = await supabase
        .from("follow_ups")
        .select(
          "id, method, outcome, note, next_action, next_action_date, created_at"
        )
        .eq("first_timer_id", id)
        .order("created_at", { ascending: false });

      if (followUpError) {
        console.error("Follow-up load error:", followUpError);
      }

      setFollowUps(followUpData || []);

      const { data: workerData, error: workerError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (workerError) {
        console.error("Workers load error:", workerError);
      }

      setWorkers(workerData || []);
      setLoading(false);
    }

    loadProfile();
  }, [id]);

  async function handleUpdateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!person) return;

    setSavingAssignment(true);

    const { error } = await supabase
      .from("first_timers")
      .update({
        assigned_to: assignedTo || null,
      })
      .eq("id", person.id);

    setSavingAssignment(false);

    if (error) {
      alert(error.message);
      return;
    }

    setPerson({
      ...person,
      assigned_to: assignedTo || null,
    });

    alert("Assignment updated.");
  }

  async function handleUpdateProgress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!person) return;

    setSavingStatus(true);

    const { error } = await supabase
      .from("first_timers")
      .update({
        status,
        stage,
      })
      .eq("id", person.id);

    setSavingStatus(false);

    if (error) {
      alert(error.message);
      return;
    }

    setPerson({
      ...person,
      status,
      stage,
    });

    alert("Progress updated.");
  }

  async function handleAddFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!person) return;

    setSavingFollowUp(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("follow_ups")
      .insert({
        first_timer_id: person.id,
        worker_id: user?.id || null,
        method: followUpForm.method,
        outcome: followUpForm.outcome.trim(),
        note: followUpForm.note.trim(),
        next_action: followUpForm.next_action.trim(),
        next_action_date: followUpForm.next_action_date || null,
      })
      .select(
        "id, method, outcome, note, next_action, next_action_date, created_at"
      )
      .single();

    setSavingFollowUp(false);

    if (error) {
      alert(error.message);
      return;
    }

    setFollowUps((current) => [data, ...current]);

    setFollowUpForm({
      method: "call",
      outcome: "",
      note: "",
      next_action: "",
      next_action_date: "",
    });

    if (person.status === "new") {
      const nextStage =
        person.stage === "first_visit" ? "follow_up" : person.stage;

      await supabase
        .from("first_timers")
        .update({
          status: "contacted",
          stage: nextStage,
        })
        .eq("id", person.id);

      setPerson({
        ...person,
        status: "contacted",
        stage: nextStage,
      });

      setStatus("contacted");
      setStage(nextStage);
    }

    alert("Follow-up note added.");
  }

  async function handleDeleteFirstTimer() {
    if (!person || currentUserRole !== "super_admin") return;

    const confirmed = window.confirm(
      `Delete ${person.full_name}? This will permanently remove this first-timer record and connected follow-ups.`
    );

    if (!confirmed) return;

    setDeletingFirstTimer(true);

    const { error: followUpDeleteError } = await supabase
      .from("follow_ups")
      .delete()
      .eq("first_timer_id", person.id);

    if (followUpDeleteError) {
      setDeletingFirstTimer(false);
      alert(followUpDeleteError.message);
      return;
    }

    const { data: deletedRows, error: firstTimerDeleteError } = await supabase
      .from("first_timers")
      .delete()
      .eq("id", person.id)
      .select("id");

    setDeletingFirstTimer(false);

    if (firstTimerDeleteError) {
      alert(firstTimerDeleteError.message);
      return;
    }

    if (!deletedRows || deletedRows.length === 0) {
      alert(
        "Delete was blocked or no record was removed. Please check the Supabase delete policy for super_admin."
      );
      return;
    }

    alert("First timer record deleted.");
    router.push("/first-timers");
    router.refresh();
  }
  if (loading) {
    return (
      <ProtectedRoute>
        <AppShell>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-bold text-slate-500">
              Loading profile...
            </p>
          </section>
        </AppShell>
      </ProtectedRoute>
    );
  }

  if (!person) {
    return (
      <ProtectedRoute>
        <AppShell>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-black text-slate-800">
              First timer not found.
            </p>

            <Link
              href="/first-timers"
              className="mt-3 inline-flex rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white"
            >
              Back to First Timers
            </Link>
          </section>
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="grid gap-4">
          <div>
            <Link
              href="/first-timers"
              className="text-[0.8rem] font-black text-slate-500 hover:text-slate-950"
            >
              ← Back to first timers
            </Link>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  First Timer Profile
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-[1.65rem] font-black leading-tight tracking-[-0.045em] text-slate-950">
                    {person.full_name}
                  </h1>

                  <StatusBadge status={person.status} />
                </div>

                <p className="mt-1 text-[0.86rem] text-slate-500">
                  First visited on {formatDate(person.service_date)}
                </p>

                <p className="mt-1 text-[0.82rem] text-slate-500">
                  Assigned to{" "}
                  <span className="font-black text-slate-800">
                    {assignedWorker?.full_name ||
                      assignedWorker?.email ||
                      "Not assigned"}
                  </span>
                </p>

                {currentUserRole === "super_admin" && (
                  <button
                    type="button"
                    onClick={handleDeleteFirstTimer}
                    disabled={deletingFirstTimer}
                    className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[0.82rem] font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                  >
                    {deletingFirstTimer ? "Deleting..." : "Delete Record"}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={`tel:${person.phone}`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition hover:bg-slate-50"
                >
                  Call
                </a>

                <a
                  href={getWhatsAppLink(whatsappNumber)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-[#25D366] px-3 py-2 text-[11px] font-black text-white transition hover:opacity-90"
                >
                  WhatsApp
                </a>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="grid gap-4">
              <Card title="Personal details">
                <div className="grid gap-2 md:grid-cols-2">
                  <Detail label="Phone" value={person.phone} />
                  <Detail
                    label="WhatsApp"
                    value={person.whatsapp || person.phone}
                  />
                  <Detail label="Email" value={person.email || "Not provided"} />
                  <Detail
                    label="Preferred Contact"
                    value={formatLabel(person.preferred_contact_method)}
                  />
                  <Detail label="Gender" value={formatLabel(person.gender)} />
                  <Detail
                    label="Age Range"
                    value={formatLabel(person.age_range)}
                  />
                  <Detail label="Location" value={person.location} />
                  <Detail
                    label="Invited By"
                    value={person.invited_by || "Not provided"}
                  />
                  <Detail
                    label="How They Heard"
                    value={formatLabel(person.how_heard)}
                  />
                  <Detail label="Source" value={formatLabel(person.source)} />
                </div>

                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                  <p className="text-[0.72rem] font-bold uppercase tracking-wide text-slate-400">
                    Prayer Request
                  </p>
                  <p className="mt-1 text-[0.84rem] leading-5 text-slate-700">
                    {person.prayer_request || "No prayer request submitted."}
                  </p>
                </div>
              </Card>

              <Card title="Baptism details">
                <div className="grid gap-2 md:grid-cols-3">
                  <Detail
                    label="Been Baptized?"
                    value={formatBaptizedStatus(person.has_been_baptized)}
                  />
                  <Detail
                    label="Baptized When"
                    value={person.baptized_when || "Not provided"}
                  />
                  <Detail
                    label="Baptized Where"
                    value={person.baptized_where || "Not provided"}
                  />
                </div>
              </Card>

              <Card title="Follow-up history">
                {followUps.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-5 text-center">
                    <p className="text-sm font-black text-slate-800">
                      No follow-up notes yet.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Add the first call, WhatsApp message, visit, or note.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {followUps.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 p-3"
                      >
                        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-start">
                          <div>
                            <p className="text-[0.88rem] font-black text-slate-950">
                              {formatLabel(item.method)}
                            </p>
                            <p className="mt-0.5 text-[0.76rem] text-slate-500">
                              {formatDate(item.created_at)}
                            </p>
                          </div>

                          {item.next_action_date && (
                            <p className="w-fit rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                              Next: {formatDate(item.next_action_date)}
                            </p>
                          )}
                        </div>

                        <TextBlock label="Outcome" value={item.outcome} />

                        {item.note && (
                          <TextBlock label="Note" value={item.note} />
                        )}

                        {item.next_action && (
                          <TextBlock
                            label="Next Action"
                            value={item.next_action}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <aside className="grid gap-4 self-start">
              <form
                onSubmit={handleUpdateAssignment}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h2 className="font-display text-[1rem] font-black text-slate-950">
                  Assign worker
                </h2>

                <div className="mt-3 grid gap-3">
                  <label className="grid gap-1.5">
                    <span className="text-[0.76rem] font-black text-slate-700">
                      Follow-up worker
                    </span>
                    <select
                      value={assignedTo}
                      onChange={(event) => setAssignedTo(event.target.value)}
                      className="input-compact"
                    >
                      <option value="">Not assigned</option>
                      {workers.map((worker) => (
                        <option key={worker.id} value={worker.id}>
                          {worker.full_name || worker.email || "Unnamed"} —{" "}
                          {formatRole(worker.role)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="submit"
                    disabled={savingAssignment}
                    className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {savingAssignment ? "Saving..." : "Save Assignment"}
                  </button>
                </div>
              </form>

              <form
                onSubmit={handleUpdateProgress}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h2 className="font-display text-[1rem] font-black text-slate-950">
                  Update progress
                </h2>

                <div className="mt-3 grid gap-3">
                  <label className="grid gap-1.5">
                    <span className="text-[0.76rem] font-black text-slate-700">
                      Follow-up status
                    </span>
                    <select
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                      className="input-compact"
                    >
                      {statusOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-[0.76rem] font-black text-slate-700">
                      Growth stage
                    </span>
                    <select
                      value={stage}
                      onChange={(event) => setStage(event.target.value)}
                      className="input-compact"
                    >
                      {stageOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="submit"
                    disabled={savingStatus}
                    className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {savingStatus ? "Saving..." : "Save Progress"}
                  </button>
                </div>
              </form>

              <form
                onSubmit={handleAddFollowUp}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h2 className="font-display text-[1rem] font-black text-slate-950">
                  Add follow-up
                </h2>

                <div className="mt-3 grid gap-3">
                  <label className="grid gap-1.5">
                    <span className="text-[0.76rem] font-black text-slate-700">
                      Method
                    </span>
                    <select
                      value={followUpForm.method}
                      onChange={(event) =>
                        setFollowUpForm((current) => ({
                          ...current,
                          method: event.target.value,
                        }))
                      }
                      className="input-compact"
                    >
                      {methodOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-[0.76rem] font-black text-slate-700">
                      Outcome *
                    </span>
                    <input
                      required
                      value={followUpForm.outcome}
                      onChange={(event) =>
                        setFollowUpForm((current) => ({
                          ...current,
                          outcome: event.target.value,
                        }))
                      }
                      className="input-compact"
                      placeholder="Example: Will attend next Sunday"
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-[0.76rem] font-black text-slate-700">
                      Note
                    </span>
                    <textarea
                      value={followUpForm.note}
                      onChange={(event) =>
                        setFollowUpForm((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                      className="input-compact min-h-20 resize-y"
                      placeholder="Conversation details"
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-[0.76rem] font-black text-slate-700">
                      Next action
                    </span>
                    <input
                      value={followUpForm.next_action}
                      onChange={(event) =>
                        setFollowUpForm((current) => ({
                          ...current,
                          next_action: event.target.value,
                        }))
                      }
                      className="input-compact"
                      placeholder="Example: Remind about service"
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-[0.76rem] font-black text-slate-700">
                      Next action date
                    </span>
                    <input
                      type="date"
                      value={followUpForm.next_action_date}
                      onChange={(event) =>
                        setFollowUpForm((current) => ({
                          ...current,
                          next_action_date: event.target.value,
                        }))
                      }
                      className="input-compact"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={savingFollowUp}
                    className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {savingFollowUp ? "Adding..." : "Add Follow-Up"}
                  </button>
                </div>
              </form>
            </aside>
          </section>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-display text-[1rem] font-black text-slate-950">
        {title}
      </h2>

      <div className="mt-3">{children}</div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[0.68rem] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-[0.84rem] font-bold text-slate-700">{value}</p>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3">
      <p className="text-[0.7rem] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-[0.84rem] leading-5 text-slate-700">{value}</p>
    </div>
  );
}


