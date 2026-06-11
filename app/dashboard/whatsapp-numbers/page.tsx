"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  ToggleLeft,
  ToggleRight,
  Trash2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type WorkspaceType = "business" | "school";

type Business = {
  id: string;
  name: string | null;
};

type School = {
  id: string;
  name: string | null;
};

type WhatsAppNumber = {
  id: string;
  workspace_type: WorkspaceType;
  workspace_id: string;
  workspace_name: string | null;
  business_id: string | null;
  school_id: string | null;
  phone_number: string | null;
  phone_number_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  provider: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "No date";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatWorkspaceType(value: WorkspaceType) {
  return value === "school" ? "School" : "Business";
}

export default function WhatsAppNumbersPage() {
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [schools, setSchools] = useState<School[]>([]);

  const [workspaceType, setWorkspaceType] = useState<WorkspaceType>("business");
  const [businessId, setBusinessId] = useState("");
  const [schoolId, setSchoolId] = useState("");

  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState("");
  const [verifiedName, setVerifiedName] = useState("");
  const [provider, setProvider] = useState("whatsapp_cloud_api");
  const [isActive, setIsActive] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [numberToDelete, setNumberToDelete] = useState<WhatsAppNumber | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isSchool = workspaceType === "school";

  const accent = isSchool
    ? {
        pill: "border-indigo-400/20 bg-indigo-400/10 text-indigo-300",
        icon: "text-indigo-400",
        focus: "focus:border-indigo-400/60",
        button: "bg-indigo-400 hover:bg-indigo-300 text-slate-950",
        success: "border-indigo-500/20 bg-indigo-500/10 text-indigo-200",
        active: "border-indigo-400/20 bg-indigo-400/10 text-indigo-300",
      }
    : {
        pill: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
        icon: "text-emerald-400",
        focus: "focus:border-emerald-400/60",
        button: "bg-emerald-400 hover:bg-emerald-300 text-slate-950",
        success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
        active: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
      };

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  async function loadData() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/whatsapp-numbers", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load WhatsApp numbers.");
      }

      setNumbers(result.numbers || []);
      setBusinesses(result.businesses || []);
      setSchools(result.schools || []);

      if (!businessId && result.businesses?.[0]?.id) {
        setBusinessId(result.businesses[0].id);
      }

      if (!schoolId && result.schools?.[0]?.id) {
        setSchoolId(result.schools[0].id);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load WhatsApp numbers."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredNumbers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return numbers;

    return numbers.filter((item) => {
      return (
        (item.workspace_type || "").toLowerCase().includes(query) ||
        (item.workspace_name || "").toLowerCase().includes(query) ||
        (item.phone_number || "").toLowerCase().includes(query) ||
        (item.display_phone_number || "").toLowerCase().includes(query) ||
        (item.phone_number_id || "").toLowerCase().includes(query) ||
        (item.verified_name || "").toLowerCase().includes(query) ||
        (item.provider || "").toLowerCase().includes(query)
      );
    });
  }, [numbers, searchQuery]);

  function resetForm() {
    setPhoneNumber("");
    setPhoneNumberId("");
    setDisplayPhoneNumber("");
    setVerifiedName("");
    setProvider("whatsapp_cloud_api");
    setIsActive(true);
  }

  function editNumber(item: WhatsAppNumber) {
    setWorkspaceType(item.workspace_type);
    setBusinessId(item.business_id || "");
    setSchoolId(item.school_id || "");
    setPhoneNumber(item.phone_number || "");
    setPhoneNumberId(item.phone_number_id || "");
    setDisplayPhoneNumber(item.display_phone_number || "");
    setVerifiedName(item.verified_name || "");
    setProvider(item.provider || "whatsapp_cloud_api");
    setIsActive(item.is_active !== false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openDeleteDialog(item: WhatsAppNumber) {
    setNumberToDelete(item);
    setDeleteConfirmation("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeDeleteDialog() {
    if (isDeleting) return;

    setNumberToDelete(null);
    setDeleteConfirmation("");
  }

  async function handleDeleteNumber() {
    if (!numberToDelete) return;

    const expectedConfirmation = numberToDelete.phone_number_id;

    if (deleteConfirmation.trim() !== expectedConfirmation) {
      setErrorMessage(
        "Deletion blocked. Type the exact Meta Phone Number ID to confirm."
      );
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/whatsapp-numbers", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: numberToDelete.id,
          workspace_type: numberToDelete.workspace_type,
          confirmation_text: deleteConfirmation.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete WhatsApp number.");
      }

      setNumbers((currentNumbers) =>
        currentNumbers.filter((item) => {
          return !(
            item.id === numberToDelete.id &&
            item.workspace_type === numberToDelete.workspace_type
          );
        })
      );

      setSuccessMessage("WhatsApp number deleted successfully.");
      closeDeleteDialog();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to delete WhatsApp number."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedWorkspaceId = workspaceType === "school" ? schoolId : businessId;

    if (!selectedWorkspaceId || !phoneNumber.trim() || !phoneNumberId.trim()) {
      setErrorMessage(
        `${
          workspaceType === "school" ? "School" : "Business"
        }, WhatsApp phone number, and Meta Phone Number ID are required.`
      );
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/whatsapp-numbers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workspace_type: workspaceType,
          business_id: workspaceType === "business" ? businessId : null,
          school_id: workspaceType === "school" ? schoolId : null,
          phone_number: phoneNumber,
          phone_number_id: phoneNumberId,
          display_phone_number: displayPhoneNumber,
          verified_name: verifiedName,
          provider,
          is_active: isActive,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save WhatsApp number.");
      }

      setNumbers((currentNumbers) => {
        const withoutExisting = currentNumbers.filter((item) => {
          return !(
            item.phone_number_id === result.number.phone_number_id &&
            item.workspace_type === result.number.workspace_type
          );
        });

        return [result.number, ...withoutExisting];
      });

      setSuccessMessage("WhatsApp number saved successfully.");
      resetForm();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save WhatsApp number."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Smartphone className="h-3.5 w-3.5" />
            WhatsApp Cloud API
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                WhatsApp Numbers
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Assign WhatsApp Cloud API numbers to business or school
                workspaces. Incoming webhooks will route by Meta Phone Number ID.
              </p>
            </div>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
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
          <div
            className={`mb-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${accent.success}`}
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form
            onSubmit={handleSave}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
          >
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Plus className={`h-5 w-5 ${accent.icon}`} />
              Add or update number
            </h2>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Workspace type
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setWorkspaceType("business")}
                    className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      workspaceType === "business"
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                        : "border-white/10 bg-slate-900 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    Business
                  </button>

                  <button
                    type="button"
                    onClick={() => setWorkspaceType("school")}
                    className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      workspaceType === "school"
                        ? "border-indigo-400/20 bg-indigo-400/10 text-indigo-300"
                        : "border-white/10 bg-slate-900 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <GraduationCap className="h-4 w-4" />
                    School
                  </button>
                </div>
              </div>

              {workspaceType === "business" ? (
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Business
                  </label>

                  <select
                    value={businessId}
                    onChange={(event) => setBusinessId(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60"
                  >
                    <option value="">Select business</option>

                    {businesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name || "Unnamed Business"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    School
                  </label>

                  <select
                    value={schoolId}
                    onChange={(event) => setSchoolId(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400/60"
                  >
                    <option value="">Select school</option>

                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name || "Unnamed School"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  WhatsApp phone number
                </label>

                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                  <input
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="2348141283179"
                    className={`w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 ${accent.focus}`}
                  />
                </div>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Use country code format. Example: 2348141283179.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Meta Phone Number ID
                </label>

                <input
                  value={phoneNumberId}
                  onChange={(event) => setPhoneNumberId(event.target.value)}
                  placeholder="Meta Phone Number ID"
                  className={`w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 ${accent.focus}`}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Display phone number
                </label>

                <input
                  value={displayPhoneNumber}
                  onChange={(event) => setDisplayPhoneNumber(event.target.value)}
                  placeholder="+234 814 128 3179"
                  className={`w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 ${accent.focus}`}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Verified name
                </label>

                <input
                  value={verifiedName}
                  onChange={(event) => setVerifiedName(event.target.value)}
                  placeholder="Workspace verified name"
                  className={`w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 ${accent.focus}`}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Provider
                </label>

                <input
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  placeholder="whatsapp_cloud_api"
                  className={`w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 ${accent.focus}`}
                />
              </div>

              <button
                type="button"
                onClick={() => setIsActive((current) => !current)}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? accent.active
                    : "border-slate-400/20 bg-slate-400/10 text-slate-300"
                }`}
              >
                {isActive ? (
                  <ToggleRight className="h-5 w-5" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
                {isActive ? "Number active" : "Number inactive"}
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${accent.button}`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Save WhatsApp Number
                  </>
                )}
              </button>
            </div>
          </form>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Connected numbers</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredNumbers.length} of {numbers.length} numbers shown
                </p>
              </div>

              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search numbers..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
                Loading WhatsApp numbers...
              </div>
            ) : filteredNumbers.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm leading-6 text-slate-500">
                No WhatsApp numbers connected yet.
              </div>
            ) : (
              <div className="grid max-h-[760px] gap-3 overflow-y-auto pr-1">
                {filteredNumbers.map((item) => {
                  const itemIsSchool = item.workspace_type === "school";

                  return (
                    <article
                      key={`${item.workspace_type}-${item.id}`}
                      className="rounded-3xl border border-white/10 bg-slate-900/70 p-4"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-semibold text-white">
                            {item.display_phone_number ||
                              item.phone_number ||
                              "WhatsApp Number"}
                          </h3>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                                itemIsSchool
                                  ? "border-indigo-400/20 bg-indigo-400/10 text-indigo-300"
                                  : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                              }`}
                            >
                              {itemIsSchool ? (
                                <GraduationCap className="h-3.5 w-3.5" />
                              ) : (
                                <Building2 className="h-3.5 w-3.5" />
                              )}
                              {formatWorkspaceType(item.workspace_type)}
                            </span>

                            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-300">
                              {item.workspace_name || "No workspace"}
                            </span>

                            <span
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                                item.is_active !== false
                                  ? itemIsSchool
                                    ? "border-indigo-400/20 bg-indigo-400/10 text-indigo-300"
                                    : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                  : "border-slate-400/20 bg-slate-400/10 text-slate-300"
                              }`}
                            >
                              {item.is_active !== false ? "Active" : "Inactive"}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-1 text-xs leading-5 text-slate-500">
                            <p>Phone: {item.phone_number || "Not set"}</p>
                            <p>Phone Number ID: {item.phone_number_id}</p>
                            <p>Verified name: {item.verified_name || "Not set"}</p>
                            <p>Provider: {item.provider || "Not set"}</p>
                            <p>Updated: {formatDate(item.updated_at)}</p>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editNumber(item)}
                            className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => openDeleteDialog(item)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-500/15"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </div>

      {numberToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-red-400/20 bg-slate-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-200">
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white">
                  Delete WhatsApp number?
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  This removes the number from this platform workspace. To prevent
                  accidental deletion, type the exact Meta Phone Number ID below.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
              <p className="font-semibold text-white">
                {numberToDelete.display_phone_number ||
                  numberToDelete.phone_number ||
                  "WhatsApp Number"}
              </p>
              <p className="mt-1 text-slate-400">
                Workspace: {numberToDelete.workspace_name || "No workspace"}
              </p>
              <p className="mt-1 break-all text-slate-400">
                Meta Phone Number ID:{" "}
                <span className="font-semibold text-red-200">
                  {numberToDelete.phone_number_id}
                </span>
              </p>
            </div>

            <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Type Meta Phone Number ID to confirm
            </label>

            <input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={numberToDelete.phone_number_id}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-red-400/60"
            />

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={isDeleting}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteNumber}
                disabled={
                  isDeleting ||
                  deleteConfirmation.trim() !== numberToDelete.phone_number_id
                }
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-100 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}