import { NextResponse } from "next/server";
import { generateBusinessReply } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { runSalesController } from "@/lib/salesController";
import type { ProductCatalogItem } from "@/lib/orderState";

type WhatsAppWebhookMessage = {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: {
    body?: string;
  };
};

type WhatsAppWebhookStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
};

type WhatsAppWebhookContact = {
  profile?: {
    name?: string;
  };
  wa_id?: string;
};

type WhatsAppWebhookValue = {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: WhatsAppWebhookContact[];
  messages?: WhatsAppWebhookMessage[];
  statuses?: WhatsAppWebhookStatus[];
};

type WhatsAppWebhookEntry = {
  id?: string;
  changes?: Array<{
    value?: WhatsAppWebhookValue;
    field?: string;
  }>;
};

type WhatsAppWebhookBody = {
  object?: string;
  entry?: WhatsAppWebhookEntry[];
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

function normalizePhoneNumber(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
    if (name) {
      return `Your name is ${name}.`;
    }

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

function getMessageText(message: WhatsAppWebhookMessage) {
  if (message.type === "text") {
    return message.text?.body?.trim() || "";
  }

  return "";
}

function getWebhookTimestamp(timestamp?: string) {
  if (!timestamp) return new Date().toISOString();

  const numberValue = Number(timestamp);

  if (!Number.isFinite(numberValue)) {
    return new Date().toISOString();
  }

  return new Date(numberValue * 1000).toISOString();
}

type WebhookEventStatus =
  | "received"
  | "processing"
  | "handled"
  | "skipped"
  | "failed";

type WebhookEventPatch = {
  business_id?: string | null;
  school_id?: string | null;
  conversation_id?: string | null;
  customer_id?: string | null;
  status?: WebhookEventStatus;
  stage?: string | null;
  error_message?: string | null;
  phone_number_id?: string | null;
  display_phone_number?: string | null;
  sender_phone?: string | null;
  message_id?: string | null;
  message_type?: string | null;
  message_text?: string | null;
  raw_payload?: unknown;
};

function createWebhookEventId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `webhook_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function truncateForLog(value: string, maxLength = 1200) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

async function insertWebhookEvent(event: WebhookEventPatch & { id?: string }) {
  const supabaseAdmin = getSupabaseAdmin();
  const id = event.id || createWebhookEventId();

  const { error } = await supabaseAdmin.from("webhook_events").insert({
    id,
    channel: "whatsapp",
    direction: "inbound",
    method: "POST",
    event_type: "message",
    business_id: event.business_id || null,
    school_id: event.school_id || null,
    conversation_id: event.conversation_id || null,
    customer_id: event.customer_id || null,
    status: event.status || "received",
    stage: event.stage || "received",
    error_message: event.error_message || null,
    phone_number_id: event.phone_number_id || null,
    display_phone_number: event.display_phone_number || null,
    sender_phone: event.sender_phone || null,
    message_id: event.message_id || null,
    message_type: event.message_type || null,
    message_text: event.message_text
      ? truncateForLog(event.message_text, 1200)
      : null,
    raw_payload: event.raw_payload || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to insert webhook debug event:", error.message);
  }

  return id;
}

async function updateWebhookEvent(
  id: string | undefined,
  patch: WebhookEventPatch,
) {
  if (!id) return;

  const supabaseAdmin = getSupabaseAdmin();

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      updatePayload[key] = value;
    }
  }

  const { error } = await supabaseAdmin
    .from("webhook_events")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    console.error("Failed to update webhook debug event:", error.message);
  }
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
    console.error("Failed to load recent messages for AI:", error.message);
    return [];
  }

  return (data || []).reverse() as RecentMessageForAi[];
}

async function updateMessageStatuses(
  statuses: WhatsAppWebhookStatus[] | undefined,
) {
  if (!statuses?.length) return;

  const supabaseAdmin = getSupabaseAdmin();

  for (const statusItem of statuses) {
    if (!statusItem.id || !statusItem.status) continue;

    await supabaseAdmin
      .from("messages")
      .update({
        status: statusItem.status,
        metadata: {
          source: "whatsapp_status_webhook",
          status_payload: statusItem,
        },
      })
      .eq("external_message_id", statusItem.id);
  }
}

async function saveAiMessage({
  supabaseAdmin,
  conversationId,
  businessId,
  customerId,
  content,
  externalMessageId,
  phoneNumberId,
  source,
  whatsappResponse,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  conversationId: string;
  businessId: string;
  customerId: string;
  content: string;
  externalMessageId: string | null;
  phoneNumberId: string;
  source: string;
  whatsappResponse: unknown;
}) {
  const now = new Date().toISOString();

  await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    business_id: businessId,
    customer_id: customerId,
    sender: "ai",
    sender_type: "ai",
    message_type: "text",
    content,
    body: content,
    external_message_id: externalMessageId,
    status: "sent",
    metadata: {
      source,
      phone_number_id: phoneNumberId,
      whatsapp_response: whatsappResponse,
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

async function processBusinessMessage({
  phoneNumberId,
  value,
  incomingMessage,
  debugEventId,
}: {
  phoneNumberId: string;
  value: WhatsAppWebhookValue;
  incomingMessage: WhatsAppWebhookMessage;
  debugEventId?: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  await updateWebhookEvent(debugEventId, {
    status: "processing",
    stage: "business_phone_lookup_started",
  });

  const { data: businessPhone, error: businessPhoneError } = await supabaseAdmin
    .from("business_phone_numbers")
    .select(
      `
        id,
        business_id,
        phone_number,
        phone_number_id,
        display_phone_number,
        verified_name,
        provider,
        access_token,
        is_active
      `,
    )
    .eq("phone_number_id", phoneNumberId)
    .eq("is_active", true)
    .maybeSingle();

  if (businessPhoneError || !businessPhone) {
    await updateWebhookEvent(debugEventId, {
      status: "skipped",
      stage: "no_active_business_phone_match",
      error_message:
        businessPhoneError?.message ||
        `No active business phone row found for phone_number_id ${phoneNumberId}`,
      phone_number_id: phoneNumberId,
    });

    return false;
  }

  const businessId = businessPhone.business_id;

  await updateWebhookEvent(debugEventId, {
    business_id: businessId,
    status: "processing",
    stage: "business_phone_matched",
  });

  await supabaseAdmin
    .from("business_phone_numbers")
    .update({
      last_webhook_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessPhone.id);

  const { data: business, error: businessError } = await supabaseAdmin
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .single();

  if (businessError || !business) {
    console.error("Business not found:", businessError?.message);
    await updateWebhookEvent(debugEventId, {
      business_id: businessId,
      status: "failed",
      stage: "business_lookup_failed",
      error_message: businessError?.message || "Business row not found.",
    });

    return true;
  }

  const customerPhone = incomingMessage.from
    ? normalizePhoneNumber(incomingMessage.from)
    : "";

  if (!customerPhone) {
    await updateWebhookEvent(debugEventId, {
      status: "skipped",
      stage: "missing_customer_phone",
      error_message:
        "Incoming WhatsApp message did not include a sender phone number.",
    });

    return true;
  }

  const whatsappProfileName =
    value.contacts?.find((contact) => contact.wa_id === incomingMessage.from)
      ?.profile?.name || null;

  const messageText = getMessageText(incomingMessage);

  if (!messageText) {
    console.log("Skipping unsupported business message type:", {
      type: incomingMessage.type,
      messageId: incomingMessage.id,
    });
    await updateWebhookEvent(debugEventId, {
      business_id: businessId,
      status: "skipped",
      stage: "unsupported_business_message_type",
      error_message: `Unsupported message type: ${incomingMessage.type || "unknown"}`,
    });

    return true;
  }

  const nameFromMessage = extractCustomerNameFromMessage(messageText);
  const externalMessageId = incomingMessage.id || null;
  const messageCreatedAt = getWebhookTimestamp(incomingMessage.timestamp);

  if (externalMessageId) {
    const { data: existingMessage } = await supabaseAdmin
      .from("messages")
      .select("id")
      .eq("external_message_id", externalMessageId)
      .maybeSingle();

    if (existingMessage) {
      await updateWebhookEvent(debugEventId, {
        business_id: businessId,
        status: "skipped",
        stage: "duplicate_external_message_id",
        error_message: `Message ${externalMessageId} already exists.`,
      });

      return true;
    }
  }

  const { data: aiSettingsRow } = await supabaseAdmin
    .from("business_ai_settings")
    .select("auto_reply_enabled, handoff_enabled, fallback_message")
    .eq("business_id", businessId)
    .maybeSingle();

  const defaultFallback = `Hello, this is ${business.name} AI sales assistant. I have received your message. Would you like to place an order or book an appointment?`;

  const aiSettings: AiSettings = {
    auto_reply_enabled: aiSettingsRow?.auto_reply_enabled ?? true,
    handoff_enabled: aiSettingsRow?.handoff_enabled ?? true,
    fallback_message: aiSettingsRow?.fallback_message || defaultFallback,
  };

  const { data: existingCustomer, error: existingCustomerError } =
    await supabaseAdmin
      .from("customers")
      .select("id, business_id, phone, name")
      .eq("business_id", businessId)
      .eq("phone", customerPhone)
      .maybeSingle();

  if (existingCustomerError) {
    console.error("Failed to look up customer:", existingCustomerError.message);
    await updateWebhookEvent(debugEventId, {
      business_id: businessId,
      status: "failed",
      stage: "customer_lookup_failed",
      error_message: existingCustomerError.message,
    });

    return true;
  }

  const customerNameToSave =
    nameFromMessage || existingCustomer?.name || whatsappProfileName || null;

  let customer:
    | {
        id: string;
        business_id: string;
        phone: string;
        name: string | null;
      }
    | null = null;

  if (existingCustomer?.id) {
    const { data: updatedCustomer, error: updateCustomerError } =
      await supabaseAdmin
        .from("customers")
        .update({
          name: customerNameToSave,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingCustomer.id)
        .select("id, business_id, phone, name")
        .single();

    if (updateCustomerError || !updatedCustomer) {
      console.error("Failed to update customer:", updateCustomerError?.message);
      await updateWebhookEvent(debugEventId, {
        business_id: businessId,
        status: "failed",
        stage: "customer_update_failed",
        error_message:
          updateCustomerError?.message || "Customer update returned no row.",
      });

      return true;
    }

    customer = updatedCustomer;
  } else {
    const { data: insertedCustomer, error: insertCustomerError } =
      await supabaseAdmin
        .from("customers")
        .insert({
          business_id: businessId,
          phone: customerPhone,
          name: customerNameToSave,
          updated_at: new Date().toISOString(),
        })
        .select("id, business_id, phone, name")
        .single();

    if (insertCustomerError || !insertedCustomer) {
      console.error("Failed to insert customer:", insertCustomerError?.message);
      await updateWebhookEvent(debugEventId, {
        business_id: businessId,
        status: "failed",
        stage: "customer_insert_failed",
        error_message:
          insertCustomerError?.message || "Customer insert returned no row.",
      });

      return true;
    }

    customer = insertedCustomer;
  }

  await updateWebhookEvent(debugEventId, {
    business_id: businessId,
    customer_id: customer.id,
    status: "processing",
    stage: "customer_saved",
  });

  const { data: existingConversation } = await supabaseAdmin
    .from("conversations")
    .select("id, handoff_required, status")
    .eq("business_id", businessId)
    .eq("customer_id", customer.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
      console.error(
        "Failed to create conversation:",
        conversationError?.message,
      );
      await updateWebhookEvent(debugEventId, {
        business_id: businessId,
        customer_id: customer.id,
        status: "failed",
        stage: "conversation_create_failed",
        error_message:
          conversationError?.message || "Conversation insert returned no row.",
      });

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
    sender: "customer",
    sender_type: "customer",
    message_type: incomingMessage.type || "text",
    content: messageText,
    body: messageText,
    external_message_id: externalMessageId,
    status: "received",
    metadata: {
      source: "whatsapp_webhook",
      workspace_type: "business",
      routed_by_phone_number_id: phoneNumberId,
      business_phone_number_id: businessPhone.id,
      display_phone_number: value.metadata?.display_phone_number || null,
      raw_message: incomingMessage,
    },
    created_at: messageCreatedAt,
  });

  if (messageError) {
    console.error("Failed to save incoming message:", messageError.message);
    await updateWebhookEvent(debugEventId, {
      business_id: businessId,
      customer_id: customer.id,
      conversation_id: conversationId,
      status: "failed",
      stage: "incoming_message_insert_failed",
      error_message: messageError.message,
    });

    return true;
  }

  await updateWebhookEvent(debugEventId, {
    business_id: businessId,
    customer_id: customer.id,
    conversation_id: conversationId,
    status: "processing",
    stage: "incoming_message_saved",
  });

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

  if (!aiSettings.auto_reply_enabled) {
    await updateWebhookEvent(debugEventId, {
      business_id: businessId,
      customer_id: customer.id,
      conversation_id: conversationId,
      status: "handled",
      stage: "auto_reply_disabled_message_saved_only",
    });

    return true;
  }

  if (needsHuman) {
    const fallbackNow = new Date().toISOString();

    let fallbackWhatsappResponse: Awaited<
      ReturnType<typeof sendWhatsAppText>
    > | null = null;

    try {
      fallbackWhatsappResponse = await sendWhatsAppText({
        to: customer.phone,
        message: aiSettings.fallback_message || defaultFallback,
        phoneNumberId,
        accessToken: cleanText(businessPhone.access_token) || null,
      });
    } catch (sendFallbackError) {
      console.error(
        "Failed to send fallback WhatsApp reply:",
        sendFallbackError,
      );
      await updateWebhookEvent(debugEventId, {
        business_id: businessId,
        customer_id: customer.id,
        conversation_id: conversationId,
        status: "failed",
        stage: "handoff_fallback_send_failed",
        error_message:
          sendFallbackError instanceof Error
            ? sendFallbackError.message
            : "Failed to send handoff fallback WhatsApp reply.",
      });

      return true;
    }

    const fallbackWhatsappMessageId =
      fallbackWhatsappResponse.messages?.[0]?.id || null;

    await supabaseAdmin.from("messages").insert({
      conversation_id: conversationId,
      business_id: businessId,
      customer_id: customer.id,
    sender: "ai",
    sender_type: "ai",
      message_type: "text",
      content: aiSettings.fallback_message || defaultFallback,
      body: aiSettings.fallback_message || defaultFallback,
      external_message_id: fallbackWhatsappMessageId,
      status: "sent",
      metadata: {
        source: "handoff_fallback_reply",
        phone_number_id: phoneNumberId,
        whatsapp_response: fallbackWhatsappResponse,
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

    await updateWebhookEvent(debugEventId, {
      business_id: businessId,
      customer_id: customer.id,
      conversation_id: conversationId,
      status: "handled",
      stage: "handoff_fallback_sent",
    });

    return true;
  }

  if (handoffRequired) {
    console.log("Skipping AI reply because chat is in handoff mode:", {
      conversationId,
      businessId,
      customerId: customer.id,
    });

    await updateWebhookEvent(debugEventId, {
      business_id: businessId,
      customer_id: customer.id,
      conversation_id: conversationId,
      status: "handled",
      stage: "handoff_mode_ai_skipped",
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
      const whatsappResponse = await sendWhatsAppText({
        to: customer.phone,
        message: directMemoryReply,
        phoneNumberId,
        accessToken: cleanText(businessPhone.access_token) || null,
      });

      const whatsappMessageId = whatsappResponse.messages?.[0]?.id || null;

      await saveAiMessage({
        supabaseAdmin,
        conversationId,
        businessId,
        customerId: customer.id,
        content: directMemoryReply,
        externalMessageId: whatsappMessageId,
        phoneNumberId,
        source: "direct_memory_reply",
        whatsappResponse,
      });
    } catch (directMemoryError) {
      console.error("Failed to send direct memory reply:", directMemoryError);
      await updateWebhookEvent(debugEventId, {
        business_id: businessId,
        customer_id: customer.id,
        conversation_id: conversationId,
        status: "failed",
        stage: "direct_memory_reply_failed",
        error_message:
          directMemoryError instanceof Error
            ? directMemoryError.message
            : "Failed to send direct memory reply.",
      });
    }

    await updateWebhookEvent(debugEventId, {
      business_id: businessId,
      customer_id: customer.id,
      conversation_id: conversationId,
      status: "handled",
      stage: "direct_memory_reply_sent",
    });

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
    .select("title, content, category")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const businessKnowledge = (knowledgeRows || [])
    .map((item) => `${item.title}: ${item.content}`)
    .join("\n\n");

  const { data: productRows, error: productRowsError } = await supabaseAdmin
    .from("business_products")
    .select("id, name, category, price, currency, availability, description, is_active")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (productRowsError) {
    console.error("Failed to load business products:", productRowsError.message);
    await updateWebhookEvent(debugEventId, {
      business_id: businessId,
      customer_id: customer.id,
      conversation_id: conversationId,
      status: "failed",
      stage: "business_products_lookup_failed",
      error_message: productRowsError.message,
    });

    return true;
  }

  const productCatalog: ProductCatalogItem[] = (productRows || []).map((product) => ({
    id: product.id || null,
    name: product.name,
    category: product.category || null,
    price:
      typeof product.price === "number"
        ? product.price
        : product.price === null || product.price === undefined
          ? null
          : Number(product.price),
    currency: product.currency || "NGN",
    availability: product.availability || "Available",
    description: product.description || null,
  }));

  let salesControllerResult:
    | Awaited<ReturnType<typeof runSalesController>>
    | null = null;

  try {
    salesControllerResult = await runSalesController({
      supabaseAdmin,
      businessId,
      customerId: customer.id,
      conversationId,
      customerName: customer.name,
      customerMessage: messageText,
      businessKnowledge,
      recentMessages,
      productCatalog,
    });

    await updateWebhookEvent(debugEventId, {
      business_id: businessId,
      customer_id: customer.id,
      conversation_id: conversationId,
      status: "processing",
      stage: `sales_controller_${salesControllerResult.stage}`,
      error_message: null,
    });
  } catch (salesControllerError) {
    console.error("Sales controller failed:", salesControllerError);

    await updateWebhookEvent(debugEventId, {
      business_id: businessId,
      customer_id: customer.id,
      conversation_id: conversationId,
      status: "processing",
      stage: "sales_controller_failed_using_ai",
      error_message:
        salesControllerError instanceof Error
          ? salesControllerError.message
          : "Sales controller failed. Falling back to AI reply.",
    });
  }

  if (salesControllerResult?.handled && salesControllerResult.directReply) {
    let salesWhatsappResponse: Awaited<ReturnType<typeof sendWhatsAppText>> | null = null;

    try {
      salesWhatsappResponse = await sendWhatsAppText({
        to: customer.phone,
        message: salesControllerResult.directReply,
        phoneNumberId,
        accessToken: cleanText(businessPhone.access_token) || null,
      });
    } catch (sendSalesControllerError) {
      console.error("Failed to send sales controller WhatsApp reply:", sendSalesControllerError);
      await updateWebhookEvent(debugEventId, {
        business_id: businessId,
        customer_id: customer.id,
        conversation_id: conversationId,
        status: "failed",
        stage: "sales_controller_reply_send_failed",
        error_message:
          sendSalesControllerError instanceof Error
            ? sendSalesControllerError.message
            : "Failed to send sales controller WhatsApp reply.",
      });

      return true;
    }

    const salesWhatsappMessageId = salesWhatsappResponse.messages?.[0]?.id || null;

    await saveAiMessage({
      supabaseAdmin,
      conversationId,
      businessId,
      customerId: customer.id,
      content: salesControllerResult.directReply,
      externalMessageId: salesWhatsappMessageId,
      phoneNumberId,
      source: "sales_controller_auto_reply",
      whatsappResponse: salesWhatsappResponse,
    });

    await updateWebhookEvent(debugEventId, {
      business_id: businessId,
      customer_id: customer.id,
      conversation_id: conversationId,
      status: "handled",
      stage: "sales_controller_reply_sent",
    });

    return true;
  }

  let aiReply = aiSettings.fallback_message || defaultFallback;

  try {
    const generatedReply = await generateBusinessReply({
      businessName: business.name,
      customerName: customer.name,
      customerMessage: messageText,
      businessKnowledge,
      recentMessages,
      assistantMode: "sales",
      orderStateContext: salesControllerResult?.orderStateContext || null,
    });

    aiReply =
      typeof generatedReply === "string" && generatedReply.trim()
        ? generatedReply.trim()
        : aiSettings.fallback_message || defaultFallback;
  } catch (aiError) {
    console.error("Failed to generate business AI reply:", aiError);

    aiReply = defaultFallback;
  }

  let whatsappResponse: Awaited<ReturnType<typeof sendWhatsAppText>> | null =
    null;

  try {
    whatsappResponse = await sendWhatsAppText({
      to: customer.phone,
      message: aiReply,
      phoneNumberId,
      accessToken: cleanText(businessPhone.access_token) || null,
    });
  } catch (sendError) {
    console.error("Failed to send business AI WhatsApp reply:", sendError);
    await updateWebhookEvent(debugEventId, {
      business_id: businessId,
      customer_id: customer.id,
      conversation_id: conversationId,
      status: "failed",
      stage: "ai_reply_send_failed",
      error_message:
        sendError instanceof Error
          ? sendError.message
          : "Failed to send business AI WhatsApp reply.",
    });

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

  const whatsappMessageId = whatsappResponse.messages?.[0]?.id || null;

  await saveAiMessage({
    supabaseAdmin,
    conversationId,
    businessId,
    customerId: customer.id,
    content: aiReply,
    externalMessageId: whatsappMessageId,
    phoneNumberId,
    source: "ai_auto_reply",
    whatsappResponse,
  });

  await updateWebhookEvent(debugEventId, {
    business_id: businessId,
    customer_id: customer.id,
    conversation_id: conversationId,
    status: "handled",
    stage: "ai_reply_sent",
  });

  return true;
}

async function processSchoolMessage({
  phoneNumberId,
  incomingMessage,
  debugEventId,
}: {
  phoneNumberId: string;
  incomingMessage: WhatsAppWebhookMessage;
  debugEventId?: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: schoolPhone, error: schoolPhoneError } = await supabaseAdmin
    .from("school_phone_numbers")
    .select(
      `
      id,
      school_id,
      phone_number,
      phone_number_id,
      display_phone_number,
      verified_name,
      provider,
      is_active
    `,
    )
    .eq("phone_number_id", phoneNumberId)
    .eq("is_active", true)
    .maybeSingle();

  if (schoolPhoneError || !schoolPhone) {
    await updateWebhookEvent(debugEventId, {
      status: "skipped",
      stage: "no_active_school_phone_match",
      error_message:
        schoolPhoneError?.message ||
        `No active school phone row found for phone_number_id ${phoneNumberId}`,
      phone_number_id: phoneNumberId,
    });

    return false;
  }

  const schoolId = schoolPhone.school_id;

  await updateWebhookEvent(debugEventId, {
    school_id: schoolId,
    status: "processing",
    stage: "school_phone_matched",
  });

  const { data: school, error: schoolError } = await supabaseAdmin
    .from("schools")
    .select(
      `
      id,
      name,
      type,
      description,
      phone,
      whatsapp,
      email,
      location
    `,
    )
    .eq("id", schoolId)
    .single();

  if (schoolError || !school) {
    console.error("School not found:", schoolError?.message);
    return true;
  }

  const senderPhone = incomingMessage.from
    ? normalizePhoneNumber(incomingMessage.from)
    : "";

  if (!senderPhone) return true;

  const messageText = getMessageText(incomingMessage);

  if (!messageText) {
    await sendWhatsAppText({
      to: senderPhone,
      message:
        "Thanks for your message. This school assistant currently supports text questions only.",
      phoneNumberId,
    });

    return true;
  }

  const { data: guardians, error: guardiansError } = await supabaseAdmin
    .from("pupil_guardians")
    .select(
      `
      id,
      school_id,
      pupil_id,
      guardian_name,
      relationship,
      phone,
      slot_number,
      is_active
    `,
    )
    .eq("school_id", schoolId)
    .eq("phone", senderPhone)
    .eq("is_active", true);

  if (guardiansError) {
    console.error("Failed to check pupil guardians:", guardiansError.message);
    return true;
  }

  if (!guardians?.length) {
    await sendWhatsAppText({
      to: senderPhone,
      message:
        "Sorry, this phone number is not authorized to access pupil information for this school. Please contact the school office if you believe this is a mistake.",
      phoneNumberId,
    });

    return true;
  }

  const pupilIds = Array.from(
    new Set(guardians.map((guardian) => guardian.pupil_id).filter(Boolean)),
  ) as string[];

  const { data: pupils, error: pupilsError } = await supabaseAdmin
    .from("pupils")
    .select(
      `
      id,
      school_id,
      first_name,
      last_name,
      class_name,
      admission_number,
      date_of_birth,
      notes,
      is_active
    `,
    )
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .in("id", pupilIds);

  if (pupilsError || !pupils?.length) {
    await sendWhatsAppText({
      to: senderPhone,
      message:
        "I could not find an active pupil linked to this phone number. Please contact the school office.",
      phoneNumberId,
    });

    return true;
  }

  const { data: activities } = await supabaseAdmin
    .from("pupil_activity_logs")
    .select(
      `
      id,
      school_id,
      pupil_id,
      activity_date,
      title,
      details,
      created_at
    `,
    )
    .eq("school_id", schoolId)
    .in("pupil_id", pupilIds)
    .order("activity_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  const schoolProfileContext = `
School Profile:
Name: ${school.name || "Not set"}
Type: ${school.type || "Not set"}
Phone: ${school.phone || "Not set"}
WhatsApp: ${school.whatsapp || "Not set"}
Email: ${school.email || "Not set"}
Location: ${school.location || "Not set"}
Description: ${school.description || "No description added"}
  `.trim();

  const pupilContext = pupils
    .map((pupil) => {
      const fullName = `${pupil.first_name || ""} ${
        pupil.last_name || ""
      }`.trim();

      const pupilActivities = (activities || []).filter(
        (activity) => activity.pupil_id === pupil.id,
      );

      const activityText =
        pupilActivities.length > 0
          ? pupilActivities
              .map((activity) => {
                return [
                  `Date: ${activity.activity_date}`,
                  activity.title ? `Title: ${activity.title}` : null,
                  `Details: ${activity.details}`,
                ]
                  .filter(Boolean)
                  .join("\n");
              })
              .join("\n\n")
          : "No activity notes have been added yet.";

      return `
Pupil:
Name: ${fullName}
Class: ${pupil.class_name || "Not set"}
Admission Number: ${pupil.admission_number || "Not set"}
General Notes: ${pupil.notes || "No general notes"}

Activity Notes:
${activityText}
      `.trim();
    })
    .join("\n\n---\n\n");

  const schoolInstructions = `
You are the WhatsApp school assistant for ${school.name}.
You may only answer using the school profile, pupil information, and activity notes provided below.
The sender is authorized only for the pupil or pupils listed below.
Do not reveal information about any pupil not listed below.
Do not reveal private notes for pupils outside the authorized list.
If the question asks for information that is not in the school profile or pupil notes, say that the school has not added that information yet.
If the guardian asks for school contact, location, or general school details, answer from the school profile.
Keep the answer warm, clear, concise, and suitable for a parent or guardian.
  `.trim();

  let aiReply =
    `Hello, this is ${school.name} AI assistant. Thanks for your message. ` +
    "A team member will confirm shortly.";

  try {
    const generatedReply = await generateBusinessReply({
      businessName: school.name,
      customerName: null,
      customerMessage: messageText,
      businessKnowledge: `${schoolInstructions}\n\n${schoolProfileContext}\n\n${pupilContext}`,
      recentMessages: [],
      assistantMode: "school",
    });

    aiReply =
      typeof generatedReply === "string" && generatedReply.trim()
        ? generatedReply.trim()
        : aiReply;
  } catch (aiError) {
    console.error("Failed to generate school AI reply:", aiError);
  }

  await sendWhatsAppText({
    to: senderPhone,
    message: aiReply,
    phoneNumberId,
  });

  await updateWebhookEvent(debugEventId, {
    school_id: schoolId,
    status: "handled",
    stage: "school_reply_sent",
  });

  return true;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    return NextResponse.json(
      { error: "Missing WHATSAPP_WEBHOOK_VERIFY_TOKEN environment variable." },
      { status: 500 },
    );
  }

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return NextResponse.json(
    { error: "Webhook verification failed." },
    { status: 403 },
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WhatsAppWebhookBody;

    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        const value = change.value;

        if (!value) continue;

        if (value.statuses?.length) {
          await updateMessageStatuses(value.statuses);
          continue;
        }

        if (!value.messages?.length) {
          continue;
        }

        const phoneNumberId = value.metadata?.phone_number_id || null;

        if (!phoneNumberId) {
          console.error("Webhook missing phone_number_id.");
          continue;
        }

        for (const incomingMessage of value.messages) {
          const messageText = getMessageText(incomingMessage);
          const debugEventId = await insertWebhookEvent({
            phone_number_id: phoneNumberId,
            display_phone_number: value.metadata?.display_phone_number || null,
            sender_phone: incomingMessage.from
              ? normalizePhoneNumber(incomingMessage.from)
              : null,
            message_id: incomingMessage.id || null,
            message_type: incomingMessage.type || null,
            message_text: messageText || null,
            raw_payload: {
              entry_id: entry.id || null,
              field: change.field || null,
              metadata: value.metadata || null,
              contacts: value.contacts || [],
              message: incomingMessage,
            },
          });

          const handledAsBusiness = await processBusinessMessage({
            phoneNumberId,
            value,
            incomingMessage,
            debugEventId,
          });

          if (handledAsBusiness) continue;

          const handledAsSchool = await processSchoolMessage({
            phoneNumberId,
            incomingMessage,
            debugEventId,
          });

          if (handledAsSchool) continue;

          console.error("No active workspace found for phone_number_id:", {
            phoneNumberId,
          });

          await updateWebhookEvent(debugEventId, {
            status: "failed",
            stage: "no_workspace_matched",
            error_message: `No active business or school workspace found for phone_number_id ${phoneNumberId}`,
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process WhatsApp webhook.",
      },
      { status: 500 },
    );
  }
}

