import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Profile = {
  id: string;
  role: string | null;
  business_id: string | null;
  school_id: string | null;
};

type ConversationRow = {
  id: string;
  business_id?: string | null;
  school_id?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  phone?: string | null;
  last_message?: string | null;
  status?: string | null;
  handoff_status?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type CustomerRow = {
  id: string;
  name: string | null;
  phone: string | null;
  whatsapp_number: string | null;
};

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) return null;

  return token;
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

function getConversationScope(profile: Profile) {
  if (profile.role === "super_admin") {
    return {
      canAccess: true,
      column: null,
      value: null,
    };
  }

  if (
    (profile.role === "business_owner" || profile.role === "staff") &&
    profile.business_id
  ) {
    return {
      canAccess: true,
      column: "business_id",
      value: profile.business_id,
    };
  }

  if (
    (profile.role === "school_admin" || profile.role === "teacher") &&
    profile.school_id
  ) {
    return {
      canAccess: true,
      column: "school_id",
      value: profile.school_id,
    };
  }

  return {
    canAccess: false,
    column: null,
    value: null,
  };
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hydrateConversationsWithCustomers({
  conversations,
  customersById,
}: {
  conversations: ConversationRow[];
  customersById: Map<string, CustomerRow>;
}) {
  return conversations.map((conversation) => {
    const customer = conversation.customer_id
      ? customersById.get(conversation.customer_id)
      : null;

    const customerName =
      normalizeText(conversation.customer_name) ||
      normalizeText(customer?.name) ||
      null;

    const customerPhone =
      normalizeText(conversation.customer_phone) ||
      normalizeText(conversation.phone) ||
      normalizeText(customer?.phone) ||
      normalizeText(customer?.whatsapp_number) ||
      null;

    return {
      ...conversation,
      customer_name: customerName,
      customer_phone: customerPhone,
      phone: customerPhone || conversation.phone || null,
    };
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const handoffStatus = searchParams.get("handoff_status");
    const search = normalizeText(searchParams.get("search"));
    const limitParam = Number(searchParams.get("limit") || 50);

    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 50;

    const { supabaseAdmin, profile, error } = await requireUser(request);

    if (error || !profile) {
      return error;
    }

    const scope = getConversationScope(profile);

    if (!scope.canAccess) {
      return NextResponse.json(
        { error: "You do not have access to conversations." },
        { status: 403 }
      );
    }

    let query = supabaseAdmin
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (scope.column && scope.value) {
      query = query.eq(scope.column, scope.value);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (handoffStatus && handoffStatus !== "all") {
      query = query.eq("handoff_status", handoffStatus);
    }

    if (search) {
      query = query.or(
        `customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,phone.ilike.%${search}%,last_message.ilike.%${search}%`
      );
    }

    const { data: conversations, error: conversationsError } = await query;

    if (conversationsError) {
      return NextResponse.json(
        { error: conversationsError.message },
        { status: 500 }
      );
    }

    const conversationRows = (conversations || []) as ConversationRow[];

    const customerIds = Array.from(
      new Set(
        conversationRows
          .map((conversation) => conversation.customer_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    let customersById = new Map<string, CustomerRow>();

    if (customerIds.length > 0) {
      const { data: customers, error: customersError } = await supabaseAdmin
        .from("customers")
        .select("id, name, phone, whatsapp_number")
        .in("id", customerIds);

      if (customersError) {
        return NextResponse.json(
          { error: customersError.message },
          { status: 500 }
        );
      }

      customersById = new Map(
        ((customers || []) as CustomerRow[]).map((customer) => [
          customer.id,
          customer,
        ])
      );
    }

    const hydratedConversations = hydrateConversationsWithCustomers({
      conversations: conversationRows,
      customersById,
    });

    return NextResponse.json({
      conversations: hydratedConversations,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load conversations.",
      },
      { status: 500 }
    );
  }
}