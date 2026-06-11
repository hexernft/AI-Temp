import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type BusinessPayload = {
  name?: string;
  type?: string | null;
  description?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  location?: string | null;
};

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) return null;

  return token;
}

async function requireSuperAdmin(request: Request) {
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

  if (profile.role !== "super_admin") {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        { error: "Only platform admins can access this page." },
        { status: 403 }
      ),
    };
  }

  return {
    supabaseAdmin,
    user,
    profile,
    error: null,
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildChangeSummary(
  oldBusiness: Record<string, unknown>,
  newBusiness: Record<string, unknown>
) {
  const fields = [
    "name",
    "type",
    "description",
    "phone",
    "whatsapp",
    "email",
    "location",
  ];

  const changedFields = fields.filter((field) => {
    return (oldBusiness[field] || "") !== (newBusiness[field] || "");
  });

  if (changedFields.length === 0) {
    return "Business setup was saved with no major changes.";
  }

  return `Updated business setup fields: ${changedFields.join(", ")}.`;
}

async function safeCount(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  businessId: string
) {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

  if (error) return 0;

  return count || 0;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: businessId } = await context.params;

    const { supabaseAdmin, profile, error } = await requireSuperAdmin(request);

    if (error || !profile) {
      return error;
    }

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select(
        `
        id,
        name,
        type,
        description,
        phone,
        whatsapp,
        email,
        location,
        created_at,
        updated_at
      `
      )
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      );
    }

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, role, business_id")
      .eq("business_id", businessId);

    const { data: authUsersData } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    const authUserMap = new Map(
      (authUsersData?.users || []).map((authUser) => [authUser.id, authUser])
    );

    const assignedUsers = (profiles || []).map((profileItem) => {
      const authUser = authUserMap.get(profileItem.id);

      return {
        id: profileItem.id,
        email: authUser?.email || "",
        role: profileItem.role,
        created_at: authUser?.created_at || null,
        last_sign_in_at: authUser?.last_sign_in_at || null,
      };
    });

    const { data: phoneNumbers } = await supabaseAdmin
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
        is_active,
        created_at,
        updated_at
      `
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    const [
      knowledgeCount,
      conversationsCount,
      customersCount,
      ordersCount,
      activePhoneNumberCount,
    ] = await Promise.all([
      safeCount(supabaseAdmin, "business_knowledge", businessId),
      safeCount(supabaseAdmin, "conversations", businessId),
      safeCount(supabaseAdmin, "customers", businessId),
      safeCount(supabaseAdmin, "orders", businessId),
      supabaseAdmin
        .from("business_phone_numbers")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("is_active", true)
        .then(({ count }) => count || 0),
    ]);

    const { data: aiSettings } = await supabaseAdmin
      .from("business_ai_settings")
      .select(
        `
        id,
        business_id,
        auto_reply_enabled,
        handoff_enabled,
        fallback_message,
        created_at,
        updated_at
      `
      )
      .eq("business_id", businessId)
      .maybeSingle();

    const setupChecks = [
      {
        key: "business_profile",
        label: "Business profile",
        ok: Boolean(business.name && business.type),
      },
      {
        key: "contact_details",
        label: "Contact details",
        ok: Boolean(business.phone || business.whatsapp || business.email),
      },
      {
        key: "location",
        label: "Business location",
        ok: Boolean(business.location),
      },
      {
        key: "whatsapp_number",
        label: "Business WhatsApp number connected",
        ok: activePhoneNumberCount > 0,
      },
      {
        key: "assigned_users",
        label: "Business users assigned",
        ok: assignedUsers.length > 0,
      },
      {
        key: "knowledge_base",
        label: "Knowledge base entries",
        ok: knowledgeCount > 0,
      },
      {
        key: "ai_settings",
        label: "AI settings configured",
        ok: Boolean(aiSettings),
      },
    ];

    return NextResponse.json({
      business,
      assignedUsers,
      phoneNumbers: phoneNumbers || [],
      aiSettings: aiSettings || null,
      counts: {
        knowledge: knowledgeCount,
        conversations: conversationsCount,
        customers: customersCount,
        orders: ordersCount,
        active_phone_numbers: activePhoneNumberCount,
      },
      setupChecks,
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load business details.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: businessId } = await context.params;

    const { supabaseAdmin, user, profile, error } = await requireSuperAdmin(
      request
    );

    if (error || !profile || !user) {
      return error;
    }

    const body = (await request.json()) as BusinessPayload;

    const { data: existingBusiness, error: existingError } =
      await supabaseAdmin
        .from("businesses")
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
        `
        )
        .eq("id", businessId)
        .single();

    if (existingError || !existingBusiness) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      );
    }

    const name = cleanText(body.name);

    if (!name) {
      return NextResponse.json(
        { error: "Business name is required." },
        { status: 400 }
      );
    }

    const updatePayload = {
      name,
      type: cleanText(body.type) || null,
      description: cleanText(body.description) || null,
      phone: cleanText(body.phone) || null,
      whatsapp: cleanText(body.whatsapp) || null,
      email: cleanText(body.email) || null,
      location: cleanText(body.location) || null,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedBusiness, error: updateError } = await supabaseAdmin
      .from("businesses")
      .update(updatePayload)
      .eq("id", businessId)
      .select(
        `
        id,
        name,
        type,
        description,
        phone,
        whatsapp,
        email,
        location,
        created_at,
        updated_at
      `
      )
      .single();

    if (updateError || !updatedBusiness) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to update business." },
        { status: 500 }
      );
    }

    await createActivityLog({
      actor_id: user.id,
      business_id: businessId,
      school_id: null,
      action: "business_updated",
      entity_type: "business",
      entity_id: businessId,
      title: `Business updated: ${updatedBusiness.name}`,
      description: buildChangeSummary(existingBusiness, updatedBusiness),
      metadata: {
        business_id: businessId,
        business_name: updatedBusiness.name,
      },
    });

    return NextResponse.json({
      business: updatedBusiness,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update business.",
      },
      { status: 500 }
    );
  }
}