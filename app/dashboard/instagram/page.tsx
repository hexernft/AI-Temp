"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { supabase } from "@/lib/supabase";

type InstagramAccount = {
  id: string;
  business_id: string;
  instagram_business_account_id: string;
  page_id: string | null;
  username: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type FormState = {
  id: string;
  instagram_business_account_id: string;
  page_id: string;
  username: string;
  access_token: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  id: "",
  instagram_business_account_id: "",
  page_id: "",
  username: "",
  access_token: "",
  is_active: true,
};

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function InstagramIntegrationPage() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.is_active !== false).length,
    [accounts]
  );

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function loadAccounts() {
    setIsLoading(true);
    setError("");

    try {
      const token = await getAccessToken();

      const response = await fetch("/api/instagram-accounts", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load Instagram accounts.");
      }

      setAccounts(result.accounts || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load Instagram accounts."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  function updateForm(field: keyof FormState, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function editAccount(account: InstagramAccount) {
    setForm({
      id: account.id,
      instagram_business_account_id: account.instagram_business_account_id,
      page_id: account.page_id || "",
      username: account.username || "",
      access_token: "",
      is_active: account.is_active !== false,
    });
    setSuccess("");
    setError("");
  }

  function resetForm() {
    setForm(emptyForm);
    setSuccess("");
    setError("");
  }

  async function saveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const token = await getAccessToken();

      const response = await fetch("/api/instagram-accounts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save Instagram account.");
      }

      setSuccess("Instagram account saved.");
      setForm(emptyForm);
      await loadAccounts();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save Instagram account."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteAccount(accountId: string) {
    setIsDeletingId(accountId);
    setError("");
    setSuccess("");

    try {
      const token = await getAccessToken();

      const response = await fetch("/api/instagram-accounts", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: accountId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete Instagram account.");
      }

      setSuccess("Instagram account removed.");
      await loadAccounts();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete Instagram account."
      );
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <DashboardPageShell
      badge="Instagram"
      tone="business"
      title="Instagram Integration"
      description="Connect an Instagram professional account so DMs can use the same products, services, FAQs, and policies from your business knowledge base."
      icon={MessageCircle}
      actions={
        <button
          type="button"
          onClick={loadAccounts}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Connected Instagram accounts
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {activeAccounts} active account{activeAccounts === 1 ? "" : "s"} connected.
              </p>
            </div>
            <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-pink-700">
              Same AI knowledge
            </span>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {success}
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex items-center gap-3 py-12 text-sm font-semibold text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading Instagram accounts...
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                <MessageCircle className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-black text-slate-950">
                No Instagram account connected yet
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Add your Instagram business account ID and access token to start replying to Instagram DMs with the same AI knowledge base.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {accounts.map((account) => (
                <article
                  key={account.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-slate-950">
                          {account.username || "Instagram account"}
                        </h3>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            account.is_active === false
                              ? "bg-slate-200 text-slate-600"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {account.is_active === false ? "Inactive" : "Active"}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-slate-600">
                        <p>
                          <span className="font-bold text-slate-800">
                            IG business account ID:
                          </span>{" "}
                          {account.instagram_business_account_id}
                        </p>
                        <p>
                          <span className="font-bold text-slate-800">
                            Page ID:
                          </span>{" "}
                          {account.page_id || "Not set"}
                        </p>
                        <p>
                          <span className="font-bold text-slate-800">
                            Updated:
                          </span>{" "}
                          {formatDate(account.updated_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => editAccount(account)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAccount(account.id)}
                        disabled={isDeletingId === account.id}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        {isDeletingId === account.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50 text-pink-700">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950">
                {form.id ? "Edit account" : "Add account"}
              </h2>
              <p className="text-sm text-slate-500">
                Access token is hidden after saving.
              </p>
            </div>
          </div>

          <form onSubmit={saveAccount} className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Instagram business account ID
              </span>
              <input
                value={form.instagram_business_account_id}
                onChange={(event) =>
                  updateForm(
                    "instagram_business_account_id",
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400"
                placeholder="1784..."
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Facebook Page ID / recipient ID fallback
              </span>
              <input
                value={form.page_id}
                onChange={(event) => updateForm("page_id", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400"
                placeholder="Optional, but useful for webhook routing"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Username / label
              </span>
              <input
                value={form.username}
                onChange={(event) =>
                  updateForm("username", event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400"
                placeholder="@yourbusiness"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Access token
              </span>
              <textarea
                value={form.access_token}
                onChange={(event) =>
                  updateForm("access_token", event.target.value)
                }
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400"
                placeholder={
                  form.id
                    ? "Leave blank to keep the saved token"
                    : "Paste Instagram/Meta access token"
                }
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
              <span>
                <span className="block text-sm font-bold text-slate-700">
                  Active
                </span>
                <span className="text-xs text-slate-500">
                  Use this account for incoming Instagram DMs.
                </span>
              </span>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) =>
                  updateForm("is_active", event.target.checked)
                }
                className="h-5 w-5 accent-pink-600"
              />
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Instagram
              </button>
              {form.id ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-bold text-slate-800">Webhook callback URL</p>
            <p className="mt-1 break-all font-mono text-xs">
              /api/webhook/instagram
            </p>
            <p className="mt-3">
              Use the same verify token value you set in INSTAGRAM_VERIFY_TOKEN or WEBHOOK_VERIFY_TOKEN.
            </p>
          </div>
        </aside>
      </div>
    </DashboardPageShell>
  );
}
