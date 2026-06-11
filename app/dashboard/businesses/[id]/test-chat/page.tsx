"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Database,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Business = {
  id: string;
  name: string | null;
  type: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  location: string | null;
};

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "super_admin" | "business_owner" | "staff" | string;
};

type KnowledgeItem = {
  id: string;
  title: string;
  content: string;
  category: string | null;
};

type ChatMessage = {
  role: "customer" | "assistant";
  content: string;
};

type LeadData = {
  customer_name: string | null;
  service_requested: string | null;
  budget: string | null;
  date_needed: string | null;
  location: string | null;
  notes: string | null;
  status: string | null;
};

function getBusinessName(business: Business | null) {
  if (!business) return "Business";
  return business.name || business.type || "Business";
}

export default function TestChatPage() {
  const params = useParams();
  const businessId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [conversationId, setConversationId] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello. I’m ready to test this business assistant. Send a customer message to begin.",
    },
  ]);

  const [inputMessage, setInputMessage] = useState("");
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isReplying, setIsReplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    async function loadBusinessData() {
      try {
        setIsLoadingPage(true);
        setErrorMessage("");

        const businessResponse = await fetch("/api/dashboard/businesses", {
          method: "GET",
          cache: "no-store",
        });

        const businessData = await businessResponse.json();

        if (!businessResponse.ok) {
          throw new Error(
            businessData?.error || "Failed to load business access."
          );
        }

        const loadedProfile = businessData.profile as Profile | null;
        const businesses = (businessData.businesses || []) as Business[];
        const foundBusiness = businesses.find((item) => item.id === businessId);

        if (!loadedProfile) {
          throw new Error("Your user profile was not found.");
        }

        if (!foundBusiness) {
          throw new Error("Business not found or you do not have access to it.");
        }

        setProfile(loadedProfile);
        setBusiness(foundBusiness);

        const { data: knowledgeData, error: knowledgeError } = await supabase
          .from("business_knowledge")
          .select("id, title, content, category")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false });

        if (knowledgeError) {
          throw new Error(knowledgeError.message);
        }

        setKnowledgeItems((knowledgeData || []) as KnowledgeItem[]);

        const testConversationId = await createTestConversation(
          businessId,
          loadedProfile.id
        );

        setConversationId(testConversationId);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load test chat."
        );
      } finally {
        setIsLoadingPage(false);
      }
    }

    if (businessId) {
      loadBusinessData();
    }
  }, [businessId]);

  async function createTestConversation(
    activeBusinessId: string,
    userId: string
  ) {
    const testWhatsappNumber = `test-${activeBusinessId}-${userId}`;

    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .upsert(
        {
          business_id: activeBusinessId,
          whatsapp_number: testWhatsappNumber,
          phone: testWhatsappNumber,
          name: "Test Customer",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "business_id,whatsapp_number",
        }
      )
      .select("id")
      .single();

    if (customerError) {
      setErrorMessage(customerError.message);
      return "";
    }

    const { data: existingConversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("business_id", activeBusinessId)
      .eq("customer_id", customerData.id)
      .in("status", ["active", "needs_human_follow_up"])
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConversation?.id) {
      await supabase
        .from("conversations")
        .update({
          status: "active",
          handoff_required: false,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingConversation.id);

      return existingConversation.id;
    }

    const { data: conversationData, error: conversationError } = await supabase
      .from("conversations")
      .insert({
        business_id: activeBusinessId,
        customer_id: customerData.id,
        status: "active",
        handoff_required: false,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (conversationError) {
      setErrorMessage(conversationError.message);
      return "";
    }

    return conversationData.id;
  }

  async function saveChatMessage(
    activeConversationId: string,
    sender: "customer" | "ai",
    message: string
  ) {
    if (!activeConversationId) {
      return;
    }

    const role = sender === "customer" ? "customer" : "assistant";
    const direction = sender === "customer" ? "inbound" : "outbound";

    const { error } = await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      business_id: businessId,
      sender,
      role,
      content: message,
      message_text: message,
      message,
      direction,
      message_type: "text",
      metadata: {
        source: "test_chat",
      },
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await supabase
      .from("conversations")
      .update({
        status: "active",
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeConversationId);

    setSaveMessage("Conversation saved to Supabase.");
  }

  function createFallbackLead(allMessages: ChatMessage[]): LeadData {
    const conversationText = allMessages
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");

    return {
      customer_name: null,
      service_requested: null,
      budget: null,
      date_needed: null,
      location: null,
      notes: conversationText,
      status: "collecting_details",
    };
  }

  async function extractLeadWithFallback(
    allMessages: ChatMessage[]
  ): Promise<LeadData> {
    let lead = createFallbackLead(allMessages);

    try {
      const response = await fetch("/api/ai/extract-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: allMessages,
        }),
      });

      let result: { lead?: LeadData; error?: string; raw?: string } = {};

      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (response.ok && result.lead) {
        lead = {
          customer_name: result.lead.customer_name || null,
          service_requested: result.lead.service_requested || null,
          budget: result.lead.budget || null,
          date_needed: result.lead.date_needed || null,
          location: result.lead.location || null,
          notes: result.lead.notes || lead.notes,
          status: result.lead.status || "collecting_details",
        };
      } else {
        console.warn("Lead extraction fallback used:", result);
      }
    } catch (error) {
      console.warn("Lead extraction failed, fallback lead used:", error);
    }

    return lead;
  }

  async function extractAndSaveLead(
    activeConversationId: string,
    allMessages: ChatMessage[]
  ) {
    if (!business || !activeConversationId) {
      return;
    }

    const { data: conversationData, error: conversationError } = await supabase
      .from("conversations")
      .select("customer_id")
      .eq("id", activeConversationId)
      .eq("business_id", business.id)
      .single();

    if (conversationError) {
      setErrorMessage(conversationError.message);
      return;
    }

    const lead = await extractLeadWithFallback(allMessages);

    const { data: existingLead, error: existingLeadError } = await supabase
      .from("leads")
      .select("id")
      .eq("conversation_id", activeConversationId)
      .maybeSingle();

    if (existingLeadError) {
      setErrorMessage(existingLeadError.message);
      return;
    }

    const leadPayload = {
      business_id: business.id,
      customer_id: conversationData.customer_id,
      conversation_id: activeConversationId,
      customer_name: lead.customer_name || null,
      whatsapp_number: "test-customer",
      service_requested: lead.service_requested || null,
      budget: lead.budget || null,
      date_needed: lead.date_needed || null,
      location: lead.location || null,
      notes: lead.notes || null,
      status: lead.status || "collecting_details",
      updated_at: new Date().toISOString(),
    };

    if (existingLead?.id) {
      const { error } = await supabase
        .from("leads")
        .update(leadPayload)
        .eq("id", existingLead.id);

      if (error) {
        setErrorMessage(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("leads").insert(leadPayload);

      if (error) {
        setErrorMessage(error.message);
        return;
      }
    }

    setSaveMessage("Conversation and lead saved to Supabase.");
  }

  async function handleSendMessage() {
    setErrorMessage("");
    setSaveMessage("");

    if (!inputMessage.trim()) {
      return;
    }

    if (!business || !profile) {
      setErrorMessage("Business data is not loaded yet.");
      return;
    }

    let activeConversationId = conversationId;

    if (!activeConversationId) {
      activeConversationId = await createTestConversation(business.id, profile.id);
      setConversationId(activeConversationId);
    }

    if (!activeConversationId) {
      setErrorMessage("Could not create a conversation.");
      return;
    }

    const customerMessage = inputMessage.trim();

    const customerChatMessage: ChatMessage = {
      role: "customer",
      content: customerMessage,
    };

    const updatedMessages = [...messages, customerChatMessage];

    setMessages(updatedMessages);
    setInputMessage("");
    setIsReplying(true);

    await saveChatMessage(activeConversationId, "customer", customerMessage);

    try {
      const response = await fetch("/api/ai/test-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          business: {
            ...business,
            business_name: business.name,
            business_type: business.type,
            category: business.type,
          },
          knowledgeItems,
          messages: updatedMessages,
          customerMessage,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate AI reply.");
      }

      const assistantReply: ChatMessage = {
        role: "assistant",
        content:
          result.reply ||
          "Thanks for your message. I’ll help collect the details so the team can assist you properly.",
      };

      const finalMessages = [...updatedMessages, assistantReply];

      setMessages(finalMessages);

      await saveChatMessage(activeConversationId, "ai", assistantReply.content);
      await extractAndSaveLead(activeConversationId, finalMessages);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while generating the AI reply.";

      setErrorMessage(message);

      const fallbackReply =
        "Sorry, I could not generate a reply right now. Please check the setup and try again.";

      const fallbackAssistantMessage: ChatMessage = {
        role: "assistant",
        content: fallbackReply,
      };

      const finalMessages = [...updatedMessages, fallbackAssistantMessage];

      setMessages(finalMessages);

      await saveChatMessage(activeConversationId, "ai", fallbackReply);
      await extractAndSaveLead(activeConversationId, finalMessages);
    } finally {
      setIsReplying(false);
    }
  }

  if (isLoadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07131f] text-white">
        <div className="flex items-center gap-3 text-slate-300">
          <Loader2 size={20} className="animate-spin" />
          Loading test chat...
        </div>
      </main>
    );
  }

  if (errorMessage && !business) {
    return (
      <main className="min-h-screen bg-[#07131f] text-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href="/dashboard/businesses"
            className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to Businesses
          </Link>

          <div className="rounded-3xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200 shadow-xl">
            {errorMessage}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07131f] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/dashboard/businesses/${businessId}`}
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to Business
          </Link>

          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0d1b2a] px-4 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <Bot size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {getBusinessName(business)}
              </p>
              <p className="text-xs text-slate-500">AI test chat</p>
            </div>
          </div>
        </nav>

        <section className="mb-5 rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <MessageCircle size={24} />
          </div>

          <p className="mb-2 text-sm font-medium text-emerald-300">
            Assistant simulator
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
            Test how this business assistant responds.
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
            Test messages are saved to the database and can generate lead data
            for review in the leads and conversations dashboard.
          </p>
        </section>

        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {saveMessage ? (
          <div className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
            {saveMessage}
          </div>
        ) : null}

        <section className="grid flex-1 gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex min-h-[560px] flex-col rounded-3xl border border-white/10 bg-[#0d1b2a] shadow-xl">
            <div className="border-b border-white/10 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                  <Bot size={22} />
                </div>
                <div>
                  <p className="font-semibold text-white">
                    {getBusinessName(business)} Assistant
                  </p>
                  <p className="text-xs text-slate-500">
                    Testing mode, saved to database
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.map((message, index) => {
                const isAssistant = message.role === "assistant";

                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex gap-3 ${
                      isAssistant ? "justify-start" : "justify-end"
                    }`}
                  >
                    {isAssistant ? (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <Bot size={17} />
                      </div>
                    ) : null}

                    <div
                      className={`max-w-[82%] whitespace-pre-wrap rounded-3xl px-5 py-4 text-sm leading-6 ${
                        isAssistant
                          ? "rounded-tl-sm bg-[#122338] text-slate-200"
                          : "rounded-tr-sm bg-emerald-600 text-white"
                      }`}
                    >
                      {message.content}
                    </div>

                    {!isAssistant ? (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-slate-300">
                        <User size={17} />
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {isReplying ? (
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <Loader2 size={18} className="animate-spin" />
                  Assistant is replying...
                </div>
              ) : null}
            </div>

            <div className="border-t border-white/10 p-5">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(event) => setInputMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !isReplying) {
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a customer message..."
                  className="w-full rounded-full border border-white/10 bg-[#122338] px-5 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
                />

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isReplying}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isReplying ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
                <Sparkles size={18} className="text-emerald-300" />
                Test prompts
              </h2>

              <div className="space-y-2">
                {[
                  "My name is Samuel. I need 20 meat pies tomorrow in Abuja. My budget is 30k.",
                  "How much does it cost?",
                  "What services do you offer?",
                  "How can I book?",
                  "Where are you located?",
                  "What time do you open?",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInputMessage(prompt)}
                    className="w-full rounded-2xl border border-white/10 bg-[#122338] px-4 py-3 text-left text-sm text-slate-300 transition hover:border-emerald-400/30 hover:text-emerald-300"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
                <Database size={18} className="text-emerald-300" />
                Database status
              </h2>

              <p className="text-sm leading-6 text-slate-400">
                Conversation ID:
              </p>

              <p className="mt-2 break-all rounded-2xl border border-white/10 bg-[#122338] p-3 text-xs text-slate-400">
                {conversationId || "Not created yet"}
              </p>

              <Link
                href="/dashboard/conversations"
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-[#122338] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#162c45]"
              >
                View Conversations
              </Link>

              <Link
                href="/dashboard/leads"
                className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-[#122338] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#162c45]"
              >
                View Leads
              </Link>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
              <h2 className="mb-3 font-semibold text-white">
                Knowledge loaded
              </h2>

              <p className="text-sm leading-6 text-slate-400">
                {knowledgeItems.length} knowledge item
                {knowledgeItems.length === 1 ? "" : "s"} available for this
                assistant.
              </p>

              <Link
                href={`/dashboard/businesses/${businessId}/knowledge`}
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-[#122338] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#162c45]"
              >
                Edit Knowledge
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}