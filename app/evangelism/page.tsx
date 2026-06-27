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
import { supabase } from "@/lib/supabase";

type WorkerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
};

type CurrentProfile = {
  id: string;
  role: string;
};

type EvangelismContactRow = {
  id: string;
  full_name: string;
  phone: string;
  prayer_request: string | null;
  evangelist_worker_id: string;
  status: string;
  converted_first_timer_id: string | null;
  converted_at: string | null;
  created_at: string;
};

type EvangelismContact = EvangelismContactRow & {
  evangelist: WorkerProfile | null;
};

type ContactForm = {
  full_name: string;
  phone: string;
  prayer_request: string;
  evangelist_worker_id: string;
};

const allowedManagerRoles = ["super_admin", "admin", "pastor"];

const emptyForm: ContactForm = {
  full_name: "",
  phone: "",
  prayer_request: "",
  evangelist_worker_id: "",
};

const importHeaders = ["full_name", "phone", "prayer_request", "evangelist"];

const statusOptions = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "coming_to_church", label: "Coming To Church" },
  { value: "converted", label: "Converted" },
  { value: "not_interested", label: "Not Interested" },
];

const statusClasses: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-emerald-100 text-emerald-700",
  coming_to_church: "bg-amber-100 text-amber-700",
  converted: "bg-green-100 text-green-700",
  not_interested: "bg-red-100 text-red-700",
};

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

function getWorkerName(worker: WorkerProfile | null | undefined) {
  return worker?.full_name || worker?.email || "Unassigned";
}

