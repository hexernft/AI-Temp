"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Loader2,
  Save,
  Settings2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Business = {
  id: string;
  name: string;
};

type BusinessRelation =
  | {
      id?: string | null;
      name?: string | null;
    }
  | {
      id?: string | null;
      name?: string | null;
    }[]
  | null;

type AiSetting = {
  id: string;
  business_id: string;
  auto_reply_enabled: boolean;
  handoff_enabled: boolean;
  fallback_message: string;
  created_at: string | null;
  updated_at: string | null;
  businesses?: BusinessRelation;
};

function getBusinessName(item: AiSetting) {
  if (Array.isArray(item.businesses)) {
    return item.businesses[0]?.name || "Business";
  }

  return item.businesses?.name || "Business";
}

export default function AiSettingsPage() {
  const [settings, setSettings] = useState<AiSetting[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const [businessId, setBusinessId] = useState("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [handoffEnabled, setHandoffEnabled] = useState(true);
  const [fallbackMessage, setFallbackMessage] = useState(
    "Thanks for your message. A team member will confirm shortly."
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

  async function loadData() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/ai-settings", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load AI settings.");
      }

      setSettings(result.settings || []);
      setBusinesses(result.businesses || []);

      if (!businessId && result.businesses?.[0]?.id) {
        const firstBusinessId = result.businesses[0].id;
        setBusinessId(firstBusinessId);

        const existingSetting = (result.settings || []).find(
          (item: AiSetting) => item.business_id === firstBusinessId
        );

        if (existingSetting) {
          setAutoReplyEnabled(existingSetting.auto_reply_enabled);
          setHandoffEnabled(existingSetting.handoff_enabled);
          setFallbackMessage(existingSetting.fallback_message);
        }
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load AI settings."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleBusinessChange(nextBusinessId: string) {
    setBusinessId(nextBusinessId);

    const existingSetting = settings.find(
      (item) => item.business_id === nextBusinessId
    );

    if (existingSetting) {
      setAutoReplyEnabled(existingSetting.auto_reply_enabled);
      setHandoffEnabled(existingSetting.handoff_enabled);
      setFallbackMessage(existingSetting.fallback_message);
    } else {
      setAutoReplyEnabled(true);
      setHandoffEnabled(true);
      setFallbackMessage(
        "Thanks for your message. A team member will confirm shortly."
      );
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!businessId || !fallbackMessage.trim()) {
      setErrorMessage("Business and fallback message are required.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/ai-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          business_id: businessId,
          auto_reply_enabled: autoReplyEnabled,
          handoff_enabled: handoffEnabled,
          fallback_message: fallbackMessage,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save AI settings.");
      }

      setSettings((currentSettings) => {
        const withoutExisting = currentSettings.filter(
          (item) => item.business_id !== result.settings.business_id
        );

        return [result.settings, ...withoutExisting];
      });

      setSuccessMessage("AI settings saved.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save AI settings."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Settings2 className="h-3.5 w-3.5" />
            Automation Control
          </div>

          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            AI Settings
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Control whether Gemini should reply automatically for each business,
            and set the fallback message used when the AI should not answer.
          </p>
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

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <form
            onSubmit={handleSave}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
          >
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Bot className="h-5 w-5 text-emerald-400" />
              Configure auto replies
            </h2>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Business
                </label>

                <select
                  value={businessId}
                  onChange={(event) => handleBusinessChange(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60"
                >
                  <option value="">Select business</option>
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Auto reply enabled
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    When enabled, Gemini can automatically reply to incoming
                    WhatsApp messages.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={autoReplyEnabled}
                  onChange={(event) => setAutoReplyEnabled(event.target.checked)}
                  className="h-5 w-5 accent-emerald-400"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Human handoff enabled
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    When enabled, sensitive or complex messages can be marked for
                    manual team follow-up.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={handoffEnabled}
                  onChange={(event) => setHandoffEnabled(event.target.checked)}
                  className="h-5 w-5 accent-emerald-400"
                />
              </label>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Fallback message
                </label>

                <textarea
                  value={fallbackMessage}
                  onChange={(event) => setFallbackMessage(event.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving || !businessId || !fallbackMessage.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </form>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Current settings</h2>

              <button
                onClick={loadData}
                disabled={isLoading}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            {isLoading ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
                Loading settings...
              </div>
            ) : settings.length === 0 ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm leading-6 text-slate-500">
                No AI settings saved yet.
              </div>
            ) : (
              <div className="grid gap-4">
                {settings.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-3xl border border-white/10 bg-slate-900/70 p-4"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-white">
                          {getBusinessName(item)}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          AI automation settings
                        </p>
                      </div>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          item.auto_reply_enabled
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-red-400/10 text-red-300"
                        }`}
                      >
                        Auto reply:{" "}
                        {item.auto_reply_enabled ? "Enabled" : "Disabled"}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          item.handoff_enabled
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-red-400/10 text-red-300"
                        }`}
                      >
                        Handoff:{" "}
                        {item.handoff_enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                      <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                        Fallback message
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {item.fallback_message}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}