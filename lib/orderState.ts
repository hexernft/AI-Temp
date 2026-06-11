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

export type ProductCatalogItem = {
  id?: string | null;
  name: string;
  category?: string | null;
  price: number | null;
  currency?: string | null;
  availability?: string | null;
  description?: string | null;
};

type OrderStateRow = {
  id: string;
  business_id: string;
  customer_id: string | null;
  conversation_id: string;
  status: string;
  fulfillment_type: string | null;
  delivery_address: string | null;
  pickup_time: string | null;
  subtotal: number | null;
  delivery_fee: number | null;
  total: number | null;
  confirmation_status: string | null;
  notes: string | null;
};

type OrderItemRow = {
  id: string;
  order_state_id: string;
  business_id: string;
  product_name: string;
  quantity: number;
  unit_price: number | null;
  line_total: number | null;
  notes: string | null;
};

type UpdateConversationOrderStatePayload = {
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

type UpdateConversationOrderStateResult = {
  orderStateContext: string;
  directReply: string | null;
  orderStateId: string | null;
  stage: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getMessageBody(message: RecentMessage) {
  return cleanText(message.content || message.body || message.message || message.text || "");
}

function getSenderLabel(message: RecentMessage) {
  const rawSender = String(
    message.sender_type || message.role || message.sender || message.direction || "",
  ).toLowerCase();

  if (
    rawSender.includes("customer") ||
    rawSender.includes("user") ||
    rawSender.includes("inbound")
  ) {
    return "customer";
  }

  return "assistant";
}

function normalizeProductKey(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\bpieces\b/g, "")
    .replace(/\bpiece\b/g, "")
    .replace(/\bpcs\b/g, "")
    .replace(/\bpc\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/ies$/g, "y")
    .replace(/s$/g, "");
}

function formatMoney(amount: number | null | undefined, currency = "N") {
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) {
    return "to be confirmed";
  }

  const symbol = currency.toUpperCase() === "NGN" ? "N" : currency;
  return `${symbol}${Number(amount).toLocaleString("en-NG")}`;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const clean = value.replace(/[^0-9.]/g, "");
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function titleCase(value: string) {
  return cleanText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function pluralizeProduct(name: string, quantity: number) {
  if (quantity === 1) return name;
  const lower = name.toLowerCase();
  if (lower.endsWith("s")) return name;
  if (lower.endsWith("y")) return `${name.slice(0, -1)}ies`;
  return `${name}s`;
}

function buildCatalogFromProducts(products: ProductCatalogItem[] = []) {
  return products
    .map((product) => {
      const name = cleanText(product.name);
      if (!name) return null;

      return {
        id: product.id || null,
        name: titleCase(name),
        key: normalizeProductKey(name),
        category: cleanText(product.category),
        price: toNumber(product.price as unknown),
        currency: cleanText(product.currency) || "NGN",
        availability: cleanText(product.availability) || "Available",
        description: cleanText(product.description),
      };
    })
    .filter(Boolean) as Array<Required<Pick<ProductCatalogItem, "name">> & {
      id: string | null;
      key: string;
      category: string;
      price: number | null;
      currency: string;
      availability: string;
      description: string;
    }>;
}

function isMenuRequest(message: string) {
  const text = cleanText(message).toLowerCase();
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
  const text = cleanText(message).toLowerCase();
  return [
    "thank you",
    "thanks",
    "thank u",
    "ok thanks",
    "okay thanks",
    "alright thanks",
  ].includes(text);
}

function isShortAffirmation(message: string) {
  const text = cleanText(message).toLowerCase();
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
    "correct",
  ].includes(text);
}

function mentionsDelivery(message: string) {
  const text = cleanText(message).toLowerCase();
  return (
    text.includes("delivery") ||
    text.includes("deliver") ||
    text.includes("send it") ||
    text.includes("bring it") ||
    text.includes("dispatch")
  );
}

function mentionsPickup(message: string) {
  const text = cleanText(message).toLowerCase();
  return text.includes("pickup") || text.includes("pick up") || text.includes("collect");
}

function looksLikeAddress(message: string) {
  const text = cleanText(message);
  const lower = text.toLowerCase();
  if (text.length < 5) return false;
  if (isMenuRequest(text) || mentionsDelivery(text) || mentionsPickup(text) || isShortAffirmation(text)) {
    return false;
  }
  return (
    text.includes(",") ||
    /\b(street|road|close|estate|avenue|drive|crescent|junction|opposite|beside|near|gwarinpa|wuse|maitama|asokoro|jabi|kubwa|lugbe|abuja)\b/i.test(lower) ||
    /^\d+\s+[a-z]/i.test(text)
  );
}

function previousAssistantAskedForFinalConfirmation(recentMessages: RecentMessage[]) {
  const previousAssistantMessage = [...recentMessages]
    .reverse()
    .find((message) => getSenderLabel(message) === "assistant");
  const body = getMessageBody(previousAssistantMessage || {}).toLowerCase();
  return (
    body.includes("submit this order") ||
    body.includes("confirm this order") ||
    body.includes("should i submit") ||
    body.includes("order summary")
  );
}

function findCatalogMatches(message: string, catalog: ReturnType<typeof buildCatalogFromProducts>) {
  const normalizedMessage = normalizeProductKey(message);
  const results: Array<{ product: (typeof catalog)[number]; quantity: number }> = [];

  for (const product of catalog) {
    const aliases = new Set<string>([product.name, product.key]);
    aliases.add(product.name.replace(/s$/i, ""));
    aliases.add(`${product.name}s`);
    aliases.add(product.name.replace(/\s+/g, ""));
    aliases.add(product.name.replace(/\s+/g, "-") );

    const aliasKeys = [...aliases].map((alias) => normalizeProductKey(alias)).filter(Boolean);
    const matched = aliasKeys.some((key) => normalizedMessage.includes(key));
    if (!matched) continue;

    const escapedNames = [...aliases]
      .filter(Boolean)
      .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    const namePattern = escapedNames.length ? escapedNames.join("|") : product.name;
    const beforeRegex = new RegExp(`(?:^|[^0-9])([0-9]{1,4})\\s*(?:pcs?|pieces?|packs?)?\\s*(?:${namePattern})`, "i");
    const afterRegex = new RegExp(`(?:${namePattern})\\s*(?:x|times)?\\s*([0-9]{1,4})`, "i");

    const beforeMatch = message.match(beforeRegex);
    const afterMatch = message.match(afterRegex);
    const quantity = Number(beforeMatch?.[1] || afterMatch?.[1] || 1);

    results.push({
      product,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    });
  }

  return results;
}

async function loadActiveOrderState({
  supabaseAdmin,
  businessId,
  customerId,
  conversationId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  businessId: string;
  customerId: string;
  conversationId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("conversation_order_states")
    .select("*")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("conversation_id", conversationId)
    .in("status", ["collecting", "awaiting_confirmation"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as OrderStateRow | null;
}

async function createOrderState({
  supabaseAdmin,
  businessId,
  customerId,
  conversationId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  businessId: string;
  customerId: string;
  conversationId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("conversation_order_states")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      conversation_id: conversationId,
      status: "collecting",
      confirmation_status: "pending",
      subtotal: 0,
      total: 0,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as OrderStateRow;
}

async function loadOrderItems(supabaseAdmin: SupabaseAdminClient, orderStateId: string) {
  const { data, error } = await supabaseAdmin
    .from("conversation_order_items")
    .select("*")
    .eq("order_state_id", orderStateId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as OrderItemRow[];
}

async function recalculateOrderTotals({
  supabaseAdmin,
  orderStateId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  orderStateId: string;
}) {
  const items = await loadOrderItems(supabaseAdmin, orderStateId);
  const subtotal = items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);

  const { data, error } = await supabaseAdmin
    .from("conversation_order_states")
    .update({
      subtotal,
      total: subtotal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderStateId)
    .select("*")
    .single();

  if (error) throw error;
  return { orderState: data as OrderStateRow, items };
}

async function addOrUpdateItem({
  supabaseAdmin,
  orderState,
  businessId,
  productName,
  quantity,
  unitPrice,
}: {
  supabaseAdmin: SupabaseAdminClient;
  orderState: OrderStateRow;
  businessId: string;
  productName: string;
  quantity: number;
  unitPrice: number | null;
}) {
  const items = await loadOrderItems(supabaseAdmin, orderState.id);
  const productKey = normalizeProductKey(productName);
  const existing = items.find((item) => normalizeProductKey(item.product_name) === productKey);
  const lineTotal = unitPrice !== null ? Number((unitPrice * quantity).toFixed(2)) : null;

  if (existing) {
    const nextQuantity = Number(existing.quantity || 0) + quantity;
    const nextLineTotal = unitPrice !== null ? Number((unitPrice * nextQuantity).toFixed(2)) : null;
    const { error } = await supabaseAdmin
      .from("conversation_order_items")
      .update({
        product_name: titleCase(productName),
        quantity: nextQuantity,
        unit_price: unitPrice,
        line_total: nextLineTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin.from("conversation_order_items").insert({
    order_state_id: orderState.id,
    business_id: businessId,
    product_name: titleCase(productName),
    quantity,
    unit_price: unitPrice,
    line_total: lineTotal,
    created_at: new Date().toISOString(),
  });

  if (error) throw error;
}

function buildItemSummary(items: OrderItemRow[]) {
  if (!items.length) return "No items yet.";
  return items
    .map((item) => {
      const quantity = Number(item.quantity || 0);
      const name = pluralizeProduct(titleCase(item.product_name), quantity);
      const total = item.line_total !== null ? ` - ${formatMoney(Number(item.line_total))}` : " - to be confirmed";
      return `- ${quantity} ${name}${total}`;
    })
    .join("\n");
}

function buildMenu(catalog: ReturnType<typeof buildCatalogFromProducts>) {
  if (!catalog.length) {
    return "I do not have the product menu yet. A team member will confirm available items shortly.";
  }

  const lines = catalog
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => `- ${item.name} - ${formatMoney(item.price, item.currency)}`)
    .join("\n");

  return `Here's what we have:\n\n${lines}\n\nWhich items and quantities would you like to order?`;
}

function buildOrderStateContext(orderState: OrderStateRow, items: OrderItemRow[]) {
  return [
    `Order status: ${orderState.status}`,
    `Fulfillment: ${orderState.fulfillment_type || "missing"}`,
    `Delivery address: ${orderState.delivery_address || "missing"}`,
    `Pickup time: ${orderState.pickup_time || "missing"}`,
    `Confirmation: ${orderState.confirmation_status || "pending"}`,
    `Subtotal: ${formatMoney(orderState.subtotal || 0)}`,
    `Items:\n${buildItemSummary(items)}`,
  ].join("\n");
}

function getNextStep(orderState: OrderStateRow, items: OrderItemRow[]) {
  if (!items.length) return "collect_items";
  if (!orderState.fulfillment_type) return "ask_fulfillment";
  if (orderState.fulfillment_type === "delivery" && !orderState.delivery_address) {
    return "ask_delivery_address";
  }
  if (orderState.fulfillment_type === "pickup" && !orderState.pickup_time) {
    return "ask_pickup_time";
  }
  if (orderState.confirmation_status !== "confirmed") return "ask_final_confirmation";
  return "confirmed";
}

function buildSummaryReply(orderState: OrderStateRow, items: OrderItemRow[]) {
  const fulfillmentLine =
    orderState.fulfillment_type === "delivery"
      ? `Delivery address: ${orderState.delivery_address || "to be provided"}`
      : `Pickup time: ${orderState.pickup_time || "to be provided"}`;

  return `Thanks. Here's your order summary:\n\n${buildItemSummary(items)}\n${fulfillmentLine}\nSubtotal: ${formatMoney(orderState.subtotal || 0)}\nDelivery fee: to be confirmed\n\nShould I submit this order for confirmation?`;
}

export async function updateConversationOrderState({
  supabaseAdmin,
  businessId,
  customerId,
  conversationId,
  customerMessage,
  recentMessages = [],
  productCatalog = [],
}: UpdateConversationOrderStatePayload): Promise<UpdateConversationOrderStateResult> {
  const cleanMessage = cleanText(customerMessage);
  const catalog = buildCatalogFromProducts(productCatalog);

  let orderState = await loadActiveOrderState({
    supabaseAdmin,
    businessId,
    customerId,
    conversationId,
  });

  if (isMenuRequest(cleanMessage)) {
    return {
      orderStateContext: "Menu request handled from business_products.",
      directReply: buildMenu(catalog),
      orderStateId: orderState?.id || null,
      stage: "menu_sent",
    };
  }

  if (isThanksMessage(cleanMessage)) {
    return {
      orderStateContext: "Customer sent a thank-you message.",
      directReply:
        "You're welcome. The team will confirm payment, delivery fee, and final details shortly.",
      orderStateId: orderState?.id || null,
      stage: "post_order_acknowledged",
    };
  }

  if (!orderState) {
    orderState = await createOrderState({
      supabaseAdmin,
      businessId,
      customerId,
      conversationId,
    });
  }

  let items = await loadOrderItems(supabaseAdmin, orderState.id);
  const matches = findCatalogMatches(cleanMessage, catalog);

  if (matches.length) {
    for (const match of matches) {
      await addOrUpdateItem({
        supabaseAdmin,
        orderState,
        businessId,
        productName: match.product.name,
        quantity: match.quantity,
        unitPrice: match.product.price,
      });
    }

    const recalculated = await recalculateOrderTotals({ supabaseAdmin, orderStateId: orderState.id });
    orderState = recalculated.orderState;
    items = await loadOrderItems(supabaseAdmin, orderState.id);

    const nextStep = getNextStep(orderState, items);
    if (nextStep === "ask_fulfillment") {
      return {
        orderStateContext: buildOrderStateContext(orderState, items),
        directReply: `Thanks. Here's your order so far:\n\n${buildItemSummary(items)}\n\nSubtotal: ${formatMoney(orderState.subtotal || 0)}\n\nWould you prefer delivery or pickup?`,
        orderStateId: orderState.id,
        stage: "ask_fulfillment",
      };
    }
  }

  items = await loadOrderItems(supabaseAdmin, orderState.id);

  if (mentionsDelivery(cleanMessage)) {
    const { data, error } = await supabaseAdmin
      .from("conversation_order_states")
      .update({
        fulfillment_type: "delivery",
        status: "collecting",
        confirmation_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderState.id)
      .select("*")
      .single();
    if (error) throw error;
    orderState = data as OrderStateRow;
    items = await loadOrderItems(supabaseAdmin, orderState.id);

    if (!items.length) {
      return {
        orderStateContext: buildOrderStateContext(orderState, items),
        directReply: "Sure, delivery is available. What would you like to order?",
        orderStateId: orderState.id,
        stage: "ask_items",
      };
    }

    return {
      orderStateContext: buildOrderStateContext(orderState, items),
      directReply: `Sure, we can arrange delivery for:\n\n${buildItemSummary(items)}\n\nPlease send your delivery address.`,
      orderStateId: orderState.id,
      stage: "ask_delivery_address",
    };
  }

  if (mentionsPickup(cleanMessage)) {
    const { data, error } = await supabaseAdmin
      .from("conversation_order_states")
      .update({
        fulfillment_type: "pickup",
        status: "collecting",
        confirmation_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderState.id)
      .select("*")
      .single();
    if (error) throw error;
    orderState = data as OrderStateRow;
    items = await loadOrderItems(supabaseAdmin, orderState.id);

    if (!items.length) {
      return {
        orderStateContext: buildOrderStateContext(orderState, items),
        directReply: "Pickup is fine. What would you like to order?",
        orderStateId: orderState.id,
        stage: "ask_items",
      };
    }

    return {
      orderStateContext: buildOrderStateContext(orderState, items),
      directReply: `Pickup noted for:\n\n${buildItemSummary(items)}\n\nWhat pickup time would you prefer?`,
      orderStateId: orderState.id,
      stage: "ask_pickup_time",
    };
  }

  if (orderState.fulfillment_type === "delivery" && !orderState.delivery_address && looksLikeAddress(cleanMessage)) {
    const { data, error } = await supabaseAdmin
      .from("conversation_order_states")
      .update({
        delivery_address: cleanMessage,
        status: "awaiting_confirmation",
        confirmation_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderState.id)
      .select("*")
      .single();
    if (error) throw error;
    orderState = data as OrderStateRow;
    const recalculated = await recalculateOrderTotals({ supabaseAdmin, orderStateId: orderState.id });
    orderState = recalculated.orderState;
    items = await loadOrderItems(supabaseAdmin, orderState.id);

    return {
      orderStateContext: buildOrderStateContext(orderState, items),
      directReply: buildSummaryReply(orderState, items),
      orderStateId: orderState.id,
      stage: "ask_final_confirmation",
    };
  }

  if (orderState.fulfillment_type === "pickup" && !orderState.pickup_time && cleanMessage && !matches.length) {
    const { data, error } = await supabaseAdmin
      .from("conversation_order_states")
      .update({
        pickup_time: cleanMessage,
        status: "awaiting_confirmation",
        confirmation_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderState.id)
      .select("*")
      .single();
    if (error) throw error;
    orderState = data as OrderStateRow;
    const recalculated = await recalculateOrderTotals({ supabaseAdmin, orderStateId: orderState.id });
    orderState = recalculated.orderState;
    items = await loadOrderItems(supabaseAdmin, orderState.id);

    return {
      orderStateContext: buildOrderStateContext(orderState, items),
      directReply: buildSummaryReply(orderState, items),
      orderStateId: orderState.id,
      stage: "ask_final_confirmation",
    };
  }

  items = await loadOrderItems(supabaseAdmin, orderState.id);
  if (
    orderState.status === "awaiting_confirmation" &&
    isShortAffirmation(cleanMessage) &&
    previousAssistantAskedForFinalConfirmation(recentMessages)
  ) {
    const { data, error } = await supabaseAdmin
      .from("conversation_order_states")
      .update({
        status: "confirmed",
        confirmation_status: "confirmed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderState.id)
      .select("*")
      .single();
    if (error) throw error;
    orderState = data as OrderStateRow;

    return {
      orderStateContext: buildOrderStateContext(orderState, items),
      directReply:
        `Perfect. Your order has been noted.\n\n${buildItemSummary(items)}\n\nA team member will confirm payment, delivery fee, and final details shortly.`,
      orderStateId: orderState.id,
      stage: "order_confirmed",
    };
  }

  const nextStep = getNextStep(orderState, items);

  if (items.length && nextStep === "ask_fulfillment") {
    return {
      orderStateContext: buildOrderStateContext(orderState, items),
      directReply: `Here's your order so far:\n\n${buildItemSummary(items)}\n\nSubtotal: ${formatMoney(orderState.subtotal || 0)}\n\nWould you prefer delivery or pickup?`,
      orderStateId: orderState.id,
      stage: "ask_fulfillment",
    };
  }

  if (nextStep === "ask_delivery_address") {
    return {
      orderStateContext: buildOrderStateContext(orderState, items),
      directReply: "Please send your delivery address so we can complete the order.",
      orderStateId: orderState.id,
      stage: "ask_delivery_address",
    };
  }

  if (nextStep === "ask_pickup_time") {
    return {
      orderStateContext: buildOrderStateContext(orderState, items),
      directReply: "What pickup time would you prefer?",
      orderStateId: orderState.id,
      stage: "ask_pickup_time",
    };
  }

  if (nextStep === "ask_final_confirmation") {
    return {
      orderStateContext: buildOrderStateContext(orderState, items),
      directReply: buildSummaryReply(orderState, items),
      orderStateId: orderState.id,
      stage: "ask_final_confirmation",
    };
  }

  return {
    orderStateContext: buildOrderStateContext(orderState, items),
    directReply: catalog.length
      ? "What would you like to order? You can send item names and quantities, for example: 5 Meat Pies."
      : null,
    orderStateId: orderState.id,
    stage: "ask_items",
  };
}
