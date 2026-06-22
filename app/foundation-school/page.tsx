"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatusBadge from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase";

type FoundationPerson = {
  id: string;
  full_name: string;
  phone: string;
  whatsapp: string | null;
  location: string;
  status: string;
  stage: string;
  service_date: string;
  interested_foundation_school: boolean;
};

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

function formatStage(value: string) {
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

export default function FoundationSchoolPage() {
  const [people, setPeople] = useState<FoundationPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  useEffect(() => {
    async function loadPeople() {
      setLoading(true);

      const { data, error } = await supabase
        .from("first_timers")
        .select(
          "id, full_name, phone, whatsapp, location, status, stage, service_date, interested_foundation_school"
        )
        .or(
          "stage.eq.foundation_school,stage.eq.foundation_school_completed,interested_foundation_school.eq.true"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Foundation school load error:", error);
        alert(error.message || "Could not load foundation school records.");
        setLoading(false);
        return;
      }

      setPeople(data || []);
      setLoading(false);
    }

    loadPeople();
  }, []);

  async function handleUpdateStage(
    event: FormEvent<HTMLFormElement>,
    personId: string
  ) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const nextStage = String(formData.get("stage") || "");

    if (!nextStage) {
      alert("Please select a stage.");
      return;
    }

    setSavingId(personId);

    const { error } = await supabase
      .from("first_timers")
      .update({
        stage: nextStage,
      })
      .eq("id", personId);

    setSavingId("");

    if (error) {
      alert(error.message);
      return;
    }

    setPeople((current) =>
      current.map((person) =>
        person.id === personId
          ? {
              ...person,
              stage: nextStage,
            }
          : person
      )
    );

    alert("Foundation school progress updated.");
  }

  const filteredPeople = useMemo(() => {
    return people.filter((person) => {
      const searchValue = search.toLowerCase().trim();

      const matchesSearch =
        !searchValue ||
        person.full_name.toLowerCase().includes(searchValue) ||
        person.phone.toLowerCase().includes(searchValue) ||
        person.location.toLowerCase().includes(searchValue) ||
        person.stage.toLowerCase().includes(searchValue);

      const matchesStage =
        stageFilter === "all" || person.stage === stageFilter;

      return matchesSearch && matchesStage;
    });
  }, [people, search, stageFilter]);

  const interestedCount = people.filter(
    (person) => person.interested_foundation_school
  ).length;

  const inProgressCount = people.filter(
    (person) => person.stage === "foundation_school"
  ).length;

  const completedCount = people.filter(
    (person) => person.stage === "foundation_school_completed"
  ).length;

  const baptismReadyCount = people.filter(
    (person) => person.stage === "baptism_ready"
  ).length;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="grid gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Foundation School
                </p>

                <h1 className="mt-1 font-display text-[1.55rem] font-black leading-tight tracking-[-0.045em] text-slate-950">
                  Foundation tracker
                </h1>

                <p className="mt-1 max-w-2xl text-[0.86rem] leading-5 text-slate-500">
                  Track people who are interested, currently attending, or have
                  completed foundation school.
                </p>
              </div>

              <Link
                href="/first-timers"
                className="w-fit rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition hover:bg-slate-50"
              >
                View First Timers
              </Link>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Interested" value={interestedCount} />
            <MiniStat label="In progress" value={inProgressCount} />
            <MiniStat label="Completed" value={completedCount} />
            <MiniStat label="Baptism ready" value={baptismReadyCount} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid gap-2 md:grid-cols-[1fr_220px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[0.85rem] outline-none transition focus:border-slate-950"
                placeholder="Search by name, phone, location, or stage"
              />

              <select
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[0.85rem] outline-none transition focus:border-slate-950"
              >
                <option value="all">All foundation records</option>
                <option value="foundation_school">Foundation School</option>
                <option value="foundation_school_completed">
                  Foundation Completed
                </option>
                <option value="baptism_ready">Baptism Ready</option>
              </select>
            </div>
          </section>

          {loading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-500">
                Loading foundation records...
              </p>
            </section>
          ) : filteredPeople.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-black text-slate-800">
                No foundation records found.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                People who show interest or enter foundation school will appear
                here.
              </p>
            </section>
          ) : (
            <section className="grid gap-3">
              {filteredPeople.map((person) => {
                const whatsappNumber = person.whatsapp || person.phone;

                return (
                  <div
                    key={person.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                  >
                    <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-display text-[1.05rem] font-black text-slate-950">
                            {person.full_name}
                          </h2>

                          <StatusBadge status={person.status} />

                          {person.interested_foundation_school && (
                            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                              Interested
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-[0.78rem] text-slate-500">
                          First visited on {formatDate(person.service_date)}
                        </p>

                        <div className="mt-3 grid gap-2 text-[0.82rem] text-slate-600 md:grid-cols-3">
                          <Info label="Phone" value={person.phone} />
                          <Info label="Location" value={person.location} />
                          <Info label="Stage" value={formatStage(person.stage)} />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
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

                          <Link
                            href={`/first-timers/${person.id}`}
                            className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800"
                          >
                            View Profile
                          </Link>
                        </div>
                      </div>

                      <form
                        onSubmit={(event) =>
                          handleUpdateStage(event, person.id)
                        }
                        className="rounded-xl bg-slate-50 p-3"
                      >
                        <label className="mb-1.5 block text-[0.78rem] font-black text-slate-700">
                          Update growth stage
                        </label>

                        <select
                          name="stage"
                          defaultValue={person.stage}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[0.85rem] outline-none transition focus:border-slate-950"
                        >
                          {stageOptions.map((stage) => (
                            <option key={stage.value} value={stage.value}>
                              {stage.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="submit"
                          disabled={savingId === person.id}
                          className="mt-2 w-full rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                        >
                          {savingId === person.id ? "Saving..." : "Save"}
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[0.72rem] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-display text-[1.45rem] font-black leading-none text-slate-950">
        {value}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-black text-slate-800">{label}:</span> {value}
    </p>
  );
}