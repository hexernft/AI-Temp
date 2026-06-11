import { NextResponse } from "next/server";
import { generateBusinessReply } from "@/lib/ai";
import { sendInstagramText } from "@/lib/instagram";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type InstagramWebhookMessage = {
  mid?: string;
  text?: string;
  is_echo?: boolean;
  attachments?: unknown[];
};

type InstagramMessagingEvent = {
  sender?: {
    id?: string;
  };
  recipient?: {
    id?: string;
  };
  timestamp?: number;
  message?: InstagramWebhookMessage;
  postback?: {
    title?: string;
    payload?: string;
  };
};

type InstagramWebhookEntry = {
  id?: string;
  time?: number;
  messaging?: InstagramMessagingEvent[];
  changes?: Array<{
    field?: string;
    value?: {
      sender?: {
        id?: string;
      };
      recipient?: {
        id?: string;
      };
      message?: InstagramWebhookMessage;
      messages?: InstagramWebhookMessage[];
      timestamp?: number;
    };
  }>;
};

type InstagramWebhookBody = {
  object?: string;
  entry?: InstagramWebhookEntry[];
};

type InstagramAccountRecord = {
  id: string;
  business_id: string;
  instagram_business_account_id: string;
  page_id?: string | null;
  username?: string | null;
  access_token?: string | null;
  is_active?: boolean | null;
};

type AiSettings = {
  auto_reply_enabled: boolean;
  handoff_enabled: boolean;
  fallback_message: string;
};

type RecentMessageForAi = {
  sender_type?: string | null;
  role?: string | null;
  sender?: string | null;
  direction?: string | null;
  content?: string | null;
  body?: string | null;
  message?: string | null;
  text?: string | null;
  created_at?: string | null;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getWebhookTimestamp(timestamp?: number) {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return new Date().toISOString();
  }

  return new Date(timestamp).toISOString();
}

function extractCustomerNameFromMessage(message: string) {
  const text = cleanText(message);

  if (!text) return "";

  const patterns = [
    /\bmy name is\s+([a-zA-Z][a-zA-Z\s.'-]{1,40})/i,
    /\bi am\s+([a-zA-Z][a-zA-Z\s.'-]{1,40})/i,
    /\bi'm\s+([a-zA-Z][a-zA-Z\s.'-]{1,40})/i,
    /\bthis is\s+([a-zA-Z][a-zA-Z\s.'-]{1,40})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1]
        .replace(/[?.!,].*$/, "")
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .join(" ");
    }
  }

  return "";
}

function isNameQuestion(message: string) {
  const text = cleanText(message).toLowerCase();

  return (
    text.includes("what's my name") ||
    text.includes("what is my name") ||
    text.includes("do you know my name") ||
    text.includes("remember my name")
  );
}

function buildDirectMemoryReply({
  messageText,
  customerName,
  businessName,
}: {
  messageText: string;
  customerName?: string | null;
  businessName: string;
}) {
  const name = cleanText(customerName);

  if (isNameQuestion(messageText)) {
    if (name) return `Your name is ${name}.`;

    return `I do not have your name yet. Please share your name so ${businessName} can assist you properly.`;
  }

  return "";
}

function shouldHandoffToHuman(message: string) {
  const lower = message.toLowerCase();

  const handoffWords = [
    "human",
    "agent",
    "person",
    "representative",
    "manager",
    "complaint",
    "angry",
    "upset",
    "refund",
    "cancel",
    "wrong order",
    "bad service",
    "speak to someone",
    "talk to someone",
  ];

  return handoffWords.some((word) => lower.includes(word));
}

function getInstagramMessageText(event: InstagramMessagingEvent) {
  const messageText = cleanText(event.message?.text);

  if (messageText) return messageText;

  const postbackTitle = cleanText(event.postback?.title);
  const postbackPayload = cleanText(event.postback?.payload);

  return postbackTitle || postbackPayload;
}

function getInstagramExternalMessageId(event: InstagramMessagingEvent) {
  return cleanText(event.message?.mid) || null;
}

function getCustomerKey(senderId: string) {
  return `instagram:${senderId}`;
}

function normalizeInstagramEvents(body: InstagramWebhookBody) {
  const events: InstagramMessagingEvent[] = [];

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      events.push(event);
    }

    for (const change of entry.changes || []) {
      const value = change.value;

      if (!value) continue;

      const messages = value.messages?.length
        ? value.messages
        : value.message
          ? [value.message]
          : [];

      for (const message of messages) {
        events.push({
          sender: value.sender,
          recipient: value.recipient || { id: entry.id },
          timestamp: value.timestamp || entry.time,
          message,
        });
      }
    }
  }

  return events;
}

async function loadRecentMessagesForAi({
  supabaseAdmin,
  conversationId,
  businessId,
  limit = 20,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  conversationId: string;
  businessId?: string | null;
  limit?: number;
}) {
  let query = supabaseAdmin
    .from("messages")
    .select("sender_type, content, body, message, text, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to load recent Instagram messages for AI:", error.message);
    return [];
  }

  return ((data || []).reverse() as RecentMessageForAi[]);
}

