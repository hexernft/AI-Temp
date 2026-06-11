"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CheckCircle2,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  School,
  Smartphone,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  role: string | null;
  business_id: string | null;
  school_id: string | null;
};

type SchoolProfile = {
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

export default function SchoolProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [school, setSchool] = useState<SchoolProfile | null>(null);

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

  const canEdit = profile?.role === "school_admin";

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  function fillForm(nextSchool: SchoolProfile) {
    setSchool(nextSchool);
    setName(nextSchool.name || "");
    setType(nextSchool.type || "");
    setDescription(nextSchool.description || "");
    setPhone(nextSchool.phone || "");
    setWhatsapp(nextSchool.whatsapp || "");
    setEmail(nextSchool.email || "");
    setLocation(nextSchool.location || "");
  }

  async function loadSchoolProfile() {
    try {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/school-profile", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load school profile.");
      }

      setProfile(result.profile || null);
      fillForm(result.school);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load school profile."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSchoolProfile();
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      setErrorMessage("Only school admins can update school profile.");
      return;
    }

    if (!name.trim()) {
      setErrorMessage("School name is required.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/school-profile", {
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
        throw new Error(result.error || "Failed to save school profile.");
      }

      fillForm(result.school);
      setSuccessMessage("School profile updated successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save school profile."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-center py-24">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
            <span className="text-sm text-slate-300">
              Loading school profile...
            </span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-5xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-300">
            <GraduationCap className="h-3.5 w-3.5" />
            School Center
          </div>

          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            School Profile
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            View and manage your school’s basic profile. Teachers can view this
            page, while school admins can update it.
          </p>
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

        <form
          onSubmit={handleSave}
          className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
        >
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <School className="h-5 w-5 text-indigo-400" />
                Profile details
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {canEdit
                  ? "You can update this school profile."
                  : "View-only access. Ask a school admin to make changes."}
              </p>
            </div>

            {school ? (
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  canEdit
                    ? "bg-indigo-400/10 text-indigo-300"
                    : "bg-slate-400/10 text-slate-300"
                }`}
              >
                {canEdit ? "Editable" : "View only"}
              </span>
            ) : null}
          </div>

          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                School name
              </label>

              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canEdit}
                placeholder="School name"
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                School type
              </label>

              <input
                value={type}
                onChange={(event) => setType(event.target.value)}
                disabled={!canEdit}
                placeholder="Primary school, nursery, secondary school..."
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Phone
                </label>

                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    disabled={!canEdit}
                    placeholder="Phone"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60"
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
                    disabled={!canEdit}
                    placeholder="WhatsApp"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
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
                  disabled={!canEdit}
                  placeholder="Email"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60"
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
                  disabled={!canEdit}
                  placeholder="Location"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Description
              </label>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={!canEdit}
                rows={5}
                placeholder="School description or setup notes"
                className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {canEdit ? (
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save School Profile
                  </>
                )}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </main>
  );
}