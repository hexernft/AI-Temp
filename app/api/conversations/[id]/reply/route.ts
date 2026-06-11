import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendInstagramText } from "@/lib/instagram";
import { sendWhatsAppText } from "@/lib/whatsapp";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type Profile = {
  id: string;
  role: string | null;
  business_id: string | null;
  school_id: string | null;
};

type ConversationRecord = {
  id: string;
  business_id?: string | null;
  school_id?: string | null;
  customer_id?: string | null;
  phone_number_id?: string | null;
  status?: string | null;
  handoff_required?: boolean | null;
  [key: string]: unknown;
};

type MessageMetadata = {
  source?: string;
  platform?: string;
  instagram_account_id?: string;
  instagram_business_account_id?: string;
  instagram_sender_id?: string;
  instagram_recipient_id?: string;
  [key: string]: unknown;
};

type LatestCustomerMessage = {
  id: string;
  metadata?: MessageMetadata | null;
};

type InstagramAccountRecord = {
  id: string;
  business_id: string;
  instagram_business_account_id: string;
  access_token?: string | null;
  is_active?: boolean | null;
};

type CustomerRecord = {
  id: string;
  phone?: string | null;
  whatsapp?: string | null;
  customer_phone?: string | null;
  wa_id?: string | null;
  contact_phone?: string | null;
  name?: string | null;
};

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) return null;

  return token;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanPhone(value: unknown) {
  if (typeof value !== "string") return null;

  const cleaned = value.replace(/[^\d]/g, "");

  return cleaned || null;
}

