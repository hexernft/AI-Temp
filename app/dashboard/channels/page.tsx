"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Camera,
  Loader2,
  MessageCircle,
  PlugZap,
  RefreshCw,
  Save,
  Smartphone,
  XCircle,
} from "lucide-react";
import {
  DashboardPageShell,
  SmartCard,
  SmartStatCard,
} from "@/components/dashboard/DashboardPageShell";
import { supabase } from "@/lib/supabase";

type ChannelConnection = {
  id: string;
  business_id: string;
  phone_number?: string | null;
  phone_number_id?: string | null;
  display_phone_number?: string | null;
  verified_name?: string | null;
  instagram_business_account_id?: string | null;
  page_id?: string | null;
  username?: string | null;
  has_access_token?: boolean;
  has_global_access_token?: boolean;
  is_connected?: boolean;
  is_active?: boolean | null;
  last_webhook_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ChannelsResponse = {
  business?: {
    id: string;
    name: string | null;
  } | null;
  whatsapp?: ChannelConnection[];
  instagram?: ChannelConnection[];
  summary?: {
    whatsapp_connected: boolean;
    instagram_connected: boolean;
    global_whatsapp_token: boolean;
    global_instagram_token: boolean;
  };
};

type WhatsAppForm = {
  phone_number: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string;
  whatsapp_access_token: string;
};

type InstagramForm = {
  instagram_business_account_id: string;
  page_id: string;
  username: string;
  instagram_access_token: string;
};

const emptyWhatsAppForm: WhatsAppForm = {
  phone_number: "",
  phone_number_id: "",
  display_phone_number: "",
  verified_name: "",
  whatsapp_access_token: "",
};

const emptyInstagramForm: InstagramForm = {
  instagram_business_account_id: "",
  page_id: "",
  username: "",
  instagram_access_token: "",
};

function formatDate(value?: string | null) {
  if (!value) return "Not received yet";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
        connected
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
          : "border-amber-400/20 bg-amber-400/10 text-amber-300"
      }`}
    >
      {connected ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

function ConnectionCard({
  title,
  subtitle,
  connected,
  children,
}: {
  title: string;
  subtitle: string;
  connected: boolean;
  children: React.ReactNode;
}) {
  return (
    <SmartCard>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p>
        </div>
        <StatusPill connected={connected} />
      </div>
      {children}
    </SmartCard>
  );
}

export default function ChannelsPage() {
  const [data, setData] = useState<ChannelsResponse>({});
  const [whatsappForm, setWhatsappForm] =
    useState<WhatsAppForm>(emptyWhatsAppForm);
  const [instagramForm, setInstagramForm] =
    useState<InstagramForm>(emptyInstagramForm);
  const [isLoading, setIsLoading] = useState(true);
  const [savingChannel, setSavingChannel] = useState<"whatsapp" | "instagram" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const whatsappConnected = Boolean(data.summary?.whatsapp_connected);
  const instagramConnected = Boolean(data.summary?.instagram_connected);

  const activeWhatsApp = useMemo(
    () => data.whatsapp?.find((item) => item.is_active !== false) || null,
    [data.whatsapp]
  );

  const activeInstagram = useMemo(
    () => data.instagram?.find((item) => item.is_active !== false) || null,
    [data.instagram]
  );

  async function getAccessToken() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) throw new Error("You are not logged in.");

    return token;
  }

  async function loadChannels() {
    try {
      setIsLoading(true);
      setError("");

      const token = await getAccessToken();
      const response = await fetch("/api/channels", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load channel connections.");
      }

      setData(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load channel connections."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    if (!activeWhatsApp) return;

    setWhatsappForm((current) => ({
      ...current,
      phone_number: activeWhatsApp.phone_number || "",
      phone_number_id: activeWhatsApp.phone_number_id || "",
      display_phone_number: activeWhatsApp.display_phone_number || "",
      verified_name: activeWhatsApp.verified_name || "",
    }));
  }, [activeWhatsApp]);

  useEffect(() => {
    if (!activeInstagram) return;

    setInstagramForm((current) => ({
      ...current,
      instagram_business_account_id:
        activeInstagram.instagram_business_account_id || "",
      page_id: activeInstagram.page_id || "",
      username: activeInstagram.username || "",
    }));
  }, [activeInstagram]);

  async function saveWhatsApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingChannel("whatsapp");
    setError("");
    setSuccess("");

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/channels", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: "whatsapp",
          ...whatsappForm,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save WhatsApp channel.");
      }

      setWhatsappForm((current) => ({ ...current, whatsapp_access_token: "" }));
      setSuccess("WhatsApp channel saved.");
      await loadChannels();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save WhatsApp channel."
      );
    } finally {
      setSavingChannel(null);
    }
  }

  async function saveInstagram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingChannel("instagram");
    setError("");
    setSuccess("");

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/channels", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: "instagram",
          ...instagramForm,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save Instagram channel.");
      }

      setInstagramForm((current) => ({ ...current, instagram_access_token: "" }));
      setSuccess("Instagram channel saved.");
      await loadChannels();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save Instagram channel."
      );
    } finally {
      setSavingChannel(null);
    }
  }

  return (
    <DashboardPageShell
      badge="Channels"
      tone="business"
      title="Connected Channels"
      description="Connect WhatsApp and Instagram for this business. Both channels use the same knowledge base, AI settings, customer memory, and conversations inbox."
      icon={PlugZap}
      actions={
        <button
          onClick={loadChannels}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      }
    >
      {error ? (
        <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <SmartStatCard
          label="WhatsApp"
          value={whatsappConnected ? "Connected" : "Pending"}
          icon={Smartphone}
          tone="business"
        />
        <SmartStatCard
          label="Instagram"
          value={instagramConnected ? "Connected" : "Pending"}
          icon={Camera}
          tone="business"
        />
        <SmartStatCard
          label="Shared AI Brain"
          value="1 KB"
          icon={MessageCircle}
          tone="business"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ConnectionCard
          title="WhatsApp Business"
          subtitle="Manual connection now; later this button can become Meta Embedded Signup for one-click business onboarding."
          connected={whatsappConnected}
        >
          <form onSubmit={saveWhatsApp} className="grid gap-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                WhatsApp phone number
              </label>
              <input
                value={whatsappForm.phone_number}
                onChange={(event) =>
                  setWhatsappForm((current) => ({
                    ...current,
                    phone_number: event.target.value,
                  }))
                }
                placeholder="2348141283179"
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Meta Phone Number ID
              </label>
              <input
                value={whatsappForm.phone_number_id}
                onChange={(event) =>
                  setWhatsappForm((current) => ({
                    ...current,
                    phone_number_id: event.target.value,
                  }))
                }
                placeholder="Phone Number ID from Meta"
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={whatsappForm.display_phone_number}
                onChange={(event) =>
                  setWhatsappForm((current) => ({
                    ...current,
                    display_phone_number: event.target.value,
                  }))
                }
                placeholder="Display number"
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
              <input
                value={whatsappForm.verified_name}
                onChange={(event) =>
                  setWhatsappForm((current) => ({
                    ...current,
                    verified_name: event.target.value,
                  }))
                }
                placeholder="Verified name"
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                WhatsApp access token
              </label>
              <input
                type="password"
                value={whatsappForm.whatsapp_access_token}
                onChange={(event) =>
                  setWhatsappForm((current) => ({
                    ...current,
                    whatsapp_access_token: event.target.value,
                  }))
                }
                placeholder={
                  activeWhatsApp?.has_access_token ||
                  activeWhatsApp?.has_global_access_token
                    ? "Token already available — paste only to replace"
                    : "Paste token for this business number"
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Later this will be replaced by Meta Embedded Signup so businesses authorize once without touching Meta Developer tools.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-5 text-slate-400">
              Last webhook: {formatDate(activeWhatsApp?.last_webhook_at)}
            </div>

            <button
              type="submit"
              disabled={savingChannel === "whatsapp"}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingChannel === "whatsapp" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save WhatsApp
            </button>
          </form>
        </ConnectionCard>

        <ConnectionCard
          title="Instagram"
          subtitle="Manual token connection now; later this becomes a Connect Instagram button with Meta authorization."
          connected={instagramConnected}
        >
          <form onSubmit={saveInstagram} className="grid gap-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Instagram business account ID
              </label>
              <input
                value={instagramForm.instagram_business_account_id}
                onChange={(event) =>
                  setInstagramForm((current) => ({
                    ...current,
                    instagram_business_account_id: event.target.value,
                  }))
                }
                placeholder="Instagram business account ID"
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={instagramForm.username}
                onChange={(event) =>
                  setInstagramForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                placeholder="Username"
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
              <input
                value={instagramForm.page_id}
                onChange={(event) =>
                  setInstagramForm((current) => ({
                    ...current,
                    page_id: event.target.value,
                  }))
                }
                placeholder="Page ID, optional"
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Instagram access token
              </label>
              <input
                type="password"
                value={instagramForm.instagram_access_token}
                onChange={(event) =>
                  setInstagramForm((current) => ({
                    ...current,
                    instagram_access_token: event.target.value,
                  }))
                }
                placeholder={
                  activeInstagram?.has_access_token ||
                  activeInstagram?.has_global_access_token
                    ? "Token already available — paste only to replace"
                    : "Paste token for this Instagram account"
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Businesses will eventually authorize this from your dashboard instead of generating tokens manually.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-5 text-slate-400">
              Last webhook: {formatDate(activeInstagram?.last_webhook_at)}
            </div>

            <button
              type="submit"
              disabled={savingChannel === "instagram"}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingChannel === "instagram" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Instagram
            </button>
          </form>
        </ConnectionCard>
      </div>
    </DashboardPageShell>
  );
}