async function findInstagramAccount({
  recipientId,
}: {
  recipientId: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: account, error } = await supabaseAdmin
    .from("business_instagram_accounts")
    .select(
      "id, business_id, instagram_business_account_id, page_id, username, access_token, is_active"
    )
    .or(
      `instagram_business_account_id.eq.${recipientId},page_id.eq.${recipientId}`
    )
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to find Instagram account:", error.message);
    return null;
  }

  return account as InstagramAccountRecord | null;
}

async function saveAiMessage({
  supabaseAdmin,
  conversationId,
  businessId,
  customerId,
  content,
  externalMessageId,
  instagramAccount,
  recipientId,
  instagramResponse,
  source,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  conversationId: string;
  businessId: string;
  customerId: string;
  content: string;
  externalMessageId: string | null;
  instagramAccount: InstagramAccountRecord;
  recipientId: string;
  instagramResponse: unknown;
  source: string;
}) {
  const now = new Date().toISOString();

  await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    business_id: businessId,
    customer_id: customerId,
    sender_type: "ai",
    message_type: "text",
    content,
    body: content,
    external_message_id: externalMessageId,
    status: "sent",
    metadata: {
      source,
      platform: "instagram",
      instagram_account_id: instagramAccount.id,
      instagram_business_account_id: instagramAccount.instagram_business_account_id,
      instagram_recipient_id: recipientId,
      instagram_response: instagramResponse,
    },
    created_at: now,
  });

  await supabaseAdmin
    .from("conversations")
    .update({
      last_message_at: now,
      updated_at: now,
    })
    .eq("id", conversationId)
    .eq("business_id", businessId);
}

