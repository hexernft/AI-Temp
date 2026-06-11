import {
  updateConversationOrderState,
  type ProductCatalogItem,
} from "@/lib/orderState";

type SupabaseAdminClient = any;

type RecentMessage = {
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

type SalesAgentCorePayload = {
  supabaseAdmin: SupabaseAdminClient;
  businessId: string;
  customerId: string;
  conversationId: string;
  customerName?: string | null;
  customerMessage: string;
  businessKnowledge?: string | null;
  recentMessages?: RecentMessage[];
  productCatalog?: ProductCatalogItem[];
};

export type SalesAgentCoreResult = {
  handled: boolean;
  directReply: string | null;
  orderStateContext: string;
  orderStateId: string | null;
  stage: string;
  intent:
    | "empty"
    | "handoff"
    | "greeting"
    | "menu"
    | "order"
    | "fulfillment"
    | "address"
    | "confirmation"
    | "post_order"
    | "general";
  debug: {
    reason: string;
    usedOrderState: boolean;
  };
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: string) {
  return cleanText(value).toLowerCase();
}

function isPlainGreeting(message: string) {
  const text = normalize(message);
  return [
    "hi",
    "hello",
    "hey",
    "good morning",
    "good afternoon",
    "good evening",
  ].includes(text);
}

function isExplicitMenuRequest(message: string) {
  const text = normalize(message);
  return (
    text.includes("menu") ||
    text.includes("what do you have") ||
    text.includes("what are you selling") ||
    text.includes("what do you sell") ||
    text.includes("price list") ||
    text.includes("prices") ||
    text.includes("show me")
  );
}

function isThanksMessage(message: string) {
  const text = normalize(message);
  return ["thank you", "thanks", "thank u", "ok thanks", "okay thanks"].includes(text);
}

function isShortAffirmation(message: string) {
  const text = normalize(message);
  return [
    "yes",
    "yeah",
    "yep",
    "sure",
    "ok",
    "okay",
    "confirm",
    "confirmed",
    "go ahead",
    "proceed",
  ].includes(text);
}

function mentionsDelivery(message: string) {
  const text = normalize(message);
  return text.includes("delivery") || text.includes("deliver") || text.includes("dispatch");
}

function mentionsPickup(message: string) {
  const text = normalize(message);
  return text.includes("pickup") || text.includes("pick up") || text.includes("collect");
}

function looksLikeAddress(message: string) {
  const text = cleanText(message);
  const lower = text.toLowerCase();
  return (
    text.includes(",") ||
    /^\d+\s+[a-z]/i.test(text) ||
    /\b(street|road|close|estate|avenue|drive|crescent|junction|opposite|beside|near|gwarinpa|wuse|maitama|asokoro|jabi|kubwa|lugbe|abuja)\b/i.test(lower)
  );
}

function wantsHuman(message: string) {
  const text = normalize(message);
  return [
    "human",
    "agent",
    "person",
    "representative",
    "manager",
    "complaint",
    "refund",
    "wrong order",
    "speak to someone",
    "talk to someone",
  ].some((word) => text.includes(word));
}

function normalizeProductKey(value: string) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "").replace(/s$/, "");
}

function hasProductMention(message: string, products: ProductCatalogItem[] = []) {
  const text = normalizeProductKey(message);
  return products.some((product) => {
    const key = normalizeProductKey(product.name);
    return key && text.includes(key);
  });
}

function classifyIntent({
  customerMessage,
  productCatalog,
}: {
  customerMessage: string;
  productCatalog?: ProductCatalogItem[];
}): SalesAgentCoreResult["intent"] {
  const message = cleanText(customerMessage);
  if (!message) return "empty";
  if (isPlainGreeting(message)) return "greeting";
  if (wantsHuman(message)) return "handoff";
  if (isThanksMessage(message)) return "post_order";
  if (isExplicitMenuRequest(message)) return "menu";
  if (mentionsDelivery(message) || mentionsPickup(message)) return "fulfillment";
  if (looksLikeAddress(message)) return "address";
  if (isShortAffirmation(message)) return "confirmation";
  if (/^\d{1,4}\s*(pcs?|pieces?|packs?)?$/i.test(message)) return "order";
  if (hasProductMention(message, productCatalog)) return "order";

  const lower = normalize(message);
  if (
    lower.includes("order") ||
    lower.includes("buy") ||
    lower.includes("want") ||
    lower.includes("need") ||
    lower.includes("get") ||
    lower.includes("add")
  ) {
    return "order";
  }

  return "general";
}

function shouldUseOrderState(intent: SalesAgentCoreResult["intent"]) {
  return ["menu", "order", "fulfillment", "address", "confirmation", "post_order"].includes(intent);
}

export async function runSalesAgentCore({
  supabaseAdmin,
  businessId,
  customerId,
  conversationId,
  customerName,
  customerMessage,
  businessKnowledge,
  recentMessages = [],
  productCatalog = [],
}: SalesAgentCorePayload): Promise<SalesAgentCoreResult> {
  const cleanMessage = cleanText(customerMessage);
  const intent = classifyIntent({ customerMessage: cleanMessage, productCatalog });

  if (intent === "empty") {
    return {
      handled: false,
      directReply: null,
      orderStateContext: "No customer message provided.",
      orderStateId: null,
      stage: "empty_message",
      intent,
      debug: { reason: "Empty message.", usedOrderState: false },
    };
  }

  if (intent === "greeting") {
    return {
      handled: true,
      directReply: "Welcome to ZCAS. Would you like to see our menu or place an order?",
      orderStateContext: "Greeting handled by sales agent core.",
      orderStateId: null,
      stage: "greeting_handled",
      intent,
      debug: { reason: "Plain greeting detected.", usedOrderState: false },
    };
  }

  if (intent === "handoff") {
    return {
      handled: true,
      directReply: "I will notify a team member so they can assist you properly.",
      orderStateContext: "Customer requested human assistance.",
      orderStateId: null,
      stage: "handoff_requested",
      intent,
      debug: { reason: "Handoff intent detected.", usedOrderState: false },
    };
  }

  if (!shouldUseOrderState(intent)) {
    return {
      handled: false,
      directReply: null,
      orderStateContext: "General message. Let AI fallback answer normally.",
      orderStateId: null,
      stage: "general_message",
      intent,
      debug: { reason: "No controlled sales intent detected.", usedOrderState: false },
    };
  }

  const orderResult = await updateConversationOrderState({
    supabaseAdmin,
    businessId,
    customerId,
    conversationId,
    customerName,
    customerMessage: cleanMessage,
    businessKnowledge,
    recentMessages,
    productCatalog,
  });

  return {
    handled: Boolean(orderResult.directReply),
    directReply: orderResult.directReply,
    orderStateContext: orderResult.orderStateContext,
    orderStateId: orderResult.orderStateId,
    stage: orderResult.stage,
    intent,
    debug: { reason: `Handled controlled intent: ${intent}.`, usedOrderState: true },
  };
}
