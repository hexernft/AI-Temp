import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) return null;

  return token;
}

async function getAuthedProfile(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();

  const token = getBearerToken(request);

  if (!token) {
    return {
      supabaseAdmin,
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
      profile: null,
      error: NextResponse.json(
        { error: "Unauthorized. Invalid session." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, business_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      supabaseAdmin,
      profile: null,
      error: NextResponse.json(
        { error: "Profile not found." },
        { status: 404 }
      ),
    };
  }

  return {
    supabaseAdmin,
    profile,
    error: null,
  };
}

function sumMoney(rows: Array<{ total?: number | string | null }>) {
  return rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
}

export async function GET(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await getAuthedProfile(request);

    if (error || !profile) {
      return error;
    }

    const isSuperAdmin = profile.role === "super_admin";
    const businessId = profile.business_id;

    if (!isSuperAdmin && !businessId) {
      return NextResponse.json({
        profile,
        analytics: {
          businesses: 0,
          customers: 0,
          conversations: 0,
          handoffConversations: 0,
          openConversations: 0,
          closedConversations: 0,
          archivedConversations: 0,
          orders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
          paidOrderValue: 0,
          pendingPaymentValue: 0,
          totalOrderValue: 0,
        },
      });
    }

    const businessesQuery = supabaseAdmin
      .from("businesses")
      .select("id", { count: "exact", head: true });

    const customersQuery = supabaseAdmin
      .from("customers")
      .select("id", { count: "exact", head: true });

    const conversationsQuery = supabaseAdmin
      .from("conversations")
      .select("id", { count: "exact", head: true });

    const handoffQuery = supabaseAdmin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("handoff_required", true);

    const openQuery = supabaseAdmin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");

    const closedQuery = supabaseAdmin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("status", "closed");

    const archivedQuery = supabaseAdmin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("status", "archived");

    const ordersQuery = supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true });

    const deliveredOrdersQuery = supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "delivered");

    const cancelledOrdersQuery = supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "cancelled");

    let paidOrdersQuery = supabaseAdmin
      .from("orders")
      .select("total")
      .eq("payment_status", "paid");

    let pendingPaymentOrdersQuery = supabaseAdmin
      .from("orders")
      .select("total")
      .in("payment_status", ["unpaid", "awaiting_confirmation"]);

    let allOrderValueQuery = supabaseAdmin
      .from("orders")
      .select("total")
      .neq("status", "cancelled");

    if (!isSuperAdmin && businessId) {
      customersQuery.eq("business_id", businessId);
      conversationsQuery.eq("business_id", businessId);
      handoffQuery.eq("business_id", businessId);
      openQuery.eq("business_id", businessId);
      closedQuery.eq("business_id", businessId);
      archivedQuery.eq("business_id", businessId);
      ordersQuery.eq("business_id", businessId);
      deliveredOrdersQuery.eq("business_id", businessId);
      cancelledOrdersQuery.eq("business_id", businessId);
      paidOrdersQuery = paidOrdersQuery.eq("business_id", businessId);
      pendingPaymentOrdersQuery = pendingPaymentOrdersQuery.eq(
        "business_id",
        businessId
      );
      allOrderValueQuery = allOrderValueQuery.eq("business_id", businessId);
    }

    const [
      businessesResult,
      customersResult,
      conversationsResult,
      handoffResult,
      openResult,
      closedResult,
      archivedResult,
      ordersResult,
      deliveredOrdersResult,
      cancelledOrdersResult,
      paidOrdersResult,
      pendingPaymentOrdersResult,
      allOrderValueResult,
    ] = await Promise.all([
      isSuperAdmin
        ? businessesQuery
        : Promise.resolve({ count: businessId ? 1 : 0, error: null }),
      customersQuery,
      conversationsQuery,
      handoffQuery,
      openQuery,
      closedQuery,
      archivedQuery,
      ordersQuery,
      deliveredOrdersQuery,
      cancelledOrdersQuery,
      paidOrdersQuery,
      pendingPaymentOrdersQuery,
      allOrderValueQuery,
    ]);

    const firstError =
      businessesResult.error ||
      customersResult.error ||
      conversationsResult.error ||
      handoffResult.error ||
      openResult.error ||
      closedResult.error ||
      archivedResult.error ||
      ordersResult.error ||
      deliveredOrdersResult.error ||
      cancelledOrdersResult.error ||
      paidOrdersResult.error ||
      pendingPaymentOrdersResult.error ||
      allOrderValueResult.error;

    if (firstError) {
      return NextResponse.json({ error: firstError.message }, { status: 500 });
    }

    return NextResponse.json({
      profile,
      analytics: {
        businesses: businessesResult.count || 0,
        customers: customersResult.count || 0,
        conversations: conversationsResult.count || 0,
        handoffConversations: handoffResult.count || 0,
        openConversations: openResult.count || 0,
        closedConversations: closedResult.count || 0,
        archivedConversations: archivedResult.count || 0,
        orders: ordersResult.count || 0,
        deliveredOrders: deliveredOrdersResult.count || 0,
        cancelledOrders: cancelledOrdersResult.count || 0,
        paidOrderValue: sumMoney(paidOrdersResult.data || []),
        pendingPaymentValue: sumMoney(pendingPaymentOrdersResult.data || []),
        totalOrderValue: sumMoney(allOrderValueResult.data || []),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load analytics.",
      },
      { status: 500 }
    );
  }
}