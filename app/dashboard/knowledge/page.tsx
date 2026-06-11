"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  Edit3,
  Globe,
  Link as LinkIcon,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type KnowledgeType = "product" | "service" | "faq" | "policy" | "general";

type KnowledgeEntry = {
  id: string;
  business_id: string;
  title: string;
  content: string;
  is_active: boolean;
  source_type: string | null;
  source_url: string | null;
  imported_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

type StructuredFields = {
  product_name: string;
  service_name: string;
  question: string;
  answer: string;
  policy_title: string;
  category: string;
  price: string;
  currency: string;
  availability: string;
  description: string;
  variants: string;
  delivery_notes: string;
  payment_notes: string;
  extra_notes: string;
  general_title: string;
  general_content: string;
};

const DEFAULT_FIELDS: StructuredFields = {
  product_name: "",
  service_name: "",
  question: "",
  answer: "",
  policy_title: "",
  category: "",
  price: "",
  currency: "NGN",
  availability: "",
  description: "",
  variants: "",
  delivery_notes: "",
  payment_notes: "",
  extra_notes: "",
  general_title: "",
  general_content: "",
};

const entryTypeLabels: Record<KnowledgeType, string> = {
  product: "Product",
  service: "Service",
  faq: "FAQ",
  policy: "Policy",
  general: "General",
};

function formatDate(value?: string | null) {
  if (!value) return "No date";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function previewText(value: string, maxLength = 180) {
  if (value.length <= maxLength) return value;

  return `${value.slice(0, maxLength).trim()}...`;
}

function getEntryType(entry: KnowledgeEntry): KnowledgeType {
  const metadataType = entry.metadata?.knowledge_type;

  if (
    metadataType === "product" ||
    metadataType === "service" ||
    metadataType === "faq" ||
    metadataType === "policy" ||
    metadataType === "general"
  ) {
    return metadataType;
  }

  return "general";
}

function getFieldValue(fields: StructuredFields, name: keyof StructuredFields) {
  return fields[name];
}

function getEntryFields(entry: KnowledgeEntry) {
  const rawFields = entry.metadata?.fields;

  if (!rawFields || typeof rawFields !== "object" || Array.isArray(rawFields)) {
    return {} as Partial<StructuredFields>;
  }

  const fields: Partial<StructuredFields> = {};

  for (const key of Object.keys(DEFAULT_FIELDS) as Array<keyof StructuredFields>) {
    const value = (rawFields as Record<string, unknown>)[key];

    if (typeof value === "string") {
      fields[key] = value;
    }
  }

  return fields;
}

function getDisplayValue(value?: string | null) {
  const cleanValue = typeof value === "string" ? value.trim() : "";

  return cleanValue || "Not specified";
}

function buildPriceLabel(fields: Partial<StructuredFields>) {
  const price = getDisplayValue(fields.price);

  if (price === "Not specified") return price;

  const currency = getDisplayValue(fields.currency);

  if (currency === "Not specified") return price;

  return `${currency} ${price}`;
}

function renderInfoPill(label: string, value?: string | null) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-200">{getDisplayValue(value)}</p>
    </div>
  );
}

