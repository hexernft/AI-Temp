"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Store,
  UserRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Business = {
  id: string;
  name: string | null;
};

type TestReplyResult = {
  reply: string;
  business?: Business;
  knowledge_count?: number;
};

export default function AiTestPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [customerName, setCustomerName] = useState("Test Customer");
  const [customerMessage, setCustomerMessage] = useState(
    "Hi, how much is your service and do you deliver?"
  );

  const [result, setResult] = useState<TestReplyResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedBusiness = useMemo(() => {
    return businesses.find((business) => business.id === businessId) || null;
  }, [businesses, businessId]);

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  async function loadBusinesses() {
    try {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const aiSettingsResponse = await fetch("/api/ai-settings", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const aiSettingsData = await aiSettingsResponse.json();

      if (aiSettingsResponse.ok) {
        const nextBusinesses = (aiSettingsData.businesses || []) as Business[];
        setBusinesses(nextBusinesses);

        if (!businessId && nextBusinesses[0]?.id) {
          setBusinessId(nextBusinesses[0].id);
        }

        return;
      }

      const adminBusinessesResponse = await fetch("/api/admin/businesses", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const adminBusinessesData = await adminBusinessesResponse.json();

      if (!adminBusinessesResponse.ok) {
        throw new Error(
          aiSettingsData.error ||
            adminBusinessesData.error ||
            "Failed to load businesses."
        );
      }

      const nextBusinesses = (adminBusinessesData.businesses || []) as Business[];
      setBusinesses(nextBusinesses);

      if (!businessId && nextBusinesses[0]?.id) {
        setBusinessId(nextBusinesses[0].id);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load businesses."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadBusinesses();
  }, []);

  async function handleTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!businessId) {
      setErrorMessage("Select a business first.");
      return;
    }

    if (!customerMessage.trim()) {
      setErrorMessage("Enter a customer message to test.");
      return;
    }

    try {
      setIsTesting(true);
      setErrorMessage("");
      setSuccessMessage("");
      setResult(null);

      const token = await getAccessToken();

      const response = await fetch("/api/ai/test-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          business_id: businessId,
          customer_name: customerName,
          customer_message: customerMessage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate AI test reply.");
      }

      setResult(data);
      setSuccessMessage("AI test reply generated.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to generate AI test reply."
      );
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Bot className="h-3.5 w-3.5" />
            Business AI Test
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Test Business AI Replies
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Send a sample customer message and preview the AI reply using the
                selected business profile and active knowledge base.
              </p>

              {selectedBusiness ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                  <Store className="h-4 w-4 text-emerald-400" />
                  {selectedBusiness.name || "Selected business"}
                </div>
              ) : null}
            </div>

            <button
              onClick={loadBusinesses}
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

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <form
            onSubmit={handleTest}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
          >
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <MessageCircle className="h-5 w-5 text-emerald-400" />
              Test message
            </h2>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Business
                </label>
                <select
                  value={businessId}
                  onChange={(event) => setBusinessId(event.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Select business</option>
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name || "Unnamed business"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Customer name
                </label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Test Customer"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Customer message
                </label>
                <textarea
                  value={customerMessage}
                  onChange={(event) => setCustomerMessage(event.target.value)}
                  rows={7}
                  placeholder="Hi, I want to place an order."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>

              <button
                type="submit"
                disabled={isTesting || isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Generate AI Reply
              </button>
            </div>
          </form>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Bot className="h-5 w-5 text-emerald-400" />
              AI preview
            </h2>

            {result ? (
              <div className="space-y-4">
                <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-300">
                    Assistant reply
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-100">
                    {result.reply}
                  </p>
                </div>

                <div className="grid gap-3 text-sm text-slate-400 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Business
                    </p>
                    <p className="mt-1 text-slate-200">
                      {result.business?.name || selectedBusiness?.name || "Business"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Active knowledge used
                    </p>
                    <p className="mt-1 text-slate-200">
                      {result.knowledge_count ?? 0} item(s)
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-6 text-sm leading-6 text-slate-500">
                Your generated AI reply will appear here after you send a test
                message.
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
