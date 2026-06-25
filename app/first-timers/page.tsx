"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatusBadge from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase";

type WorkerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type FirstTimerRow = {
  id: string;
  full_name: string;
  phone: string;
  whatsapp: string | null;
  gender: string | null;
  age_range: string | null;
  location: string;
  status: string;
  stage: string;
  source: string;
  assigned_to: string | null;
  service_date: string;
  created_at: string;
};

type FirstTimer = FirstTimerRow & {
  assigned_worker: WorkerProfile | null;
};

type FirstTimerInsert = {
  full_name: string;
  phone: string;
  whatsapp: string;
  gender: string;
  age_range: string;
  location: string;
  invited_by: string;
  how_heard: string;
  prayer_request: string;
  preferred_contact_method: string;
  has_been_baptized: boolean | null;
  baptized_when: string;
  baptized_where: string;
  wants_contact: boolean;
  interested_foundation_school: boolean;
  interested_baptism: boolean;
  status: string;
  stage: string;
  source: string;
  service_date?: string;
};

const emptyManualForm = {
  full_name: "",
  phone: "",
  whatsapp: "",
  gender: "",
  age_range: "",
  location: "",
  invited_by: "",
  how_heard: "",
  prayer_request: "",
  preferred_contact_method: "",
  has_been_baptized: "",
  baptized_when: "",
  baptized_where: "",
  service_date: "",
};

const importHeaders = [
  "full_name",
  "phone",
  "whatsapp",
  "gender",
  "age_range",
  "location",
  "invited_by",
  "how_heard",
  "prayer_request",
  "preferred_contact_method",
  "has_been_baptized",
  "baptized_when",
  "baptized_where",
  "service_date",
];

function formatLabel(value: string | null | undefined) {
  if (!value) return "Not provided";

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

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeOption(value: string) {
  return normalizeHeader(value);
}

function parseBoolean(value: string) {
  const normalized = normalizeOption(value);

  if (["yes", "y", "true", "1", "baptized"].includes(normalized)) {
    return true;
  }

  if (["no", "n", "false", "0", "not_baptized"].includes(normalized)) {
    return false;
  }

  return null;
}

function splitDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function parseDelimitedRows(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitDelimitedLine(lines[0], delimiter).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);

    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
  });
}

function getImportValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const normalizedKey = normalizeHeader(key);

    if (row[normalizedKey]) {
      return row[normalizedKey].trim();
    }
  }

  return "";
}

function buildFirstTimerInsert(
  fields: typeof emptyManualForm,
  source: "manual_entry" | "bulk_upload"
): FirstTimerInsert {
  const hasBeenBaptized = parseBoolean(fields.has_been_baptized);
  const phone = fields.phone.trim();

  const insert: FirstTimerInsert = {
    full_name: fields.full_name.trim(),
    phone,
    whatsapp: fields.whatsapp.trim() || phone,
    gender: normalizeOption(fields.gender),
    age_range: normalizeOption(fields.age_range),
    location: fields.location.trim(),
    invited_by: fields.invited_by.trim(),
    how_heard: normalizeOption(fields.how_heard),
    prayer_request: fields.prayer_request.trim(),
    preferred_contact_method: normalizeOption(fields.preferred_contact_method),
    has_been_baptized: hasBeenBaptized,
    baptized_when: hasBeenBaptized === true ? fields.baptized_when.trim() : "",
    baptized_where:
      hasBeenBaptized === true ? fields.baptized_where.trim() : "",
    wants_contact: true,
    interested_foundation_school: false,
    interested_baptism: hasBeenBaptized === false,
    status: "new",
    stage: "first_visit",
    source,
  };

  if (fields.service_date) {
    insert.service_date = fields.service_date;
  }

  return insert;
}