function renderProductServiceSummary(entry: KnowledgeEntry, type: KnowledgeType) {
  const fields = getEntryFields(entry);

  if (type !== "product" && type !== "service") return null;

  const isProduct = type === "product";
  const Icon = isProduct ? Package : BriefcaseBusiness;
  const description = getDisplayValue(fields.description);

  return (
    <div
      className={`mt-4 rounded-3xl border p-4 ${
        isProduct
          ? "border-cyan-400/20 bg-cyan-400/5"
          : "border-violet-400/20 bg-violet-400/5"
      }`}
    >
      <div className="mb-4 flex items-center gap-2">
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl ${
            isProduct
              ? "bg-cyan-400/10 text-cyan-200"
              : "bg-violet-400/10 text-violet-200"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">
            {isProduct ? "Product details" : "Service details"}
          </p>
          <p className="text-xs text-slate-500">
            Structured fields saved for AI replies
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {renderInfoPill("Category", fields.category)}
        {renderInfoPill(isProduct ? "Price" : "Rate", buildPriceLabel(fields))}
        {renderInfoPill(isProduct ? "Stock" : "Availability", fields.availability)}
      </div>

      {description !== "Not specified" ? (
        <p className="mt-4 text-sm leading-6 text-slate-300">
          {previewText(description, 260)}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {isProduct && fields.variants ? renderInfoPill("Variants", fields.variants) : null}
        {fields.delivery_notes ? (
          renderInfoPill(isProduct ? "Delivery notes" : "Booking notes", fields.delivery_notes)
        ) : null}
        {fields.payment_notes ? renderInfoPill("Payment notes", fields.payment_notes) : null}
        {fields.extra_notes ? renderInfoPill("Extra notes", fields.extra_notes) : null}
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);

  const [entryType, setEntryType] = useState<KnowledgeType>("product");
  const [fields, setFields] = useState<StructuredFields>(DEFAULT_FIELDS);
  const [isActive, setIsActive] = useState(true);

  const [url, setUrl] = useState("");

  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  async function parseJsonResponse(response: Response) {
    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `API did not return JSON. Status: ${
          response.status
        }. Response starts with: ${text.slice(0, 120)}`
      );
    }
  }

  async function loadKnowledge() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/knowledge", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.error || "Failed to load knowledge.");
      }

      setKnowledge(result.knowledge || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load knowledge."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadKnowledge();
  }, []);

  const filteredKnowledge = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return knowledge;

    return knowledge.filter((entry) => {
      const type = entryTypeLabels[getEntryType(entry)].toLowerCase();

      return (
        entry.title.toLowerCase().includes(query) ||
        entry.content.toLowerCase().includes(query) ||
        type.includes(query) ||
        (entry.source_url || "").toLowerCase().includes(query) ||
        (entry.source_type || "").toLowerCase().includes(query)
      );
    });
  }, [knowledge, searchQuery]);

  function updateField(name: keyof StructuredFields, value: string) {
    setFields((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetManualForm() {
    setEntryType("product");
    setFields(DEFAULT_FIELDS);
    setIsActive(true);
  }

  function openEdit(entry: KnowledgeEntry) {
    setEditingEntry(entry);
    setEditTitle(entry.title || "");
    setEditContent(entry.content || "");
    setEditIsActive(entry.is_active !== false);
    setErrorMessage("");
    setSuccessMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function closeEdit() {
    setEditingEntry(null);
    setEditTitle("");
    setEditContent("");
    setEditIsActive(true);
  }

  function validateStructuredForm() {
    if (entryType === "product") {
      if (!fields.product_name.trim()) return "Product name is required.";
      if (!fields.description.trim()) return "Product description is required.";
      return "";
    }

    if (entryType === "service") {
      if (!fields.service_name.trim()) return "Service name is required.";
      if (!fields.description.trim()) return "Service description is required.";
      return "";
    }

    if (entryType === "faq") {
      if (!fields.question.trim()) return "FAQ question is required.";
      if (!fields.answer.trim()) return "FAQ answer is required.";
      return "";
    }

    if (entryType === "policy") {
      if (!fields.policy_title.trim()) return "Policy title is required.";
      if (!fields.description.trim()) return "Policy description is required.";
      return "";
    }

    if (!fields.general_title.trim()) return "Knowledge title is required.";
    if (!fields.general_content.trim()) return "Knowledge content is required.";

    return "";
  }

  async function handleCreateManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateStructuredForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    try {
      setIsCreating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          knowledge_type: entryType,
          fields: {
            ...fields,
            knowledge_type: entryType,
          },
          is_active: isActive,
        }),
      });

      const result = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.error || "Failed to create knowledge.");
      }

      setSuccessMessage(`${entryTypeLabels[entryType]} entry created successfully.`);
      resetManualForm();
      await loadKnowledge();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create knowledge."
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleImportUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!url.trim()) {
      setErrorMessage("Website URL is required.");
      return;
    }

    try {
      setIsImporting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/knowledge/import-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url,
        }),
      });

      const result = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.error || "Failed to import website.");
      }

      setSuccessMessage(
        `Imported "${result.extracted?.title || "website"}" successfully.`
      );
      setUrl("");
      await loadKnowledge();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to import website."
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function handleUpdateKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingEntry) return;

    if (!editTitle.trim()) {
      setErrorMessage("Knowledge title is required.");
      return;
    }

    if (!editContent.trim()) {
      setErrorMessage("Knowledge content is required.");
      return;
    }

    try {
      setIsUpdating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch(`/api/knowledge/${editingEntry.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          is_active: editIsActive,
        }),
      });

      const result = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.error || "Failed to update knowledge.");
      }

      setSuccessMessage("Knowledge entry updated successfully.");
      closeEdit();
      await loadKnowledge();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update knowledge."
      );
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDeleteKnowledge(entry: KnowledgeEntry) {
    const confirmed = window.confirm(
      `Delete "${entry.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(entry.id);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch(`/api/knowledge/${entry.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete knowledge.");
      }

      setSuccessMessage("Knowledge entry deleted successfully.");

      if (editingEntry?.id === entry.id) {
        closeEdit();
      }

      await loadKnowledge();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete knowledge."
      );
    } finally {
      setDeletingId(null);
    }
  }

  function renderTextInput(
    label: string,
    name: keyof StructuredFields,
    placeholder: string,
    options?: {
      type?: string;
    }
  ) {
    return (
      <label className="block space-y-2">
        <span className="text-sm text-slate-300">{label}</span>
        <input
          type={options?.type || "text"}
          value={getFieldValue(fields, name)}
          onChange={(event) => updateField(name, event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
        />
      </label>
    );
  }

  function renderTextArea(
    label: string,
    name: keyof StructuredFields,
    placeholder: string,
    rows = 4
  ) {
    return (
      <label className="block space-y-2">
        <span className="text-sm text-slate-300">{label}</span>
        <textarea
          value={getFieldValue(fields, name)}
          onChange={(event) => updateField(name, event.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
        />
      </label>
    );
  }

  function renderStructuredFields() {
    if (entryType === "product") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {renderTextInput("Product name", "product_name", "Example: Meat pie")}
            {renderTextInput("Category", "category", "Example: Pastries")}
            {renderTextInput("Price", "price", "Example: 1500")}
            {renderTextInput("Currency", "currency", "Example: NGN")}
            {renderTextInput("Availability / stock", "availability", "Example: Available daily")}
            {renderTextInput("Variants", "variants", "Example: Small, large, spicy, mild")}
          </div>

          {renderTextArea(
            "Product description",
            "description",
            "Describe the product clearly for the AI and customer.",
            5
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {renderTextArea("Delivery notes", "delivery_notes", "Example: Delivery available within Abuja.", 4)}
            {renderTextArea("Payment notes", "payment_notes", "Example: Payment before dispatch.", 4)}
          </div>

          {renderTextArea("Extra notes", "extra_notes", "Any extra instruction the AI should remember.", 3)}
        </>
      );
    }

    if (entryType === "service") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {renderTextInput("Service name", "service_name", "Example: Same-day delivery")}
            {renderTextInput("Category", "category", "Example: Logistics")}
            {renderTextInput("Price / rate", "price", "Example: From 3000")}
            {renderTextInput("Currency", "currency", "Example: NGN")}
            {renderTextInput("Availability", "availability", "Example: Mon-Sat, 9 AM - 5 PM")}
          </div>

          {renderTextArea(
            "Service description",
            "description",
            "Explain what the service includes, who it is for, and how customers can request it.",
            5
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {renderTextArea("Booking / delivery notes", "delivery_notes", "Example: Book at least 24 hours ahead.", 4)}
            {renderTextArea("Payment notes", "payment_notes", "Example: 50% deposit required.", 4)}
          </div>

          {renderTextArea("Extra notes", "extra_notes", "Any extra instruction the AI should remember.", 3)}
        </>
      );
    }

    if (entryType === "faq") {
      return (
        <>
          {renderTextArea("Question", "question", "Example: Do you deliver on Sundays?", 3)}
          {renderTextArea("Answer", "answer", "Write the answer the AI should give.", 5)}
          {renderTextArea("Extra notes", "extra_notes", "Optional internal notes.", 3)}
        </>
      );
    }

    if (entryType === "policy") {
      return (
        <>
          {renderTextInput("Policy title", "policy_title", "Example: Refund policy")}
          {renderTextArea("Policy details", "description", "Write the full policy details.", 5)}
          <div className="grid gap-4 md:grid-cols-2">
            {renderTextArea("Delivery notes", "delivery_notes", "Optional delivery policy notes.", 4)}
            {renderTextArea("Payment notes", "payment_notes", "Optional payment policy notes.", 4)}
          </div>
          {renderTextArea("Extra notes", "extra_notes", "Any extra instruction the AI should remember.", 3)}
        </>
      );
    }

    return (
      <>
        {renderTextInput("Title", "general_title", "Example: Business opening hours")}
        {renderTextArea(
          "Content",
          "general_content",
          "Write the business information the AI should use.",
          8
        )}
      </>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <BookOpen className="h-3.5 w-3.5" />
            Business Knowledge Base
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Knowledge Base
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Add products, services, FAQs, policies, or general business
                information. Product and service entries now open their own
                focused field options.
              </p>
            </div>

            <button
              onClick={loadKnowledge}
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
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        ) : null}

        {editingEntry ? (
          <form
            onSubmit={handleUpdateKnowledge}
            className="mb-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-2xl"
          >
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-100">
                <Edit3 className="h-5 w-5" />
                Edit knowledge entry
              </h2>

              <button
                type="button"
                onClick={closeEdit}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
                Cancel edit
              </button>
            </div>

            <div className="grid gap-4">
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                placeholder="Knowledge title"
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />

              <textarea
                value={editContent}
                onChange={(event) => setEditContent(event.target.value)}
                rows={10}
                placeholder="Knowledge content"
                className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />

              {editingEntry.source_url ? (
                <p className="break-all text-xs text-emerald-200">
                  Source URL: {editingEntry.source_url}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => setEditIsActive((current) => !current)}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  editIsActive
                    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                    : "border-slate-400/20 bg-slate-400/10 text-slate-300"
                }`}
              >
                {editIsActive ? (
                  <ToggleRight className="h-5 w-5" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
                {editIsActive ? "Active knowledge" : "Inactive knowledge"}
              </button>

              <button
                type="submit"
                disabled={isUpdating}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        ) : null}

        <section className="mb-6 grid gap-6 xl:grid-cols-2">
          <form
            onSubmit={handleCreateManual}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
          >
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
              <Plus className="h-5 w-5 text-emerald-400" />
              Add manually
            </h2>

            <p className="mb-4 text-sm leading-6 text-slate-400">
              Choose the type first. Product opens product fields; service opens
              service fields.
            </p>

            <div className="grid gap-4">
              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Entry type</span>
                <select
                  value={entryType}
                  onChange={(event) =>
                    setEntryType(event.target.value as KnowledgeType)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60"
                >
                  <option value="product" className="bg-slate-900">
                    Products
                  </option>
                  <option value="service" className="bg-slate-900">
                    Services
                  </option>
                  <option value="faq" className="bg-slate-900">
                    FAQ
                  </option>
                  <option value="policy" className="bg-slate-900">
                    Policy
                  </option>
                  <option value="general" className="bg-slate-900">
                    General knowledge
                  </option>
                </select>
              </label>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">
                Current form: {entryTypeLabels[entryType]} fields
              </div>

              {renderStructuredFields()}

              <button
                type="button"
                onClick={() => setIsActive((current) => !current)}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                    : "border-slate-400/20 bg-slate-400/10 text-slate-300"
                }`}
              >
                {isActive ? (
                  <ToggleRight className="h-5 w-5" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
                {isActive ? "Active knowledge" : "Inactive knowledge"}
              </button>

              <button
                type="submit"
                disabled={isCreating}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Save {entryTypeLabels[entryType]}
                  </>
                )}
              </button>
            </div>
          </form>

          <form
            onSubmit={handleImportUrl}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
          >
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Globe className="h-5 w-5 text-emerald-400" />
              Import from website
            </h2>

            <p className="mb-4 text-sm leading-6 text-slate-400">
              Paste a public website URL. The system will fetch the page,
              extract readable text, and save it as business knowledge.
            </p>

            <div className="grid gap-4">
              <div className="relative">
                <LinkIcon className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/menu"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>

              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
                Some websites block imports or load content with JavaScript. If
                import fails, copy and paste the content manually.
              </div>

              <button
                type="submit"
                disabled={isImporting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4" />
                    Import Website
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Knowledge entries</h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredKnowledge.length} of {knowledge.length} entries shown
              </p>
            </div>

            <div className="relative w-full md:max-w-xs">
              <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search knowledge..."
                className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
              Loading knowledge...
            </div>
          ) : filteredKnowledge.length === 0 ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm leading-6 text-slate-500">
              No knowledge entries found yet.
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredKnowledge.map((entry) => {
                const isUrl = entry.source_type === "url";
                const isDeleting = deletingId === entry.id;
                const type = getEntryType(entry);

                return (
                  <article
                    key={entry.id}
                    className="rounded-3xl border border-white/10 bg-slate-900/70 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap gap-2">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                              entry.is_active
                                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                : "border-slate-400/20 bg-slate-400/10 text-slate-300"
                            }`}
                          >
                            {entry.is_active ? "Active" : "Inactive"}
                          </span>

                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-300">
                            {isUrl ? (
                              <Globe className="h-3.5 w-3.5" />
                            ) : (
                              <BookOpen className="h-3.5 w-3.5" />
                            )}
                            {isUrl ? "Website import" : "Manual"}
                          </span>

                          {!isUrl ? (
                            <span
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                                type === "product"
                                  ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                                  : type === "service"
                                    ? "border-violet-400/20 bg-violet-400/10 text-violet-200"
                                    : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                              }`}
                            >
                              {type === "product" ? (
                                <Package className="h-3.5 w-3.5" />
                              ) : type === "service" ? (
                                <BriefcaseBusiness className="h-3.5 w-3.5" />
                              ) : null}
                              {entryTypeLabels[type]}
                            </span>
                          ) : null}
                        </div>

                        <h3 className="text-lg font-semibold text-white">
                          {entry.title}
                        </h3>

                        {type === "product" || type === "service" ? (
                          renderProductServiceSummary(entry, type)
                        ) : (
                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-400">
                            {previewText(entry.content)}
                          </p>
                        )}

                        {entry.source_url ? (
                          <p className="mt-3 break-all text-xs text-emerald-300">
                            Source: {entry.source_url}
                          </p>
                        ) : null}

                        <p className="mt-3 text-xs text-slate-500">
                          Added: {formatDate(entry.created_at)} · Updated: {" "}
                          {formatDate(entry.updated_at)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col gap-2">
                        <div className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-center text-xs text-slate-500">
                          {entry.content.length.toLocaleString()} chars
                        </div>

                        <button
                          onClick={() => openEdit(entry)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
                        >
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </button>

                        <button
                          onClick={() => handleDeleteKnowledge(entry)}
                          disabled={isDeleting}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
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
      </div>
    </main>
  );
}