async function requireUser(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const token = getBearerToken(request);

  if (!token) {
    return {
      supabaseAdmin,
      user: null,
      profile: null,
      error: NextResponse.json(
        { error: "Unauthorized. Missing session token." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return {
      supabaseAdmin,
      user: null,
      profile: null,
      error: NextResponse.json(
        { error: "Unauthorized. Invalid session." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, business_id, school_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      supabaseAdmin,
      user,
      profile: null,
      error: NextResponse.json(
        { error: "Profile not found." },
        { status: 404 }
      ),
    };
  }

  return {
    supabaseAdmin,
    user,
    profile: profile as Profile,
    error: null,
  };
}

function canAccessConversation({
  profile,
  conversation,
}: {
  profile: Profile;
  conversation: ConversationRecord;
}) {
  if (profile.role === "super_admin") return true;

  if (
    (profile.role === "business_owner" || profile.role === "staff") &&
    profile.business_id &&
    conversation.business_id === profile.business_id
  ) {
    return true;
  }

  if (
    (profile.role === "school_admin" || profile.role === "teacher") &&
    profile.school_id &&
    conversation.school_id === profile.school_id
  ) {
    return true;
  }

  return false;
}


function getMetadataObject(value: unknown): MessageMetadata {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as MessageMetadata;
  }

  return {};
}

async function getLatestCustomerMessage({
  supabaseAdmin,
  conversationId,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  conversationId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id, metadata")
    .eq("conversation_id", conversationId)
    .eq("sender_type", "customer")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return data as LatestCustomerMessage;
}

function isInstagramConversation(latestCustomerMessage: LatestCustomerMessage | null) {
  const metadata = getMetadataObject(latestCustomerMessage?.metadata);

  return (
    metadata.platform === "instagram" ||
    metadata.source === "instagram_webhook" ||
    Boolean(metadata.instagram_sender_id)
  );
}

async function getInstagramReplyTarget({
  supabaseAdmin,
  conversation,
  latestCustomerMessage,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  conversation: ConversationRecord;
  latestCustomerMessage: LatestCustomerMessage | null;
}) {
  const metadata = getMetadataObject(latestCustomerMessage?.metadata);
  const recipientId = cleanText(
    metadata.instagram_sender_id || metadata.instagram_recipient_id
  );
  const instagramBusinessAccountId = cleanText(
    metadata.instagram_business_account_id
  );
  const instagramAccountId = cleanText(metadata.instagram_account_id);

  if (!conversation.business_id) {
    throw new Error("Missing business ID for this Instagram conversation.");
  }

  if (!recipientId) {
    throw new Error(
      "Missing Instagram recipient ID on the latest customer message. Ask the customer to send a new Instagram DM, then reply again."
    );
  }

  let query = supabaseAdmin
    .from("business_instagram_accounts")
    .select("id, business_id, instagram_business_account_id, access_token, is_active")
    .eq("business_id", conversation.business_id)
    .eq("is_active", true)
    .limit(1);

  if (instagramAccountId) {
    query = query.eq("id", instagramAccountId);
  } else if (instagramBusinessAccountId) {
    query = query.eq("instagram_business_account_id", instagramBusinessAccountId);
  }

  const { data: account, error } = await query.maybeSingle();

  if (error || !account) {
    throw new Error(
      error?.message ||
        "No active Instagram account is connected for this business."
    );
  }

  return {
    recipientId,
    account: account as InstagramAccountRecord,
  };
}

async function getCustomerPhone({
  supabaseAdmin,
  conversation,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  conversation: ConversationRecord;
}) {
  if (!conversation.customer_id) return null;

  const { data: customer, error } = await supabaseAdmin
    .from("customers")
    .select("id, phone, whatsapp, customer_phone, wa_id, contact_phone, name")
    .eq("id", conversation.customer_id)
    .maybeSingle();

  if (error || !customer) return null;

  const typedCustomer = customer as CustomerRecord;

  return (
    cleanPhone(typedCustomer.phone) ||
    cleanPhone(typedCustomer.whatsapp) ||
    cleanPhone(typedCustomer.customer_phone) ||
    cleanPhone(typedCustomer.wa_id) ||
    cleanPhone(typedCustomer.contact_phone)
  );
}

async function getWhatsAppReplySender({
  supabaseAdmin,
  conversation,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  conversation: ConversationRecord;
}) {
  const directPhoneNumberId = cleanText(conversation.phone_number_id);

  if (!conversation.business_id && directPhoneNumberId) {
    return {
      phoneNumberId: directPhoneNumberId,
      accessToken: null as string | null,
    };
  }

  if (!conversation.business_id) return null;

  const { data: activeNumber, error } = await supabaseAdmin
    .from("business_phone_numbers")
    .select("id, business_id, phone_number_id, access_token, is_active")
    .eq("business_id", conversation.business_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const phoneNumberId = directPhoneNumberId || cleanText(activeNumber?.phone_number_id);

  if (!phoneNumberId) return null;

  return {
    phoneNumberId,
    accessToken: cleanText(activeNumber?.access_token) || null,
  };
}

async function saveStaffOutgoingMessage({
  supabaseAdmin,
  conversation,
  message,
  externalMessageId,
  platform,
  providerResponse,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  conversation: ConversationRecord;
  message: string;
  externalMessageId: string | null;
  platform: "whatsapp" | "instagram";
  providerResponse: unknown;
}) {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin.from("messages").insert({
    conversation_id: conversation.id,
    business_id: conversation.business_id || null,
    customer_id: conversation.customer_id || null,
    sender_type: "staff",
    message_type: "text",
    content: message,
    body: message,
    external_message_id: externalMessageId,
    status: "sent",
    metadata: {
      source: "manual_dashboard_reply",
      platform,
      provider_response: providerResponse,
      whatsapp_response: platform === "whatsapp" ? providerResponse : null,
      instagram_response: platform === "instagram" ? providerResponse : null,
    },
    created_at: now,
  });

  if (error) {
    throw new Error(`WhatsApp sent, but failed to save message: ${error.message}`);
  }

  await supabaseAdmin
    .from("conversations")
    .update({
      last_message_at: now,
      updated_at: now,
    })
    .eq("id", conversation.id);
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Conversation ID is required." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const message = cleanText(body.message);

    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const { supabaseAdmin, profile, error } = await requireUser(request);

    if (error || !profile) return error;

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("id", id)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: conversationError?.message || "Chat not found." },
        { status: 404 }
      );
    }

    const typedConversation = conversation as ConversationRecord;

    if (
      !canAccessConversation({
        profile,
        conversation: typedConversation,
      })
    ) {
      return NextResponse.json(
        { error: "You do not have access to this chat." },
        { status: 403 }
      );
    }

    const latestCustomerMessage = await getLatestCustomerMessage({
      supabaseAdmin,
      conversationId: typedConversation.id,
    });

    if (isInstagramConversation(latestCustomerMessage)) {
      const { recipientId, account } = await getInstagramReplyTarget({
        supabaseAdmin,
        conversation: typedConversation,
        latestCustomerMessage,
      });

      const instagramResponse = await sendInstagramText({
        recipientId,
        message,
        instagramBusinessAccountId: account.instagram_business_account_id,
        accessToken: account.access_token,
      });

      await saveStaffOutgoingMessage({
        supabaseAdmin,
        conversation: typedConversation,
        message,
        externalMessageId: instagramResponse.message_id || null,
        platform: "instagram",
        providerResponse: instagramResponse,
      });

      return NextResponse.json({
        ok: true,
        message: "Instagram reply sent.",
        to: recipientId,
        instagram_business_account_id: account.instagram_business_account_id,
        instagram_response: instagramResponse,
      });
    }

    const customerPhone = await getCustomerPhone({
      supabaseAdmin,
      conversation: typedConversation,
    });

    if (!customerPhone) {
      return NextResponse.json(
        {
          error:
            "Missing customer WhatsApp number. The customer record does not have a usable phone field.",
        },
        { status: 400 }
      );
    }

    const whatsappSender = await getWhatsAppReplySender({
      supabaseAdmin,
      conversation: typedConversation,
    });

    if (!whatsappSender) {
      return NextResponse.json(
        {
          error:
            "Missing WhatsApp phone number ID. Add phone_number_id to the active business_phone_numbers row for this business.",
        },
        { status: 400 }
      );
    }

    const whatsappResponse = await sendWhatsAppText({
      to: customerPhone,
      message,
      phoneNumberId: whatsappSender.phoneNumberId,
      accessToken: whatsappSender.accessToken,
    });

    const whatsappMessageId = whatsappResponse.messages?.[0]?.id || null;

    await saveStaffOutgoingMessage({
      supabaseAdmin,
      conversation: typedConversation,
      message,
      externalMessageId: whatsappMessageId,
      platform: "whatsapp",
      providerResponse: whatsappResponse,
    });

    return NextResponse.json({
      ok: true,
      message: "WhatsApp reply sent.",
      to: customerPhone,
      phone_number_id: whatsappSender.phoneNumberId,
      whatsapp_response: whatsappResponse,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send reply.",
      },
      { status: 500 }
    );
  }
}