export default function FirstTimersPage() {
  const [firstTimers, setFirstTimers] = useState<FirstTimer[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingManual, setSavingManual] = useState(false);
  const [savingImport, setSavingImport] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState("");

  const loadFirstTimers = useCallback(async () => {
    setLoading(true);

    const { data: firstTimerData, error: firstTimerError } = await supabase
      .from("first_timers")
      .select(
        "id, full_name, phone, whatsapp, gender, age_range, location, status, stage, source, assigned_to, service_date, created_at"
      )
      .order("created_at", { ascending: false });

    if (firstTimerError) {
      console.error("First timers load error:", firstTimerError);
      alert(firstTimerError.message || "Could not load first timers.");
      setLoading(false);
      return;
    }

    const { data: workerData, error: workerError } = await supabase
      .from("profiles")
      .select("id, full_name, email");

    if (workerError) {
      console.error("Workers load error:", workerError);
    }

    const workers = workerData || [];
    const rows = firstTimerData || [];

    const normalized: FirstTimer[] = rows.map((person) => {
      const assignedWorker =
        workers.find((worker) => worker.id === person.assigned_to) || null;

      return {
        ...person,
        assigned_worker: assignedWorker,
      };
    });

    setFirstTimers(normalized);
    setLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadFirstTimers());
  }, [loadFirstTimers]);

  function updateManualField(name: string, value: string) {
    setManualForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingManual(true);

    const insert = buildFirstTimerInsert(manualForm, "manual_entry");

    if (!insert.full_name || !insert.phone || !insert.location) {
      alert("Full name, phone, and location are required.");
      setSavingManual(false);
      return;
    }

    const { error } = await supabase.from("first_timers").insert(insert);
    setSavingManual(false);

    if (error) {
      console.error("Manual first timer insert error:", error);
      alert(error.message || "Could not add first timer.");
      return;
    }

    setManualForm(emptyManualForm);
    await loadFirstTimers();
    alert("First timer added.");
  }

  async function handleBulkImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingImport(true);
    setImportMessage("");

    const rows = parseDelimitedRows(importText);
    const inserts = rows
      .map((row) =>
        buildFirstTimerInsert(
          {
            full_name: getImportValue(row, ["full_name", "name", "full name"]),
            phone: getImportValue(row, ["phone", "phone_number", "mobile"]),
            whatsapp: getImportValue(row, ["whatsapp", "whatsapp_number"]),
            gender: getImportValue(row, ["gender", "sex"]),
            age_range: getImportValue(row, ["age_range", "age"]),
            location: getImportValue(row, ["location", "area", "address"]),
            invited_by: getImportValue(row, ["invited_by", "inviter"]),
            how_heard: getImportValue(row, ["how_heard", "heard_about_us"]),
            prayer_request: getImportValue(row, [
              "prayer_request",
              "prayer",
              "notes",
            ]),
            preferred_contact_method: getImportValue(row, [
              "preferred_contact_method",
              "contact_method",
            ]),
            has_been_baptized: getImportValue(row, [
              "has_been_baptized",
              "baptized",
            ]),
            baptized_when: getImportValue(row, ["baptized_when"]),
            baptized_where: getImportValue(row, ["baptized_where"]),
            service_date: getImportValue(row, [
              "service_date",
              "visit_date",
              "date",
            ]),
          },
          "bulk_upload"
        )
      )
      .filter((row) => row.full_name && row.phone && row.location);

    if (inserts.length === 0) {
      setSavingImport(false);
      setImportMessage(
        "No valid rows found. Include headers and at least full_name, phone, and location."
      );
      return;
    }

    const { error } = await supabase.from("first_timers").insert(inserts);
    setSavingImport(false);

    if (error) {
      console.error("Bulk first timer import error:", error);
      setImportMessage(error.message || "Could not import first timers.");
      return;
    }

    setImportText("");
    setImportMessage(`Imported ${inserts.length} first timer record(s).`);
    await loadFirstTimers();
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const text = await file.text();
    setImportText(text);
    setImportMessage(`Loaded ${file.name}. Review the rows, then import.`);
    event.target.value = "";
  }

  const filteredFirstTimers = useMemo(() => {
    return firstTimers.filter((person) => {
      const matchesStatus =
        statusFilter === "all" || person.status === statusFilter;

      const matchesAssignment =
        assignmentFilter === "all" ||
        (assignmentFilter === "assigned" && person.assigned_worker) ||
        (assignmentFilter === "unassigned" && !person.assigned_worker);

      const searchValue = search.toLowerCase().trim();
      const assignedWorkerName =
        person.assigned_worker?.full_name ||
        person.assigned_worker?.email ||
        "";

      const matchesSearch =
        !searchValue ||
        person.full_name.toLowerCase().includes(searchValue) ||
        person.phone.toLowerCase().includes(searchValue) ||
        person.location.toLowerCase().includes(searchValue) ||
        person.stage.toLowerCase().includes(searchValue) ||
        assignedWorkerName.toLowerCase().includes(searchValue);

      return matchesStatus && matchesAssignment && matchesSearch;
    });
  }, [assignmentFilter, firstTimers, search, statusFilter]);

  const newCount = firstTimers.filter((person) => person.status === "new").length;
  const assignedCount = firstTimers.filter(
    (person) => person.assigned_worker
  ).length;
  const unassignedCount = firstTimers.filter(
    (person) => !person.assigned_worker
  ).length;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="grid gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  First Timers
                </p>

                <h1 className="mt-1 font-display text-[1.55rem] font-black leading-tight tracking-[-0.045em] text-slate-950">
                  Captured visitors
                </h1>

                <p className="mt-1 max-w-2xl text-[0.86rem] leading-5 text-slate-500">
                  View, search, assign, and manage people captured from the
                  public form, manual entry, and spreadsheet uploads.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/welcome"
                  className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800"
                >
                  Open Form
                </Link>

                <Link
                  href="/workers/my-follow-ups"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition hover:bg-slate-50"
                >
                  My Follow-Ups
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Total" value={firstTimers.length} />
            <MiniStat label="New" value={newCount} />
            <MiniStat label="Assigned" value={assignedCount} />
            <MiniStat label="Unassigned" value={unassignedCount} />
          </section>

          <section className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
            <form
              onSubmit={handleManualSubmit}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2 className="font-display text-[1rem] font-black text-slate-950">
                Add first timer
              </h2>
              <p className="mt-0.5 text-[0.78rem] text-slate-500">
                Use this when someone was not recorded from the public form.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field label="Full name *">
                  <input
                    required
                    value={manualForm.full_name}
                    onChange={(event) =>
                      updateManualField("full_name", event.target.value)
                    }
                    className="input-compact"
                    placeholder="Enter full name"
                  />
                </Field>

                <Field label="Phone *">
                  <input
                    required
                    value={manualForm.phone}
                    onChange={(event) =>
                      updateManualField("phone", event.target.value)
                    }
                    className="input-compact"
                    placeholder="080..."
                  />
                </Field>

                <Field label="WhatsApp">
                  <input
                    value={manualForm.whatsapp}
                    onChange={(event) =>
                      updateManualField("whatsapp", event.target.value)
                    }
                    className="input-compact"
                    placeholder="Leave empty if same as phone"
                  />
                </Field>

                <Field label="Location *">
                  <input
                    required
                    value={manualForm.location}
                    onChange={(event) =>
                      updateManualField("location", event.target.value)
                    }
                    className="input-compact"
                    placeholder="Area / location"
                  />
                </Field>

                <Field label="Service date">
                  <input
                    type="date"
                    value={manualForm.service_date}
                    onChange={(event) =>
                      updateManualField("service_date", event.target.value)
                    }
                    className="input-compact"
                  />
                </Field>

                <Field label="Has been baptized?">
                  <select
                    value={manualForm.has_been_baptized}
                    onChange={(event) =>
                      updateManualField("has_been_baptized", event.target.value)
                    }
                    className="input-compact"
                  >
                    <option value="">Unknown</option>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>

                <Field label="Preferred contact">
                  <select
                    value={manualForm.preferred_contact_method}
                    onChange={(event) =>
                      updateManualField(
                        "preferred_contact_method",
                        event.target.value
                      )
                    }
                    className="input-compact"
                  >
                    <option value="">Select preferred method</option>
                    <option value="phone_call">Phone call</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                </Field>

                <Field label="Invited by">
                  <input
                    value={manualForm.invited_by}
                    onChange={(event) =>
                      updateManualField("invited_by", event.target.value)
                    }
                    className="input-compact"
                    placeholder="Name of person, if any"
                  />
                </Field>
              </div>

              {manualForm.has_been_baptized === "yes" && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field label="Baptized when">
                    <input
                      value={manualForm.baptized_when}
                      onChange={(event) =>
                        updateManualField("baptized_when", event.target.value)
                      }
                      className="input-compact"
                      placeholder="Example: 2022"
                    />
                  </Field>

                  <Field label="Baptized where">
                    <input
                      value={manualForm.baptized_where}
                      onChange={(event) =>
                        updateManualField("baptized_where", event.target.value)
                      }
                      className="input-compact"
                      placeholder="Church/location"
                    />
                  </Field>
                </div>
              )}

              <button
                type="submit"
                disabled={savingManual}
                className="mt-4 rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {savingManual ? "Adding..." : "Add First Timer"}
              </button>
            </form>

            <form
              onSubmit={handleBulkImport}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2 className="font-display text-[1rem] font-black text-slate-950">
                Bulk upload
              </h2>
              <p className="mt-0.5 text-[0.78rem] leading-5 text-slate-500">
                Upload or paste rows from Excel CSV/TSV, Google Forms, or other
                form exports. Required headers: full_name, phone, location.
              </p>

              <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-[0.78rem] font-bold text-slate-600 transition hover:border-slate-400">
                <span>Choose CSV, TSV, or TXT export</span>
                <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-black text-slate-700 shadow-sm">
                  Browse
                </span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                  onChange={handleImportFile}
                  className="sr-only"
                />
              </label>

              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                className="mt-4 min-h-52 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 font-mono text-[0.78rem] outline-none transition focus:border-slate-950"
                placeholder={`${importHeaders.join(",")}\nJane Doe,08012345678,08012345678,female,26_35,Gwarimpa,,,,whatsapp,no,,,2026-06-21`}
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={savingImport}
                  className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {savingImport ? "Importing..." : "Import Rows"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setImportText(importHeaders.join(","));
                    setImportMessage("");
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition hover:bg-slate-50"
                >
                  Add Headers
                </button>
              </div>

              {importMessage && (
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[0.78rem] font-bold text-slate-600">
                  {importMessage}
                </p>
              )}
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid gap-2 md:grid-cols-[1fr_180px_180px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[0.85rem] outline-none transition focus:border-slate-950"
                placeholder="Search name, phone, location, stage, or worker"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[0.85rem] outline-none transition focus:border-slate-950"
              >
                <option value="all">All statuses</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="no_response">No Response</option>
                <option value="interested">Interested</option>
                <option value="visited_again">Visited Again</option>
                <option value="needs_attention">Needs Attention</option>
                <option value="inactive">Inactive</option>
                <option value="active">Active</option>
              </select>

              <select
                value={assignmentFilter}
                onChange={(event) => setAssignmentFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[0.85rem] outline-none transition focus:border-slate-950"
              >
                <option value="all">All assignments</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
          </section>

          {loading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-500">
                Loading first timers...
              </p>
            </section>
          ) : filteredFirstTimers.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-black text-slate-800">
                No first timers found.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                New records will appear here.
              </p>
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="hidden grid-cols-[1.15fr_0.8fr_0.85fr_0.8fr_0.95fr_0.65fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-400 md:grid">
                <p>Name</p>
                <p>Phone</p>
                <p>Location</p>
                <p>Status</p>
                <p>Assigned To</p>
                <p>Action</p>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredFirstTimers.map((person) => {
                  const workerName =
                    person.assigned_worker?.full_name ||
                    person.assigned_worker?.email ||
                    "Not assigned";

                  return (
                    <div
                      key={person.id}
                      className="grid gap-3 px-4 py-3 transition hover:bg-slate-50 md:grid-cols-[1.15fr_0.8fr_0.85fr_0.8fr_0.95fr_0.65fr] md:items-center"
                    >
                      <div>
                        <p className="text-[0.9rem] font-black text-slate-950">
                          {person.full_name}
                        </p>
                        <p className="mt-0.5 text-[0.76rem] text-slate-500">
                          {formatDate(person.service_date)} -{" "}
                          {formatLabel(person.stage)}
                        </p>
                      </div>

                      <p className="text-[0.82rem] font-semibold text-slate-700">
                        {person.phone}
                      </p>

                      <p className="text-[0.82rem] font-medium text-slate-600">
                        {person.location}
                      </p>

                      <div>
                        <StatusBadge status={person.status} />
                      </div>

                      <p className="text-[0.82rem] font-semibold text-slate-600">
                        {workerName}
                      </p>

                      <Link
                        href={`/first-timers/${person.id}`}
                        className="w-fit rounded-lg bg-slate-950 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-slate-800"
                      >
                        View
                      </Link>
                    </div>
                  );
                })}
              </div>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[0.76rem] font-black text-slate-500">{label}</span>
      {children}
    </label>
  );
}
