import { NextResponse } from "next/server";
import { requireBusinessUser } from "@/lib/requireBusinessUser";

type OrderItem = {
  name?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
};

type CreateOrderPayload = {
  customer_id?: string | null;
  conversation_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  items?: OrderItem[];
  notes?: string | null;
  delivery_address?: string | null;
  delivery_notes?: string | null;
  delivery_fee?: number;
  status?: string;
  payment_status?: string;
  delivery_status?: string;
};

const allowedOrderStatuses = [
  "draft",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const allowedPaymentStatuses = [
  "unpaid",
  "awaiting_confirmation",
  "paid",
  "refunded",
];

const allowedDeliveryStatuses = [
  "not_required",
  "pending",
  "assigned",
  "out_for_delivery",
  "delivered",
];

function normalizeMoney(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0;
  }

  return Number(numberValue.toFixed(2));
}

function normalizeItems(items: OrderItem[] | undefined) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const quantity = Math.max(1, Number(item.quantity || 1));
      const unitPrice = normalizeMoney(item.unit_price);
      const total = normalizeMoney(quantity * unitPrice);

      return {
        name,
        quantity,
        unit_price: unitPrice,
        total,
      };
    })
    .filter((item) => item.name);
}

function calculateSubtotal(items: OrderItem[]) {
  return normalizeMoney(
    items.reduce((sum, item) => sum + normalizeMoney(item.total), 0)
  );
}

function makeOrderNumber() {
  const datePart = new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");

  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `ORD-${datePart}-${randomPart}`;
}

export async function GET(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireBusinessUser(request);

    if (error || !profile) {
      return error;
    }

    const businessId = profile.business_id;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business is required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("payment_status");
    const deliveryStatus = searchParams.get("delivery_status");
    const conversationId = searchParams.get("conversation_id");
    const customerId = searchParams.get("customer_id");

    let query = supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        business_id,
        customer_id,
        conversation_id,
        order_number,
        customer_name,
        customer_phone,
        items,
        notes,
        subtotal,
        delivery_fee,
        total,
        delivery_address,
        delivery_notes,
        status,
        payment_status,
        delivery_status,
        metadata,
        created_by,
        created_at,
        updated_at
      `
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (status && allowedOrderStatuses.includes(status)) {
      query = query.eq("status", status);
    }

    if (paymentStatus && allowedPaymentStatuses.includes(paymentStatus)) {
      query = query.eq("payment_status", paymentStatus);
    }

    if (deliveryStatus && allowedDeliveryStatuses.includes(deliveryStatus)) {
      query = query.eq("delivery_status", deliveryStatus);
    }

    if (conversationId) {
      query = query.eq("conversation_id", conversationId);
    }

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    const customerIds = Array.from(
      new Set((orders || []).map((item) => item.customer_id).filter(Boolean))
    ) as string[];

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name, type")
      .eq("id", businessId)
      .maybeSingle();

    const { data: customers } =
      customerIds.length > 0
        ? await supabaseAdmin
            .from("customers")
            .select("id, name, phone")
            .eq("business_id", businessId)
            .in("id", customerIds)
        : { data: [] };

    const customerMap = new Map(
      (customers || []).map((customer) => [customer.id, customer])
    );

    const ordersWithDetails = (orders || []).map((order) => {
      const customer = order.customer_id
        ? customerMap.get(order.customer_id)
        : null;

      return {
        ...order,
        business_name: business?.name || null,
        business_type: business?.type || null,
        customer_name: order.customer_name || customer?.name || null,
        customer_phone: order.customer_phone || customer?.phone || null,
      };
    });

    return NextResponse.json({
      orders: ordersWithDetails,
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load orders.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabaseAdmin, profile, user, error } = await requireBusinessUser(
      request
    );

    if (error || !profile || !user) {
      return error;
    }

    const businessId = profile.business_id;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business is required." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as CreateOrderPayload;

    if (body.conversation_id) {
      const { data: conversation, error: conversationError } =
        await supabaseAdmin
          .from("conversations")
          .select("id, business_id")
          .eq("id", body.conversation_id)
          .eq("business_id", businessId)
          .maybeSingle();

      if (conversationError || !conversation) {
        return NextResponse.json(
          { error: "Conversation not found for your business." },
          { status: 404 }
        );
      }
    }

    if (body.customer_id) {
      const { data: customer, error: customerError } = await supabaseAdmin
        .from("customers")
        .select("id, business_id")
        .eq("id", body.customer_id)
        .eq("business_id", businessId)
        .maybeSingle();

      if (customerError || !customer) {
        return NextResponse.json(
          { error: "Customer not found for your business." },
          { status: 404 }
        );
      }
    }

    const items = normalizeItems(body.items);
    const subtotal = calculateSubtotal(items);
    const deliveryFee = normalizeMoney(body.delivery_fee);
    const total = normalizeMoney(subtotal + deliveryFee);

    const status =
      typeof body.status === "string" &&
      allowedOrderStatuses.includes(body.status)
        ? body.status
        : "draft";

    const paymentStatus =
      typeof body.payment_status === "string" &&
      allowedPaymentStatuses.includes(body.payment_status)
        ? body.payment_status
        : "unpaid";

    const deliveryStatus =
      typeof body.delivery_status === "string" &&
      allowedDeliveryStatuses.includes(body.delivery_status)
        ? body.delivery_status
        : deliveryFee > 0
        ? "pending"
        : "not_required";

    const now = new Date().toISOString();

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        business_id: businessId,
        customer_id: body.customer_id || null,
        conversation_id: body.conversation_id || null,
        order_number: makeOrderNumber(),
        customer_name:
          typeof body.customer_name === "string"
            ? body.customer_name.trim()
            : null,
        customer_phone:
          typeof body.customer_phone === "string"
            ? body.customer_phone.trim()
            : null,
        items,
        notes: typeof body.notes === "string" ? body.notes.trim() : null,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        delivery_address:
          typeof body.delivery_address === "string"
            ? body.delivery_address.trim()
            : null,
        delivery_notes:
          typeof body.delivery_notes === "string"
            ? body.delivery_notes.trim()
            : null,
        status,
        payment_status: paymentStatus,
        delivery_status: deliveryStatus,
        metadata: {
          source: "dashboard",
        },
        created_by: user.id,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    return NextResponse.json({
      order,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create order.",
      },
      { status: 500 }
    );
  }
}