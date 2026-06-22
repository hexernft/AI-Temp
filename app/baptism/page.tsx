"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatusBadge from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase";

type BaptismPerson = {
  id: string;
  full_name: string;
  phone: string;
  whatsapp: string | null;
  location: string;
  status: string;
  stage: string;
  service_date: string;
  has_been_baptized: boolean | null;
  baptized_when: string | null;
  baptized_where: string | null;
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

function baptismLabel(value: boolean | null) {
  if (value === null) return "Not provided";
  return value ? "Baptized" : "Not baptized";
}

export default function BaptismPage() {
  const [people, setPeople] = useState<BaptismPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function loadPeople() {
      setLoading(true);

      const { data, error } = await supabase
        .from("first_timers")
        .select(
          "id, full_name, phone, whatsapp, location, status, stage, service_date, has_been_baptized, baptized_when, baptized_where"
        )
        .or(
          "has_been_baptized.eq.false,stage.eq.baptism_ready,stage.eq.baptized,stage.eq.membership"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Baptism records load error:", error);
        alert(error.message || "Could not load baptism records.");
        setLoading(false);
        return;
      }

      setPeople(data || []);
      setLoading(false);
    }

    loadPeople();
  }, []);

  async function handleUpdateBaptism(
    event: FormEvent<HTMLFormElement>,
    personId: string
  ) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const nextStage = String(formData.get("stage") || "");
    const baptizedStatus = String(formData.get("has_been_baptized") || "");
    const baptizedWhen = String(formData.get("baptized_when") || "").trim();
    const baptizedWhere = String(formData.get("baptized_where") || "").trim();

    const hasBeenBaptized =
      baptizedStatus === "yes"
        ? true
        : baptizedStatus === "no"
          ? false
          : null;

    if (!nextStage) {
      alert("Please select a growth stage.");
      return;
    }

    setSavingId(personId);

    const { error } = await supabase
      .from("first_timers")
      .update({
        stage: nextStage,
        has_been_baptized: hasBeenBaptized,
        baptized_when: hasBeenBaptized ? baptizedWhen : "",
        baptized_where: hasBeenBaptized ? baptizedWhere : "",
        interested_baptism: hasBeenBaptized === false,
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
              has_been_baptized: hasBeenBaptized,
              baptized_when: hasBeenBaptized ? baptizedWhen : "",
              baptized_where: hasBeenBaptized ? baptizedWhere : "",
            }
          : person
      )
    );

    alert("Baptism record updated.");
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

      const matchesFilter =
        filter === "all" ||
        (filter === "not_baptized" && person.has_been_baptized === false) ||
        (filter === "baptized" && person.has_been_baptized === true) ||
        (filter === "baptism_ready" && person.stage === "baptism_ready") ||
        (filter === "membership" && person.stage === "membership");

      return matchesSearch && matchesFilter;
    });
  }, [filter, people, search]);

  const notBaptizedCount = people.filter(
    (person) => person.has_been_baptized === false
  ).length;

  const baptizedCount = people.filter(
    (person) => person.has_been_baptized === true
  ).length;

  const baptismReadyCount = people.filter(
    (person) => person.stage === "baptism_ready"
  ).length;

  const membershipCount = people.filter(
    (person) => person.stage === "membership"
  ).length;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="grid gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Baptism
                </p>

                <h1 className="mt-1 font-display text-[1.55rem] font-black leading-tight tracking-[-0.045em] text-slate-950">
                  Baptism tracker
                </h1>

                <p className="mt-1 max-w-2xl text-[0.86rem] leading-5 text-slate-500">
                  Track who has been baptized, who needs baptism follow-up, and
                  who is moving into membership.
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
            <MiniStat label="Not baptized" value={notBaptizedCount} />
            <MiniStat label="Baptism ready" value={baptismReadyCount} />
            <MiniStat label="Baptized" value={baptizedCount} />
            <MiniStat label="Membership" value={membershipCount} />
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
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[0.85rem] outline-none transition focus:border-slate-950"
              >
                <option value="all">All baptism records</option>
                <option value="not_baptized">Not Baptized</option>
                <option value="baptism_ready">Baptism Ready</option>
                <option value="baptized">Baptized</option>
                <option value="membership">Membership</option>
              </select>
            </div>
          </section>

          {loading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-500">
                Loading baptism records...
              </p>
            </section>
          ) : filteredPeople.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-black text-slate-800">
                No baptism records found.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                People who are not baptized or enter baptism stages will appear
                here.
              </p>
            </section>
          ) : (
            <section className="grid gap-3">
              {filteredPeople.map((person) => {
                const whatsappNumber = person.whatsapp || person.phone;
                const defaultBaptismValue =
                  person.has_been_baptized === true
                    ? "yes"
                    : person.has_been_baptized === false
                      ? "no"
                      : "";

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

                          <span
                            className={`rounded-lg px-2 py-1 text-[10px] font-black ${
                              person.has_been_baptized
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {baptismLabel(person.has_been_baptized)}
                          </span>
                        </div>

                        <p className="mt-1 text-[0.78rem] text-slate-500">
                          First visited on {formatDate(person.service_date)}
                        </p>

                        <div className="mt-3 grid gap-2 text-[0.82rem] text-slate-600 md:grid-cols-3">
                          <Info label="Phone" value={person.phone} />
                          <Info label="Location" value={person.location} />
                          <Info label="Stage" value={formatStage(person.stage)} />
                        </div>

                        {person.has_been_baptized && (
                          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[0.82rem] text-slate-600">
                            <p>
                              <span className="font-black text-slate-800">
                                When:
                              </span>{" "}
                              {person.baptized_when || "Not provided"}
                            </p>

                            <p className="mt-1">
                              <span className="font-black text-slate-800">
                                Where:
                              </span>{" "}
                              {person.baptized_where || "Not provided"}
                            </p>
                          </div>
                        )}

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
                          handleUpdateBaptism(event, person.id)
                        }
                        className="rounded-xl bg-slate-50 p-3"
                      >
                        <label className="mb-1.5 block text-[0.78rem] font-black text-slate-700">
                          Baptism status
                        </label>

                        <select
                          name="has_been_baptized"
                          defaultValue={defaultBaptismValue}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[0.85rem] outline-none transition focus:border-slate-950"
                        >
                          <option value="">Select</option>
                          <option value="no">Not baptized</option>
                          <option value="yes">Baptized</option>
                        </select>

                        <div className="mt-2 grid gap-2">
                          <input
                            name="baptized_when"
                            defaultValue={person.baptized_when || ""}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[0.85rem] outline-none transition focus:border-slate-950"
                            placeholder="When baptized"
                          />

                          <input
                            name="baptized_where"
                            defaultValue={person.baptized_where || ""}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[0.85rem] outline-none transition focus:border-slate-950"
                            placeholder="Where baptized"
                          />
                        </div>

                        <label className="mb-1.5 mt-3 block text-[0.78rem] font-black text-slate-700">
                          Growth stage
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