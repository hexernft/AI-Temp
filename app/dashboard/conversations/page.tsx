"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCcw,
  RotateCcw,
  Search,
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

type ConversationListResponse = {
  conversations: Conversation[];
  error?: string;
};

type ConversationDetailResponse = {
  conversation: Conversation;
  messages: Message[];
  messages_table: string | null;
  error?: string;
};

function getConversationName(conversation: Conversation) {
  return (
    conversation.customer_phone ||
    conversation.phone ||
    conversation.customer_name ||
    "Unknown customer"
  );
}

function getConversationPhone(conversation: Conversation) {
  return conversation.customer_phone || conversation.phone || "";
}

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

function formatTime(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusLabel(conversation: Conversation | null) {
  const status = String(conversation?.status || "open").toLowerCase();
  const handoffStatus = String(conversation?.handoff_status || "").toLowerCase();

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

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesTable, setMessagesTable] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [manualReply, setManualReply] = useState("");

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isResumingAi, setIsResumingAi] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return conversations;

    return conversations.filter((conversation) => {
      const name = getConversationName(conversation).toLowerCase();
      const phone = getConversationPhone(conversation).toLowerCase();
      const lastMessage = String(conversation.last_message || "").toLowerCase();

      return (
        name.includes(term) || phone.includes(term) || lastMessage.includes(term)
      );
    });
  }, [conversations, search]);

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

  async function loadConversations({ keepSelected = true } = {}) {
    try {
      setIsLoadingList(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/conversations?limit=100", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = (await parseJsonResponse(
        response
      )) as ConversationListResponse;

      if (!response.ok) {
        throw new Error(result.error || "Failed to load chats.");
      }

      const nextConversations = result.conversations || [];
      setConversations(nextConversations);

      if (!keepSelected || !selectedConversation) {
        const firstConversation = nextConversations[0] || null;
        setSelectedConversation(firstConversation);

        if (firstConversation) {
          await loadConversation(firstConversation.id, {
            showLoader: false,
            updateSelectedFromList: false,
          });
        }
      } else {
        const stillExists = nextConversations.find(
          (item) => item.id === selectedConversation.id
        );

        if (!stillExists) {
          const firstConversation = nextConversations[0] || null;
          setSelectedConversation(firstConversation);

          if (firstConversation) {
            await loadConversation(firstConversation.id, {
              showLoader: false,
              updateSelectedFromList: false,
            });
          } else {
            setMessages([]);
            setMessagesTable(null);
          }
        }
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load chats."
      );
    } finally {
      setIsLoadingList(false);
    }
  }

  async function loadConversation(
    conversationId: string,
    options: {
      showLoader?: boolean;
      updateSelectedFromList?: boolean;
    } = {}
  ) {
    const showLoader = options.showLoader ?? true;
    const updateSelectedFromList = options.updateSelectedFromList ?? true;

    try {
      if (showLoader) setIsLoadingChat(true);

      setErrorMessage("");
      setSuccessMessage("");

      if (updateSelectedFromList) {
        const fromList = conversations.find((item) => item.id === conversationId);

        if (fromList) {
          setSelectedConversation(fromList);
        }
      }

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
      )) as ConversationDetailResponse;

      if (!response.ok) {
        throw new Error(result.error || "Failed to load chat.");
      }

      setSelectedConversation(result.conversation);
      setMessages(result.messages || []);
      setMessagesTable(result.messages_table || null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load chat."
      );
    } finally {
      setIsLoadingChat(false);
    }
  }

  useEffect(() => {
    loadConversations({ keepSelected: false });
  }, []);

  async function handleSendManualReply() {
    if (!selectedConversation) {
      setErrorMessage("Select a chat first.");
      return;
    }

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
        `/api/conversations/${selectedConversation.id}/reply`,
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

      await loadConversation(selectedConversation.id, {
        showLoader: false,
        updateSelectedFromList: false,
      });

      await loadConversations({ keepSelected: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to send reply."
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleResumeAi() {
    if (!selectedConversation) return;

    try {
      setIsResumingAi(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch(
        `/api/conversations/${selectedConversation.id}/resume-ai`,
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

      setSuccessMessage(result.message || "AI replies resumed for this chat.");

      await loadConversation(selectedConversation.id, {
        showLoader: false,
        updateSelectedFromList: false,
      });

      await loadConversations({ keepSelected: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to resume AI."
      );
    } finally {
      setIsResumingAi(false);
    }
  }

  async function handleDeleteChat() {
    if (!selectedConversation) return;

    const confirmed = window.confirm(
      "Delete this chat? This will remove the chat and its messages from the dashboard."
    );

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch(`/api/conversations/${selectedConversation.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete chat.");
      }

      setSelectedConversation(null);
      setMessages([]);
      setMessagesTable(null);
      setSuccessMessage("Chat deleted.");

      await loadConversations({ keepSelected: false });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete chat."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.13),transparent_30%),linear-gradient(135deg,#020617_0%,#05251c_45%,#111827_100%)] p-4 text-white">
      <div className="mx-auto grid h-[calc(100vh-2rem)] max-w-[1600px] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/50 shadow-2xl shadow-black/30 backdrop-blur xl:grid-cols-[380px_1fr]">
        <aside className="flex min-h-0 flex-col border-b border-white/10 bg-slate-950/60 xl:border-b-0 xl:border-r">
          <div className="border-b border-white/10 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">
                  Business Center
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight">
                  Chat
                </h1>
              </div>

              <button
                onClick={() => loadConversations({ keepSelected: true })}
                disabled={isLoadingList}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                title="Refresh chats"
              >
                {isLoadingList ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search chats"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.055] py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
            </div>

            <div className="mt-3 flex gap-2">
              <span className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white">
                All
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-400">
                {conversations.length} chats
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoadingList && conversations.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
                Loading chats...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No chats found.
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const isActive = selectedConversation?.id === conversation.id;
                const isHandoff =
                  conversation.handoff_status === "pending" ||
                  conversation.handoff_status === "active";

                return (
                  <button
                    key={conversation.id}
                    onClick={() => loadConversation(conversation.id)}
                    className={`group flex w-full gap-3 border-b border-white/5 px-4 py-4 text-left transition ${
                      isActive
                        ? "bg-emerald-400/10"
                        : "hover:bg-white/[0.045]"
                    }`}
                  >
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                        isActive
                          ? "bg-emerald-500 text-white"
                          : "bg-white/[0.07] text-slate-400"
                      }`}
                    >
                      <UserRound className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-sm font-bold text-white">
                          {getConversationName(conversation)}
                        </p>

                        <span className="shrink-0 text-xs text-slate-500">
                          {formatTime(
                            conversation.last_message_at ||
                              conversation.updated_at ||
                              conversation.created_at
                          )}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-sm text-slate-400">
                        {conversation.last_message || "No recent message"}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isHandoff
                              ? "bg-amber-400/10 text-amber-300"
                              : "bg-emerald-400/10 text-emerald-300"
                          }`}
                        >
                          {isHandoff ? "Handoff" : "AI"}
                        </span>

                        {getConversationPhone(conversation) ? (
                          <span className="truncate text-[11px] text-slate-600">
                            {getConversationPhone(conversation)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-[#07110f]/80">
          {selectedConversation ? (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950/50 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <UserRound className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-white">
                      {getConversationName(selectedConversation)}
                    </h2>
                    <p className="truncate text-xs text-slate-500">
                      {getStatusLabel(selectedConversation)}
                      {messagesTable ? ` · ${messagesTable}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  {shouldShowResumeAi(selectedConversation) ? (
                    <button
                      onClick={handleResumeAi}
                      disabled={isResumingAi}
                      className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-60"
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
                    onClick={() =>
                      loadConversation(selectedConversation.id, {
                        showLoader: false,
                        updateSelectedFromList: false,
                      })
                    }
                    disabled={isLoadingChat}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-60"
                  >
                    {isLoadingChat ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-4 w-4" />
                    )}
                    Refresh
                  </button>

                  <button
                    onClick={handleDeleteChat}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/15 disabled:opacity-60"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete
                  </button>
                </div>
              </header>

              {errorMessage ? (
                <div className="mx-5 mt-4 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              {successMessage ? (
                <div className="mx-5 mt-4 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08),transparent_34%)] px-5 py-5">
                {isLoadingChat ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
                    Loading chat...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 text-center text-sm text-slate-500">
                      No messages found for this chat yet.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => {
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
                            className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-xl ${
                              isAssistant
                                ? "rounded-tr-md bg-emerald-900/85 text-emerald-50"
                                : isCustomer
                                  ? "rounded-tl-md bg-white/[0.11] text-slate-100"
                                  : "bg-slate-700/50 text-slate-200"
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

                            <div className="mt-2 flex justify-end">
                              <span className="text-[11px] opacity-50">
                                {formatTime(message.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <footer className="border-t border-white/10 bg-slate-950/55 p-4">
                <div className="flex gap-3">
                  <textarea
                    value={manualReply}
                    onChange={(event) => setManualReply(event.target.value)}
                    rows={1}
                    placeholder="Type a message"
                    className="max-h-32 min-h-[48px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                  />

                  <button
                    onClick={handleSendManualReply}
                    disabled={isSending}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Send reply"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-sm rounded-[2rem] border border-white/10 bg-white/[0.035] p-8 text-center shadow-2xl shadow-black/20">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-black">Select a chat</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Choose a conversation from the list to view messages and reply.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}