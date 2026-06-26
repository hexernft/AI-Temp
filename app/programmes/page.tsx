"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/lib/supabase";

type Programme = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  programme_date: string | null;
  is_active: boolean;
  created_at: string;
};

type CurrentProfile = {
  id: string;
  role: string;
};

type ProgrammeResponse = {
  success?: boolean;
  error?: string;
  programme?: Programme;
};

const allowedManagerRoles = ["super_admin", "admin", "pastor"];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No date set";

  return new Date(value).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProgrammesPage() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin
  );
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    programme_date: "",
  });

  const canManageProgrammes = currentProfile
    ? allowedManagerRoles.includes(currentProfile.role)
    : false;

  const suggestedSlug = useMemo(() => slugify(form.name), [form.name]);

  const loadProgrammes = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Current profile load error:", profileError);
    } else {
      setCurrentProfile(profileData);
    }

    const { data, error } = await supabase
      .from("programmes")
      .select(
        "id, name, slug, description, programme_date, is_active, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Programmes load error:", error);
      alert(error.message || "Could not load programmes.");
      setLoading(false);
      return;
    }

    setProgrammes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadProgrammes());
  }, [loadProgrammes]);

  function updateField(name: string, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function getProgrammeUrl(slug: string) {
    return origin ? `${origin}/programmes/${slug}` : `/programmes/${slug}`;
  }

  async function handleCopyLink(slug: string) {
    try {
      await navigator.clipboard.writeText(getProgrammeUrl(slug));
      alert("Programme form link copied.");
    } catch {
      alert("Could not copy link. Please copy it manually.");
    }
  }

  async function handleCreateProgramme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageProgrammes) {
      alert("You do not have permission to create programmes.");
      return;
    }

    setCreating(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("Your session has expired. Please log in again.");
        setCreating(false);
        return;
      }

      const response = await fetch("/api/programmes/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...form,
          slug: form.slug || suggestedSlug,
        }),
      });

      const result = (await response.json()) as ProgrammeResponse;

      if (!response.ok || !result.success || !result.programme) {
        alert(result.error || "Could not create programme.");
        setCreating(false);
        return;
      }

      setForm({
        name: "",
        slug: "",
        description: "",
        programme_date: "",
      });

      setProgrammes((current) => [result.programme as Programme, ...current]);
      alert("Programme created.");
    } catch (error) {
      console.error("Create programme request error:", error);
      alert("Something went wrong while creating the programme.");
    }

    setCreating(false);
  }

  async function handleToggleProgramme(programme: Programme) {
    if (!canManageProgrammes) {
      alert("You do not have permission to update programmes.");
      return;
    }

    const nextStatus = !programme.is_active;
    const confirmed = window.confirm(
      nextStatus
        ? `Activate ${programme.name}?`
        : `Deactivate ${programme.name}? Its public form will stop accepting submissions.`
    );

    if (!confirmed) return;

    setUpdatingId(programme.id);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("Your session has expired. Please log in again.");
        setUpdatingId("");
        return;
      }

      const response = await fetch("/api/programmes/toggle-active", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: programme.id,
          is_active: nextStatus,
        }),
      });

      const result = (await response.json()) as ProgrammeResponse;

      if (!response.ok || !result.success || !result.programme) {
        alert(result.error || "Could not update programme.");
        setUpdatingId("");
        return;
      }

      setProgrammes((current) =>
        current.map((item) =>
          item.id === result.programme?.id ? result.programme : item
        )
      );
    } catch (error) {
      console.error("Toggle programme request error:", error);
      alert("Something went wrong while updating the programme.");
    }

    setUpdatingId("");
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="grid gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Programmes
                </p>
                <h1 className="mt-1 font-display text-[1.55rem] font-black leading-tight tracking-[-0.045em] text-slate-950">
                  Special programme forms
                </h1>
                <p className="mt-1 max-w-2xl text-[0.86rem] leading-5 text-slate-500">
                  Create programme-specific first-timer forms, copy links, and
                  print QR codes for special meetings and events.
                </p>
              </div>

              <span className="w-fit rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-black text-slate-600">
                {canManageProgrammes ? "Manager access" : "View only"}
              </span>
            </div>
          </section>

          {canManageProgrammes ? (
            <form
              onSubmit={handleCreateProgramme}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3">
                <h2 className="font-display text-[1rem] font-black text-slate-950">
                  Create programme
                </h2>
                <p className="mt-0.5 text-[0.78rem] text-slate-500">
                  Each programme gets a public form link and QR code.
                </p>
              </div>

              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-[1fr_0.85fr_0.8fr_auto] lg:items-end">
                <Field label="Programme name">
                  <input
                    required
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    className="input-compact"
                    placeholder="Youth Conference"
                  />
                </Field>

                <Field label="Slug">
                  <input
                    value={form.slug}
                    onChange={(event) => updateField("slug", event.target.value)}
                    className="input-compact"
                    placeholder={suggestedSlug || "youth-conference"}
                  />
                </Field>

                <Field label="Programme date">
                  <input
                    type="date"
                    value={form.programme_date}
                    onChange={(event) =>
                      updateField("programme_date", event.target.value)
                    }
                    className="input-compact"
                  />
                </Field>

                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>

              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  className="input-compact mt-2 min-h-20 resize-y"
                  placeholder="Short programme description shown on the public form"
                />
              </Field>
            </form>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-[1rem] font-black text-slate-950">
                Programme access
              </h2>
              <p className="mt-1 text-[0.82rem] text-slate-500">
                You can view programme links, but only admins, pastors, and
                super admins can create or deactivate programmes.
              </p>
            </section>
          )}

          {loading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-500">
                Loading programmes...
              </p>
            </section>
          ) : programmes.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-black text-slate-800">
                No programmes yet.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Create a programme to generate its form and QR code.
              </p>
            </section>
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              {programmes.map((programme) => {
                const programmeUrl = getProgrammeUrl(programme.slug);

                return (
                  <div
                    key={programme.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-display text-[1.1rem] font-black text-slate-950">
                            {programme.name}
                          </h2>
                          <span
                            className={`rounded-lg px-2 py-1 text-[10px] font-black ${
                              programme.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {programme.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="mt-1 text-[0.8rem] font-semibold text-slate-500">
                          {formatDate(programme.programme_date)}
                        </p>
                        {programme.description && (
                          <p className="mt-2 text-[0.82rem] leading-5 text-slate-600">
                            {programme.description}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleProgramme(programme)}
                        disabled={updatingId === programme.id}
                        className={`w-fit rounded-lg px-3 py-2 text-[11px] font-black transition disabled:opacity-60 ${
                          programme.is_active
                            ? "bg-red-100 text-red-700 hover:bg-red-200"
                            : "bg-green-100 text-green-700 hover:bg-green-200"
                        }`}
                      >
                        {updatingId === programme.id
                          ? "Saving..."
                          : programme.is_active
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-[190px_1fr]">
                      <div className="w-fit rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                        <QRCodeSVG
                          value={programmeUrl}
                          size={160}
                          level="H"
                          includeMargin
                        />
                      </div>

                      <div className="grid content-start gap-2">
                        <p className="break-all rounded-xl bg-slate-50 px-3 py-2 text-[0.76rem] font-semibold leading-5 text-slate-600">
                          {programmeUrl}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/programmes/${programme.slug}`}
                            className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800"
                          >
                            Open Form
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleCopyLink(programme.slug)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition hover:bg-slate-50"
                          >
                            Copy Link
                          </button>
                        </div>
                      </div>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[0.76rem] font-black text-slate-600">{label}</span>
      {children}
    </label>
  );
}
