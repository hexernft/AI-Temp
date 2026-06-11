import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type OrderItem = {
  name?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
};

type OrderSummaryPayload = {
  business_id?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_location?: string;
  delivery_fee?: number | null;
  note?: string | null;
  items?: OrderItem[];
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNumber(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return 0;

  return parsed;
}

function formatNaira(value: unknown) {
  const numberValue = safeNumber(value);

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;

  return `${value.slice(0, maxLength - 3)}...`;
}

function makeText({
  x,
  y,
  text,
  size = 24,
  weight = 400,
  fill = "#0f172a",
  anchor = "start",
}: {
  x: number;
  y: number;
  text: string;
  size?: number;
  weight?: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
}) {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif">${escapeXml(
    text
  )}</text>`;
}

function makeRoundedRect({
  x,
  y,
  width,
  height,
  radius = 24,
  fill,
  stroke,
  strokeWidth = 1,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" ${
    stroke ? `stroke="${stroke}" stroke-width="${strokeWidth}"` : ""
  } />`;
}

function buildOrderSummarySvg({
  businessName,
  customerName,
  customerPhone,
  deliveryLocation,
  items,
  deliveryFee,
  paymentAccount,
  note,
}: {
  businessName: string;
  customerName: string;
  customerPhone: string;
  deliveryLocation: string;
  items: Required<OrderItem>[];
  deliveryFee: number;
  paymentAccount: {
    bank_name: string;
    account_name: string;
    account_number: string;
    payment_note: string | null;
  } | null;
  note: string;
}) {
  const width = 900;
  const itemRowHeight = 48;
  const itemStartY = 312;
  const maxItems = 8;
  const shownItems = items.slice(0, maxItems);
  const extraItems = items.length - shownItems.length;

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const grandTotal = subtotal + deliveryFee;

  const baseHeight = 760;
  const height = baseHeight + Math.max(0, shownItems.length - 3) * itemRowHeight;

  let svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f8fafc" />
  <rect x="0" y="0" width="${width}" height="170" fill="#022c22" />
  <circle cx="790" cy="20" r="130" fill="#10b981" opacity="0.18" />
  <circle cx="100" cy="140" r="90" fill="#34d399" opacity="0.12" />

  ${makeText({
    x: 50,
    y: 70,
    text: truncate(businessName, 38),
    size: 36,
    weight: 800,
    fill: "#ffffff",
  })}
  ${makeText({
    x: 50,
    y: 112,
    text: "Order Summary & Payment Details",
    size: 22,
    weight: 500,
    fill: "#d1fae5",
  })}
  ${makeText({
    x: 850,
    y: 70,
    text: "PAYMENT",
    size: 18,
    weight: 800,
    fill: "#bbf7d0",
    anchor: "end",
  })}

  ${makeRoundedRect({
    x: 40,
    y: 195,
    width: 820,
    height: 94,
    radius: 24,
    fill: "#ffffff",
    stroke: "#e2e8f0",
  })}
  ${makeText({
    x: 70,
    y: 238,
    text: `Customer: ${truncate(customerName || "Not provided", 34)}`,
    size: 22,
    weight: 700,
    fill: "#0f172a",
  })}
  ${makeText({
    x: 70,
    y: 270,
    text: `Phone: ${customerPhone || "Not provided"}`,
    size: 18,
    weight: 500,
    fill: "#64748b",
  })}
  ${makeText({
    x: 500,
    y: 238,
    text: `Delivery: ${truncate(deliveryLocation || "To be confirmed", 30)}`,
    size: 18,
    weight: 500,
    fill: "#334155",
  })}

  ${makeText({
    x: 50,
    y: 335,
    text: "Items",
    size: 24,
    weight: 800,
    fill: "#0f172a",
  })}
  ${makeText({
    x: 685,
    y: 335,
    text: "Qty",
    size: 18,
    weight: 700,
    fill: "#64748b",
    anchor: "middle",
  })}
  ${makeText({
    x: 830,
    y: 335,
    text: "Total",
    size: 18,
    weight: 700,
    fill: "#64748b",
    anchor: "end",
  })}
`;

  let y = itemStartY + 55;

  shownItems.forEach((item, index) => {
    const rowFill = index % 2 === 0 ? "#ffffff" : "#f1f5f9";

    svg += `
  ${makeRoundedRect({
    x: 40,
    y: y - 32,
    width: 820,
    height: 42,
    radius: 14,
    fill: rowFill,
    stroke: "#e2e8f0",
  })}
  ${makeText({
    x: 65,
    y,
    text: truncate(item.name, 42),
    size: 18,
    weight: 600,
    fill: "#0f172a",
  })}
  ${makeText({
    x: 685,
    y,
    text: String(item.quantity),
    size: 18,
    weight: 700,
    fill: "#334155",
    anchor: "middle",
  })}
  ${makeText({
    x: 830,
    y,
    text: formatNaira(item.total),
    size: 18,
    weight: 700,
    fill: "#0f172a",
    anchor: "end",
  })}
`;
    y += itemRowHeight;
  });

  if (extraItems > 0) {
    svg += makeText({
      x: 65,
      y,
      text: `+ ${extraItems} more item(s)`,
      size: 16,
      weight: 600,
      fill: "#64748b",
    });
    y += 40;
  }

  const totalsY = y + 15;
  const paymentY = totalsY + 150;

  svg += `
  ${makeRoundedRect({
    x: 470,
    y: totalsY,
    width: 390,
    height: 120,
    radius: 22,
    fill: "#022c22",
  })}
  ${makeText({
    x: 500,
    y: totalsY + 40,
    text: `Subtotal: ${formatNaira(subtotal)}`,
    size: 20,
    weight: 600,
    fill: "#d1fae5",
  })}
  ${makeText({
    x: 500,
    y: totalsY + 72,
    text: `Delivery: ${deliveryFee > 0 ? formatNaira(deliveryFee) : "To be confirmed"}`,
    size: 18,
    weight: 500,
    fill: "#a7f3d0",
  })}
  ${makeText({
    x: 500,
    y: totalsY + 106,
    text: `Total: ${deliveryFee > 0 ? formatNaira(grandTotal) : `${formatNaira(subtotal)}+`}`,
    size: 24,
    weight: 900,
    fill: "#ffffff",
  })}

  ${makeRoundedRect({
    x: 40,
    y: paymentY,
    width: 820,
    height: 150,
    radius: 26,
    fill: "#ffffff",
    stroke: "#d1d5db",
  })}
  ${makeText({
    x: 70,
    y: paymentY + 42,
    text: "Payment Details",
    size: 24,
    weight: 800,
    fill: "#022c22",
  })}
`;

  if (paymentAccount) {
    svg += `
  ${makeText({
    x: 70,
    y: paymentY + 78,
    text: `Bank: ${truncate(paymentAccount.bank_name, 34)}`,
    size: 19,
    weight: 600,
    fill: "#0f172a",
  })}
  ${makeText({
    x: 70,
    y: paymentY + 108,
    text: `Account Name: ${truncate(paymentAccount.account_name, 38)}`,
    size: 19,
    weight: 600,
    fill: "#0f172a",
  })}
  ${makeText({
    x: 540,
    y: paymentY + 92,
    text: paymentAccount.account_number,
    size: 32,
    weight: 900,
    fill: "#059669",
  })}
  ${makeText({
    x: 70,
    y: paymentY + 135,
    text: truncate(paymentAccount.payment_note || "After payment, please send proof here.", 76),
    size: 15,
    weight: 500,
    fill: "#64748b",
  })}
`;
  } else {
    svg += `
  ${makeText({
    x: 70,
    y: paymentY + 92,
    text: "Payment account has not been added yet.",
    size: 20,
    weight: 600,
    fill: "#ef4444",
  })}
`;
  }

  svg += `
  ${makeText({
    x: 450,
    y: height - 34,
    text: truncate(note || "Thank you for your order.", 88),
    size: 15,
    weight: 500,
    fill: "#64748b",
    anchor: "middle",
  })}
</svg>`;

  return svg.trim();
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = (await request.json()) as OrderSummaryPayload;

    const businessId = cleanText(body.business_id);

    if (!businessId) {
      return NextResponse.json(
        { error: "business_id is required." },
        { status: 400 }
      );
    }

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: businessError?.message || "Business not found." },
        { status: 404 }
      );
    }

    const { data: paymentAccount } = await supabaseAdmin
      .from("business_payment_accounts")
      .select("bank_name, account_name, account_number, payment_note")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const rawItems = Array.isArray(body.items) ? body.items : [];

    const items = rawItems
      .map((item) => {
        const name = cleanText(item.name);
        const quantity = Math.max(1, safeNumber(item.quantity || 1));
        const unitPrice = safeNumber(item.unit_price);
        const total = safeNumber(item.total || unitPrice * quantity);

        if (!name) return null;

        return {
          name,
          quantity,
          unit_price: unitPrice,
          total,
        };
      })
      .filter(Boolean) as Required<OrderItem>[];

    if (!items.length) {
      return NextResponse.json(
        { error: "At least one order item is required." },
        { status: 400 }
      );
    }

    const svg = buildOrderSummarySvg({
      businessName: business.name || "Business",
      customerName: cleanText(body.customer_name),
      customerPhone: cleanText(body.customer_phone),
      deliveryLocation: cleanText(body.delivery_location),
      items,
      deliveryFee: safeNumber(body.delivery_fee),
      paymentAccount: paymentAccount || null,
      note: cleanText(body.note) || "Please send proof of payment after transfer.",
    });

    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate order summary image.",
      },
      { status: 500 }
    );
  }
}