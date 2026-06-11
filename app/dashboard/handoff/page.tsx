"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  User,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Relation =
  | {
      id?: string | null;
      name?: string | null;
      phone?: string | null;
    }
  | {
      id?: string | null;
      name?: string | null;
      phone?: string | null;
    }[]
  | null
  | undefined;

type HandoffConversation = {
  id: string;
  business_id: string | null;
  customer_id: string | null;
  status: string | null;
  handoff_required: boolean | null;
  last_message_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  businesses?: Relation;
  customers?: Relation;
};

function getRelationName(relation: Relation, fallback: string) {
  if (!relation) return fallback;

  if (Array.isArray(relation)) {
    return relation[0]?.name || fallback;
  }

  return relation.name || fallback;
}

function getRelationPhone(relation: Relation) {
  if (!relation) return "No phone";

  if (Array.isArray(relation)) {
    return relation[0]?.phone || "No phone";
  }

  return relation.phone || "No phone";
}

function formatDate(value?: string | null) {
  if (!value) return "No date";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function HandoffPage() {
  const [conversations, setConversations] = useState<HandoffConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  async function loadHandoffQueue() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/handoff", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load handoff queue.");
      }

      setConversations(result.conversations || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load handoff queue."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadHandoffQueue();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            Human Handoff
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Handoff Queue
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Conversations that need human attention appear here. Open a
                conversation to review the chat and send a manual reply.
              </p>
            </div>

            <button
              onClick={loadHandoffQueue}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
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

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MessageCircle className="h-5 w-5 text-emerald-400" />
              Conversations needing attention
            </h2>

            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
              {conversations.length} item{conversations.length === 1 ? "" : "s"}
            </span>
          </div>

          {isLoading ? (
            <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
              Loading handoff queue...
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm leading-6 text-slate-500">
              No conversations currently require human handoff.
            </div>
          ) : (
            <div className="grid gap-4">
              {conversations.map((conversation) => {
                const customerName = getRelationName(
                  conversation.customers,
                  "Unknown customer"
                );

                const customerPhone = getRelationPhone(conversation.customers);

                const businessName = getRelationName(
                  conversation.businesses,
                  "Business"
                );

                return (
                  <article
                    key={conversation.id}
                    className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.04] p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Needs human reply
                        </div>

                        <h3 className="text-lg font-semibold text-white">
                          {customerName}
                        </h3>

                        <div className="mt-3 grid gap-2 text-sm text-slate-400">
                          <p className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-emerald-400" />
                            {customerPhone}
                          </p>

                          <p className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-emerald-400" />
                            {businessName}
                          </p>

                          <p className="flex items-center gap-2">
                            <User className="h-4 w-4 text-emerald-400" />
                            Last message:{" "}
                            {formatDate(conversation.last_message_at)}
                          </p>
                        </div>
                      </div>

                      <Link
                        href={`/dashboard/conversations/${conversation.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                      >
                        Open Chat
                        <ArrowRight className="h-4 w-4" />
                      </Link>
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