async function processInstagramEvent(event: InstagramMessagingEvent) {
  if (event.message?.is_echo) return true;

  const senderId = cleanText(event.sender?.id);
  const recipientId = cleanText(event.recipient?.id);

  if (!senderId || !recipientId) return true;

  const messageText = getInstagramMessageText(event);

  if (!messageText) {
    console.log("Skipping unsupported Instagram message:", event);
    return true;
  }

  const instagramAccount = await findInstagramAccount({ recipientId });

  if (!instagramAccount) {
    console.log("No active Instagram account mapping found for recipient:", recipientId);
    return false;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const businessId = instagramAccount.business_id;

  await supabaseAdmin
    .from("business_instagram_accounts")
    .update({
      last_webhook_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", instagramAccount.id);

  const { data: business, error: businessError } = await supabaseAdmin
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .single();

  if (businessError || !business) {
    console.error("Business not found for Instagram account:", businessError?.message);
    return true;
  }

  const externalMessageId = getInstagramExternalMessageId(event);

  if (externalMessageId) {
    const { data: existingMessage } = await supabaseAdmin
      .from("messages")
      .select("id")
      .eq("external_message_id", externalMessageId)
      .maybeSingle();

    if (existingMessage) return true;
  }

  const { data: aiSettingsRow } = await supabaseAdmin
    .from("business_ai_settings")
    .select("auto_reply_enabled, handoff_enabled, fallback_message")
    .eq("business_id", businessId)
    .maybeSingle();

  const defaultFallback = `Hello, this is ${business.name} AI sales assistant. I have received your Instagram message. Would you like to place an order or book an appointment?`;

  const aiSettings: AiSettings = {
    auto_reply_enabled: aiSettingsRow?.auto_reply_enabled ?? true,
    handoff_enabled: aiSettingsRow?.handoff_enabled ?? true,
    fallback_message: aiSettingsRow?.fallback_message || defaultFallback,
  };

  const customerKey = getCustomerKey(senderId);
  const nameFromMessage = extractCustomerNameFromMessage(messageText);

  const { data: existingCustomer } = await supabaseAdmin
    .from("customers")
    .select("id, business_id, phone, name, metadata")
    .eq("business_id", businessId)
    .eq("phone", customerKey)
    .maybeSingle();

  const customerNameToSave =
    nameFromMessage || existingCustomer?.name || "Instagram customer";

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .upsert(
      {
        business_id: businessId,
        phone: customerKey,
        name: customerNameToSave,
        metadata: {
          ...(typeof existingCustomer?.metadata === "object" &&
          existingCustomer.metadata !== null
            ? existingCustomer.metadata
            : {}),
          platform: "instagram",
          instagram_sender_id: senderId,
          instagram_business_account_id:
            instagramAccount.instagram_business_account_id,
          instagram_account_id: instagramAccount.id,
          instagram_username: instagramAccount.username || null,
        },
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "business_id,phone",
      }
    )
    .select("id, business_id, phone, name")
    .single();

  if (customerError || !customer) {
    console.error("Failed to upsert Instagram customer:", customerError?.message);
    return true;
  }

  const { data: existingConversation } = await supabaseAdmin
    .from("conversations")
    .select("id, handoff_required, status")
    .eq("business_id", businessId)
    .eq("customer_id", customer.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const messageCreatedAt = getWebhookTimestamp(event.timestamp);
  let conversationId = existingConversation?.id;
  let handoffRequired = existingConversation?.handoff_required || false;

  if (!conversationId) {
    const { data: newConversation, error: conversationError } =
      await supabaseAdmin
        .from("conversations")
        .insert({
          business_id: businessId,
          customer_id: customer.id,
          status: "open",
          handoff_required: false,
          last_message_at: messageCreatedAt,
          created_at: messageCreatedAt,
          updated_at: messageCreatedAt,
        })
        .select("id, handoff_required")
        .single();

    if (conversationError || !newConversation) {
      console.error("Failed to create Instagram conversation:", conversationError?.message);
      return true;
    }

    conversationId = newConversation.id;
    handoffRequired = false;
  }

  const needsHuman =
    aiSettings.handoff_enabled && shouldHandoffToHuman(messageText);

  const { error: messageError } = await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    business_id: businessId,
    customer_id: customer.id,
    sender_type: "customer",
    message_type: "text",
    content: messageText,
    body: messageText,
    external_message_id: externalMessageId,
    status: "received",
    metadata: {
      source: "instagram_webhook",
      platform: "instagram",
      workspace_type: "business",
      instagram_account_id: instagramAccount.id,
      instagram_business_account_id:
        instagramAccount.instagram_business_account_id,
      instagram_sender_id: senderId,
      instagram_recipient_id: recipientId,
      raw_message: event,
    },
    created_at: messageCreatedAt,
  });

  if (messageError) {
    console.error("Failed to save incoming Instagram message:", messageError.message);
    return true;
  }

  await supabaseAdmin
    .from("conversations")
    .update({
      status: "open",
      last_message_at: messageCreatedAt,
      handoff_required: needsHuman || handoffRequired,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("business_id", businessId);

  if (!aiSettings.auto_reply_enabled) return true;

  if (needsHuman) {
    const fallbackNow = new Date().toISOString();
    let fallbackInstagramResponse: Awaited<
      ReturnType<typeof sendInstagramText>
    > | null = null;

    try {
      fallbackInstagramResponse = await sendInstagramText({
        recipientId: senderId,
        message: aiSettings.fallback_message || defaultFallback,
        instagramBusinessAccountId:
          instagramAccount.instagram_business_account_id,
        accessToken: instagramAccount.access_token,
      });
    } catch (sendFallbackError) {
      console.error("Failed to send fallback Instagram reply:", sendFallbackError);
      return true;
    }

    await supabaseAdmin.from("messages").insert({
      conversation_id: conversationId,
      business_id: businessId,
      customer_id: customer.id,
      sender_type: "ai",
      message_type: "text",
      content: aiSettings.fallback_message || defaultFallback,
      body: aiSettings.fallback_message || defaultFallback,
      external_message_id: fallbackInstagramResponse.message_id || null,
      status: "sent",
      metadata: {
        source: "instagram_handoff_fallback_reply",
        platform: "instagram",
        instagram_account_id: instagramAccount.id,
        instagram_business_account_id:
          instagramAccount.instagram_business_account_id,
        instagram_recipient_id: senderId,
        instagram_response: fallbackInstagramResponse,
      },
      created_at: fallbackNow,
    });

    await supabaseAdmin
      .from("conversations")
      .update({
        last_message_at: fallbackNow,
        handoff_required: true,
        updated_at: fallbackNow,
      })
      .eq("id", conversationId)
      .eq("business_id", businessId);

    return true;
  }

  if (handoffRequired) {
    console.log("Skipping Instagram AI reply because chat is in handoff mode:", {
      conversationId,
      businessId,
      customerId: customer.id,
    });

    return true;
  }

  const directMemoryReply = buildDirectMemoryReply({
    messageText,
    customerName: customer.name,
    businessName: business.name,
  });

  if (directMemoryReply) {
    try {
      const instagramResponse = await sendInstagramText({
        recipientId: senderId,
        message: directMemoryReply,
        instagramBusinessAccountId:
          instagramAccount.instagram_business_account_id,
        accessToken: instagramAccount.access_token,
      });

      await saveAiMessage({
        supabaseAdmin,
        conversationId,
        businessId,
        customerId: customer.id,
        content: directMemoryReply,
        externalMessageId: instagramResponse.message_id || null,
        instagramAccount,
        recipientId: senderId,
        instagramResponse,
        source: "instagram_direct_memory_reply",
      });
    } catch (directMemoryError) {
      console.error("Failed to send Instagram direct memory reply:", directMemoryError);
    }

    return true;
  }

  const recentMessages = await loadRecentMessagesForAi({
    supabaseAdmin,
    conversationId,
    businessId,
    limit: 20,
  });

  const { data: knowledgeRows } = await supabaseAdmin
    .from("business_knowledge")
    .select("title, content")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const businessKnowledge = (knowledgeRows || [])
    .map((item) => `${item.title}: ${item.content}`)
    .join("\n\n");

  let aiReply = aiSettings.fallback_message || defaultFallback;

  try {
    const generatedReply = await generateBusinessReply({
      businessName: business.name,
      customerName: customer.name,
      customerMessage: messageText,
      businessKnowledge,
      recentMessages,
      assistantMode: "sales",
    });

    aiReply =
      typeof generatedReply === "string" && generatedReply.trim()
        ? generatedReply.trim()
        : aiSettings.fallback_message || defaultFallback;
  } catch (aiError) {
    console.error("Failed to generate Instagram AI reply:", aiError);
    aiReply = defaultFallback;
  }

  let instagramResponse: Awaited<ReturnType<typeof sendInstagramText>> | null =
    null;

  try {
    instagramResponse = await sendInstagramText({
      recipientId: senderId,
      message: aiReply,
      instagramBusinessAccountId: instagramAccount.instagram_business_account_id,
      accessToken: instagramAccount.access_token,
    });
  } catch (sendError) {
    console.error("Failed to send Instagram AI reply:", sendError);

    await supabaseAdmin
      .from("conversations")
      .update({
        handoff_required: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .eq("business_id", businessId);

    return true;
  }

  await saveAiMessage({
    supabaseAdmin,
    conversationId,
    businessId,
    customerId: customer.id,
    content: aiReply,
    externalMessageId: instagramResponse.message_id || null,
    instagramAccount,
    recipientId: senderId,
    instagramResponse,
    source: "instagram_ai_auto_reply",
  });

  return true;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken =
    process.env.INSTAGRAM_VERIFY_TOKEN ||
    process.env.META_INSTAGRAM_VERIFY_TOKEN ||
    process.env.WEBHOOK_VERIFY_TOKEN ||
    "";

  if (mode === "subscribe" && token && token === verifyToken) {
    return new Response(challenge || "", { status: 200 });
  }

  return NextResponse.json(
    { error: "Instagram webhook verification failed." },
    { status: 403 }
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as InstagramWebhookBody;
    const events = normalizeInstagramEvents(body);

    if (!events.length) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    for (const event of events) {
      await processInstagramEvent(event);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Instagram webhook error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Instagram webhook processing failed.",
      },
      { status: 500 }
    );
  }
}
