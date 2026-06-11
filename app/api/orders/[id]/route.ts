import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { requireBusinessUser } from "@/lib/requireBusinessUser";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type OrderItem = {
  name?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
};

type UpdateOrderPayload = {
  customer_name?: string | null;
  customer_phone?: string | null;
  items?: OrderItem[];
  notes?: string | null;
  delivery_address?: string | null;
  delivery_notes?: string | null;
  delivery_fee?: number | string;
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

function formatLabel(value?: string | null) {
  if (!value) return "Unknown";

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildChangeSummary(
  existingOrder: {
    status?: string | null;
    payment_status?: string | null;
    delivery_status?: string | null;
    delivery_fee?: number | string | null;
  },
  updatedOrder: {
    status?: string | null;
    payment_status?: string | null;
    delivery_status?: string | null;
    delivery_fee?: number | string | null;
  }
) {
  const changes: string[] = [];

  if (existingOrder.status !== updatedOrder.status) {
    changes.push(
      `order status from ${formatLabel(existingOrder.status)} to ${formatLabel(
        updatedOrder.status
      )}`
    );
  }

  if (existingOrder.payment_status !== updatedOrder.payment_status) {
    changes.push(
      `payment status from ${formatLabel(
        existingOrder.payment_status
      )} to ${formatLabel(updatedOrder.payment_status)}`
    );
  }

  if (existingOrder.delivery_status !== updatedOrder.delivery_status) {
    changes.push(
      `delivery status from ${formatLabel(
        existingOrder.delivery_status
      )} to ${formatLabel(updatedOrder.delivery_status)}`
    );
  }

  if (
    normalizeMoney(existingOrder.delivery_fee) !==
    normalizeMoney(updatedOrder.delivery_fee)
  ) {
    changes.push(
      `delivery fee from ${normalizeMoney(
        existingOrder.delivery_fee
      )} to ${normalizeMoney(updatedOrder.delivery_fee)}`
    );
  }

  return changes.length > 0
    ? `Changed ${changes.join(", ")}.`
    : "Order details were updated.";
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: orderId } = await context.params;

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

    const { data: existingOrder, error: existingOrderError } =
      await supabaseAdmin
        .from("orders")
        .select(
          `
          id,
          business_id,
          order_number,
          delivery_fee,
          items,
          status,
          payment_status,
          delivery_status
        `
        )
        .eq("id", orderId)
        .eq("business_id", businessId)
        .single();

    if (existingOrderError || !existingOrder) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const body = (await request.json()) as UpdateOrderPayload;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.customer_name === "string") {
      updatePayload.customer_name = body.customer_name.trim() || null;
    }

    if (typeof body.customer_phone === "string") {
      updatePayload.customer_phone = body.customer_phone.trim() || null;
    }

    if (typeof body.notes === "string") {
      updatePayload.notes = body.notes.trim() || null;
    }

    if (typeof body.delivery_address === "string") {
      updatePayload.delivery_address = body.delivery_address.trim() || null;
    }

    if (typeof body.delivery_notes === "string") {
      updatePayload.delivery_notes = body.delivery_notes.trim() || null;
    }

    if (
      typeof body.status === "string" &&
      allowedOrderStatuses.includes(body.status)
    ) {
      updatePayload.status = body.status;
    }

    if (
      typeof body.payment_status === "string" &&
      allowedPaymentStatuses.includes(body.payment_status)
    ) {
      updatePayload.payment_status = body.payment_status;
    }

    if (
      typeof body.delivery_status === "string" &&
      allowedDeliveryStatuses.includes(body.delivery_status)
    ) {
      updatePayload.delivery_status = body.delivery_status;
    }

    const shouldRecalculateItems = Array.isArray(body.items);
    const shouldRecalculateDeliveryFee =
      typeof body.delivery_fee === "number" ||
      typeof body.delivery_fee === "string";

    if (shouldRecalculateItems || shouldRecalculateDeliveryFee) {
      const nextItems = shouldRecalculateItems
        ? normalizeItems(body.items)
        : Array.isArray(existingOrder.items)
        ? existingOrder.items
        : [];

      const nextDeliveryFee = shouldRecalculateDeliveryFee
        ? normalizeMoney(body.delivery_fee)
        : normalizeMoney(existingOrder.delivery_fee);

      const subtotal = calculateSubtotal(nextItems);
      const total = normalizeMoney(subtotal + nextDeliveryFee);

      updatePayload.items = nextItems;
      updatePayload.subtotal = subtotal;
      updatePayload.delivery_fee = nextDeliveryFee;
      updatePayload.total = total;
    }

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId)
      .eq("business_id", businessId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await createActivityLog({
      actor_id: user.id,
      business_id: updatedOrder.business_id,
      action: "order_updated",
      entity_type: "order",
      entity_id: updatedOrder.id,
      title: `Order ${updatedOrder.order_number} updated`,
      description: buildChangeSummary(existingOrder, updatedOrder),
      metadata: {
        order_number: updatedOrder.order_number,
        previous_status: existingOrder.status,
        new_status: updatedOrder.status,
        previous_payment_status: existingOrder.payment_status,
        new_payment_status: updatedOrder.payment_status,
        previous_delivery_status: existingOrder.delivery_status,
        new_delivery_status: updatedOrder.delivery_status,
      },
    });

    return NextResponse.json({
      order: updatedOrder,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update order.",
      },
      { status: 500 }
    );
  }
}