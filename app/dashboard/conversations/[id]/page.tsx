"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  RefreshCcw,
  RotateCcw,
  Send,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Conversation = {
  id: string;
  business_id?: string | null;
  school_id?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  phone?: string | null;
  status?: string | null;
  handoff_status?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type Message = {
  id: string;
  conversation_id?: string | null;
  role?: string | null;
  sender?: string | null;
  direction?: string | null;
  message?: string | null;
  content?: string | null;
  body?: string | null;
  text?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

type ConversationApiResponse = {
  conversation: Conversation;
  messages: Message[];
  messages_table: string | null;
};

function getMessageText(message: Message) {
  return (
    message.message ||
    message.content ||
    message.body ||
    message.text ||
    "No message content"
  );
}

function getMessageRole(message: Message) {
  const rawRole = String(
    message.role || message.sender || message.direction || ""
  ).toLowerCase();

  if (
    rawRole.includes("assistant") ||
    rawRole.includes("ai") ||
    rawRole.includes("outbound") ||
    rawRole.includes("business")
  ) {
    return "assistant";
  }

  if (
    rawRole.includes("user") ||
    rawRole.includes("customer") ||
    rawRole.includes("inbound")
  ) {
    return "customer";
  }

  return "unknown";
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusLabel(conversation: Conversation | null) {
  const status = conversation?.status || "open";
  const handoffStatus = conversation?.handoff_status || "";

  if (handoffStatus === "pending" || handoffStatus === "active") {
    return "Human handoff";
  }

  if (handoffStatus === "resolved") {
    return "AI active";
  }

  if (status === "closed") {
    return "Closed";
  }

  return "Open";
}

function shouldShowResumeAi(conversation: Conversation | null) {
  const handoffStatus = String(conversation?.handoff_status || "").toLowerCase();
  const status = String(conversation?.status || "").toLowerCase();

  return (
    handoffStatus === "pending" ||
    handoffStatus === "active" ||
    status === "handoff" ||
    status === "human"
  );
}

export default function ConversationDetailPage() {
  const params = useParams();
  const conversationId = String(params?.id || "");

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesTable, setMessagesTable] = useState<string | null>(null);

  const [manualReply, setManualReply] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isResumingAi, setIsResumingAi] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const customerName = useMemo(() => {
    return (
      conversation?.customer_phone ||
      conversation?.phone ||
      conversation?.customer_name ||
      "Unknown customer"
    );
  }, [conversation]);

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

  async function loadConversation({ quiet = false }: { quiet?: boolean } = {}) {
    try {
      if (quiet) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = (await parseJsonResponse(
        response
      )) as ConversationApiResponse & { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Failed to load chat.");
      }

      setConversation(result.conversation);
      setMessages(result.messages || []);
      setMessagesTable(result.messages_table || null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load chat."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!conversationId) return;

    loadConversation();
  }, [conversationId]);

  async function handleSendManualReply() {
    if (!manualReply.trim()) {
      setErrorMessage("Type a reply first.");
      return;
    }

    try {
      setIsSending(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch(
        `/api/conversations/${conversationId}/reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: manualReply,
          }),
        }
      );

      const result = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.error || "Failed to send reply.");
      }

      setManualReply("");
      setSuccessMessage("Reply sent.");
      await loadConversation({ quiet: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to send reply."
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleResumeAi() {
    try {
      setIsResumingAi(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch(
        `/api/conversations/${conversationId}/resume-ai`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.error || "Failed to resume AI.");
      }

      setConversation(result.conversation || conversation);
      setSuccessMessage(result.message || "AI replies resumed for this chat.");
      await loadConversation({ quiet: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to resume AI."
      );
    } finally {
      setIsResumingAi(false);
    }
  }

  async function handleDeleteChat() {
    const confirmed = window.confirm(
      "Delete this chat? This will remove the chat and its messages from the dashboard."
    );

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete chat.");
      }

      window.location.replace("/dashboard/conversations");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete chat."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.13),transparent_30%),linear-gradient(135deg,#020617_0%,#05251c_45%,#111827_100%)] px-4 text-white">
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-4 shadow-2xl backdrop-blur">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          <span className="text-sm text-slate-300">Loading chat...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.13),transparent_30%),linear-gradient(135deg,#020617_0%,#05251c_45%,#111827_100%)] px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/conversations"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Chat
          </Link>

          <div className="flex flex-wrap gap-2">
            {shouldShowResumeAi(conversation) ? (
              <button
                onClick={handleResumeAi}
                disabled={isResumingAi}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResumingAi ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Resume AI
              </button>
            ) : null}

            <button
              onClick={() => loadConversation({ quiet: true })}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Refresh
            </button>

            <button
              onClick={handleDeleteChat}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete Chat
            </button>
          </div>
        </div>

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

        <section className="mb-5 rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                <MessageCircle className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">
                  Chat
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight">
                  {customerName}
                </h1>

                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>ID: {conversation?.id}</span>
                  <span>•</span>
                  <span>Status: {getStatusLabel(conversation)}</span>
                  {messagesTable ? (
                    <>
                      <span>•</span>
                      <span>Messages table: {messagesTable}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-400">
              <Clock className="mr-2 inline h-4 w-4" />
              {formatDate(
                conversation?.last_message_at || conversation?.updated_at
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-4 shadow-xl shadow-black/10 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Messages</h2>
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs text-slate-400">
              {messages.length} messages
            </span>
          </div>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-center text-sm text-slate-500">
                No messages found for this chat yet.
              </div>
            ) : (
              messages.map((message) => {
                const role = getMessageRole(message);
                const isAssistant = role === "assistant";
                const isCustomer = role === "customer";

                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      isAssistant ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[82%] rounded-3xl border px-4 py-3 text-sm leading-6 shadow-xl ${
                        isAssistant
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-50"
                          : isCustomer
                            ? "border-white/10 bg-white/[0.055] text-slate-100"
                            : "border-slate-400/20 bg-slate-400/10 text-slate-200"
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs opacity-70">
                        {isAssistant ? (
                          <Bot className="h-3.5 w-3.5" />
                        ) : (
                          <UserRound className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {isAssistant
                            ? "AI / Business"
                            : isCustomer
                              ? "Customer"
                              : "Message"}
                        </span>
                      </div>

                      <p className="whitespace-pre-wrap">
                        {getMessageText(message)}
                      </p>

                      <p className="mt-2 text-[11px] opacity-50">
                        {formatDate(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/60 p-4">
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Manual reply
            </label>

            <textarea
              value={manualReply}
              onChange={(event) => setManualReply(event.target.value)}
              rows={4}
              placeholder="Type a manual reply..."
              className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
            />

            <button
              onClick={handleSendManualReply}
              disabled={isSending}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Reply
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}