export default function EvangelismPage() {
  const [contacts, setContacts] = useState<EvangelismContact[]>([]);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [convertingId, setConvertingId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState("");

  const canManageEvangelism = currentProfile
    ? allowedManagerRoles.includes(currentProfile.role)
    : false;

  const loadEvangelism = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("User load error:", userError);
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      console.error("Current profile load error:", profileError);
      setLoading(false);
      return;
    }

    setCurrentProfile(profileData);

    const isManager = allowedManagerRoles.includes(profileData.role);

    const { data: workerData, error: workerError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, is_active")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (workerError) {
      console.error("Evangelism workers load error:", workerError);
    }

    const workerRows = workerData || [];
    setWorkers(workerRows);

    setForm((current) => ({
      ...current,
      evangelist_worker_id: current.evangelist_worker_id || user.id,
    }));

    let contactQuery = supabase
      .from("evangelism_contacts")
      .select(
        "id, full_name, phone, prayer_request, evangelist_worker_id, status, converted_first_timer_id, converted_at, created_at"
      )
      .order("created_at", { ascending: false });

    if (!isManager) {
      contactQuery = contactQuery.eq("evangelist_worker_id", user.id);
    }

    const { data: contactData, error: contactError } = await contactQuery;

    if (contactError) {
      console.error("Evangelism contacts load error:", contactError);
      alert(contactError.message || "Could not load evangelism contacts.");
      setLoading(false);
      return;
    }

    const normalized = (contactData || []).map((contact) => ({
      ...contact,
      evangelist:
        workerRows.find((worker) => worker.id === contact.evangelist_worker_id) ||
        null,
    }));

    setContacts(normalized);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadEvangelism();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadEvangelism]);

  function updateField(name: keyof ContactForm, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function findWorkerId(value: string) {
    const trimmed = value.trim();
    const normalized = normalizeHeader(trimmed);

    if (!trimmed) return currentProfile?.id || "";

    const worker = workers.find(
      (item) =>
        item.id === trimmed ||
        normalizeHeader(item.full_name || "") === normalized ||
        normalizeHeader(item.email || "") === normalized
    );

    return worker?.id || currentProfile?.id || "";
  }

  async function handleCreateContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const evangelistWorkerId = canManageEvangelism
      ? form.evangelist_worker_id
      : currentProfile?.id || "";

    if (!form.full_name.trim() || !form.phone.trim() || !evangelistWorkerId) {
      alert("Name, phone, and evangelist are required.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("evangelism_contacts").insert({
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      prayer_request: form.prayer_request.trim(),
      evangelist_worker_id: evangelistWorkerId,
      status: "new",
    });

    setSaving(false);

    if (error) {
      console.error("Evangelism contact create error:", error);
      alert(error.message || "Could not add evangelism contact.");
      return;
    }

    setForm({
      ...emptyForm,
      evangelist_worker_id: currentProfile?.id || "",
    });

    await loadEvangelism();
    alert("Evangelism contact added.");
  }

  async function handleBulkImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImporting(true);
    setImportMessage("");

    const rows = parseDelimitedRows(importText);
    const inserts = rows
      .map((row) => {
        const evangelistValue = getImportValue(row, [
          "evangelist",
          "worker",
          "invited_by",
          "preached_by",
        ]);

        return {
          full_name: getImportValue(row, ["full_name", "name", "full name"]),
          phone: getImportValue(row, ["phone", "phone_number", "mobile"]),
          prayer_request: getImportValue(row, [
            "prayer_request",
            "prayer",
            "notes",
          ]),
          evangelist_worker_id: canManageEvangelism
            ? findWorkerId(evangelistValue)
            : currentProfile?.id || "",
          status: "new",
        };
      })
      .filter((row) => row.full_name && row.phone && row.evangelist_worker_id);

    if (inserts.length === 0) {
      setImporting(false);
      setImportMessage(
        "No valid rows found. Include headers and at least full_name and phone."
      );
      return;
    }

    const { error } = await supabase.from("evangelism_contacts").insert(inserts);
    setImporting(false);

    if (error) {
      console.error("Evangelism bulk import error:", error);
      setImportMessage(error.message || "Could not import evangelism contacts.");
      return;
    }

    setImportText("");
    setImportMessage(`Imported ${inserts.length} evangelism contact(s).`);
    await loadEvangelism();
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const text = await file.text();
    setImportText(text);
    setImportMessage(`Loaded ${file.name}. Review the rows, then import.`);
    event.target.value = "";
  }

  async function handleUpdateStatus(contact: EvangelismContact, status: string) {
    setUpdatingId(contact.id);

    const { error } = await supabase
      .from("evangelism_contacts")
      .update({ status })
      .eq("id", contact.id);

    setUpdatingId("");

    if (error) {
      alert(error.message);
      return;
    }

    setContacts((current) =>
      current.map((item) =>
        item.id === contact.id
          ? {
              ...item,
              status,
            }
          : item
      )
    );
  }

  async function handleConvert(contact: EvangelismContact) {
    if (contact.converted_first_timer_id) return;

    const location = window.prompt(
      "Enter their location/area for the first-timer record:",
      "Not provided"
    );

    if (location === null) return;

    const confirmed = window.confirm(
      `Convert ${contact.full_name} into a first-timer record?`
    );

    if (!confirmed) return;

    setConvertingId(contact.id);

    const evangelistName = getWorkerName(contact.evangelist);

    const { data: firstTimer, error: firstTimerError } = await supabase
      .from("first_timers")
      .insert({
        full_name: contact.full_name,
        phone: contact.phone,
        whatsapp: contact.phone,
        gender: "",
        age_range: "",
        location: location.trim() || "Not provided",
        invited_by: evangelistName,
        how_heard: "evangelism",
        prayer_request: contact.prayer_request || "",
        preferred_contact_method: "",
        has_been_baptized: null,
        baptized_when: "",
        baptized_where: "",
        wants_contact: true,
        interested_foundation_school: false,
        interested_baptism: false,
        status: "new",
        stage: "first_visit",
        source: "evangelism",
      })
      .select("id")
      .single();

    if (firstTimerError || !firstTimer) {
      setConvertingId("");
      alert(firstTimerError?.message || "Could not create first-timer record.");
      return;
    }

    const convertedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("evangelism_contacts")
      .update({
        status: "converted",
        converted_first_timer_id: firstTimer.id,
        converted_at: convertedAt,
      })
      .eq("id", contact.id);

    setConvertingId("");

    if (updateError) {
      alert(updateError.message);
      return;
    }

    setContacts((current) =>
      current.map((item) =>
        item.id === contact.id
          ? {
              ...item,
              status: "converted",
              converted_first_timer_id: firstTimer.id,
              converted_at: convertedAt,
            }
          : item
      )
    );

    alert("Converted to first timer.");
  }

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const searchValue = search.toLowerCase().trim();
      const evangelistName = getWorkerName(contact.evangelist);

      const matchesSearch =
        !searchValue ||
        contact.full_name.toLowerCase().includes(searchValue) ||
        contact.phone.toLowerCase().includes(searchValue) ||
        (contact.prayer_request || "").toLowerCase().includes(searchValue) ||
        evangelistName.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "all" || contact.status === statusFilter;

      const matchesWorker =
        workerFilter === "all" || contact.evangelist_worker_id === workerFilter;

      return matchesSearch && matchesStatus && matchesWorker;
    });
  }, [contacts, search, statusFilter, workerFilter]);

  const newCount = contacts.filter((item) => item.status === "new").length;
  const comingCount = contacts.filter(
    (item) => item.status === "coming_to_church"
  ).length;
  const convertedCount = contacts.filter(
    (item) => item.status === "converted"
  ).length;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="grid gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Evangelism
                </p>
                <h1 className="mt-1 font-display text-[1.55rem] font-black leading-tight tracking-[-0.045em] text-slate-950">
                  Outreach contact funnel
                </h1>
                <p className="mt-1 max-w-2xl text-[0.86rem] leading-5 text-slate-500">
                  Capture people reached through evangelism before they become
                  first timers, then convert them when they come to church.
                </p>
              </div>

              <span className="w-fit rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-black text-slate-600">
                {canManageEvangelism ? "Manager view" : "My contacts"}
              </span>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Total contacts" value={contacts.length} />
            <MiniStat label="New" value={newCount} />
            <MiniStat label="Coming" value={comingCount} />
            <MiniStat label="Converted" value={convertedCount} />
          </section>

          <section className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
            <form
              onSubmit={handleCreateContact}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2 className="font-display text-[1rem] font-black text-slate-950">
                Add evangelism contact
              </h2>
              <p className="mt-0.5 text-[0.78rem] text-slate-500">
                For people reached outside church who have not attended yet.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field label="Full name *">
                  <input
                    required
                    value={form.full_name}
                    onChange={(event) =>
                      updateField("full_name", event.target.value)
                    }
                    className="input-compact"
                    placeholder="Enter full name"
                  />
                </Field>

                <Field label="Phone *">
                  <input
                    required
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    className="input-compact"
                    placeholder="080..."
                  />
                </Field>

                <Field label="Who preached/invited them? *">
                  <select
                    required
                    value={form.evangelist_worker_id}
                    onChange={(event) =>
                      updateField("evangelist_worker_id", event.target.value)
                    }
                    disabled={!canManageEvangelism}
                    className="input-compact disabled:opacity-70"
                  >
                    <option value="">Select worker</option>
                    {workers.map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {getWorkerName(worker)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Prayer request">
                  <textarea
                    value={form.prayer_request}
                    onChange={(event) =>
                      updateField("prayer_request", event.target.value)
                    }
                    className="input-compact min-h-24 resize-y"
                    placeholder="Optional prayer request"
                  />
                </Field>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-4 rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Adding..." : "Add Contact"}
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
                Upload or paste CSV/TSV rows. Required headers: full_name,
                phone. Optional: prayer_request, evangelist.
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
                placeholder={`${importHeaders.join(",")}\nJane Doe,08012345678,Needs prayer for family,Worker Name`}
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={importing}
                  className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {importing ? "Importing..." : "Import Rows"}
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
            <div className="grid gap-2 md:grid-cols-[1fr_190px_220px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input-compact"
                placeholder="Search name, phone, prayer request, or evangelist"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="input-compact"
              >
                <option value="all">All statuses</option>
                {statusOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <select
                value={workerFilter}
                onChange={(event) => setWorkerFilter(event.target.value)}
                className="input-compact"
                disabled={!canManageEvangelism}
              >
                <option value="all">All evangelists</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {getWorkerName(worker)}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {loading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-500">
                Loading evangelism contacts...
              </p>
            </section>
          ) : filteredContacts.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-black text-slate-800">
                No evangelism contacts found.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Add contacts from outreach to begin the funnel.
              </p>
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="hidden grid-cols-[1.05fr_0.7fr_1fr_0.8fr_0.9fr_1.05fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-400 lg:grid">
                <p>Name</p>
                <p>Phone</p>
                <p>Prayer Request</p>
                <p>Evangelist</p>
                <p>Status</p>
                <p>Action</p>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="grid gap-3 px-4 py-3 transition hover:bg-slate-50 lg:grid-cols-[1.05fr_0.7fr_1fr_0.8fr_0.9fr_1.05fr] lg:items-center"
                  >
                    <div>
                      <p className="text-[0.9rem] font-black text-slate-950">
                        {contact.full_name}
                      </p>
                      <p className="mt-0.5 text-[0.76rem] text-slate-500">
                        Added {formatDate(contact.created_at)}
                      </p>
                    </div>

                    <p className="text-[0.82rem] font-semibold text-slate-700">
                      {contact.phone}
                    </p>

                    <p className="text-[0.82rem] leading-5 text-slate-600">
                      {contact.prayer_request || "No prayer request"}
                    </p>

                    <p className="text-[0.82rem] font-semibold text-slate-600">
                      {getWorkerName(contact.evangelist)}
                    </p>

                    <select
                      value={contact.status}
                      onChange={(event) =>
                        handleUpdateStatus(contact, event.target.value)
                      }
                      disabled={
                        updatingId === contact.id ||
                        contact.status === "converted"
                      }
                      className={`w-fit rounded-lg border-0 px-2 py-1 text-[10px] font-black outline-none disabled:opacity-70 ${
                        statusClasses[contact.status] ||
                        "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {statusOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex flex-wrap gap-2">
                      {contact.converted_first_timer_id ? (
                        <Link
                          href={`/first-timers/${contact.converted_first_timer_id}`}
                          className="rounded-lg bg-green-100 px-3 py-1.5 text-[11px] font-black text-green-700 transition hover:bg-green-200"
                        >
                          View First Timer
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConvert(contact)}
                          disabled={convertingId === contact.id}
                          className="rounded-lg bg-slate-950 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                        >
                          {convertingId === contact.id
                            ? "Converting..."
                            : "Convert"}
                        </button>
                      )}

                      <a
                        href={`tel:${contact.phone}`}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        Call
                      </a>
                    </div>
                  </div>
                ))}
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
