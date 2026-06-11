import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type BusinessProfilePayload = {
  name?: string;
  type?: string | null;
  description?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  location?: string | null;

  public_whatsapp_number?: string | null;
  public_whatsapp_label?: string | null;

  latitude?: string | number | null;
  longitude?: string | number | null;
  delivery_base_fee?: string | number | null;
  delivery_fee_per_km?: string | number | null;
  delivery_free_radius_km?: string | number | null;
  delivery_minimum_fee?: string | number | null;
  delivery_max_radius_km?: string | number | null;
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
  const text = cleanText(value);

  if (!text) return null;

  return text.replace(/[^\d+]/g, "");
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return null;

    const parsed = Number(trimmed);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function zeroNumber(value: unknown) {
  const parsed = nullableNumber(value);

  return parsed === null ? 0 : parsed;
}

async function requireBusinessUser(request: Request) {
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

  if (profile.role !== "business_owner" && profile.role !== "staff") {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        { error: "Only business users can access business profile." },
        { status: 403 }
      ),
    };
  }

  if (!profile.business_id) {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        { error: "This account is not assigned to a business." },
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
    "public_whatsapp_number",
    "public_whatsapp_label",
    "latitude",
    "longitude",
    "delivery_base_fee",
    "delivery_fee_per_km",
    "delivery_free_radius_km",
    "delivery_minimum_fee",
    "delivery_max_radius_km",
  ];

  const changedFields = fields.filter((field) => {
    return (oldBusiness[field] ?? null) !== (newBusiness[field] ?? null);
  });

  if (changedFields.length === 0) {
    return "Business profile was saved with no major changes.";
  }

  return `Updated business profile fields: ${changedFields.join(", ")}.`;
}

export async function GET(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireBusinessUser(request);

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
        public_whatsapp_number,
        public_whatsapp_label,
        latitude,
        longitude,
        delivery_base_fee,
        delivery_fee_per_km,
        delivery_free_radius_km,
        delivery_minimum_fee,
        delivery_max_radius_km,
        created_at,
        updated_at
      `
      )
      .eq("id", profile.business_id)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: "Business profile not found." },
        { status: 404 }
      );
    }

    const { data: aiNumber } = await supabaseAdmin
      .from("business_phone_numbers")
      .select(
        `
        id,
        business_id,
        phone_number,
        phone_number_id,
        display_phone_number,
        verified_name,
        is_active
      `
      )
      .eq("business_id", profile.business_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const cleanAiNumber =
      aiNumber?.phone_number ||
      aiNumber?.display_phone_number ||
      business.whatsapp ||
      null;

    const aiAssistantLink = cleanAiNumber
      ? `https://wa.me/${String(cleanAiNumber).replace(/[^\d]/g, "")}`
      : null;

    return NextResponse.json({
      business,
      profile,
      ai_assistant_number: aiNumber || null,
      ai_assistant_link: aiAssistantLink,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load business profile.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabaseAdmin, user, profile, error } = await requireBusinessUser(
      request
    );

    if (error || !profile || !user) {
      return error;
    }

    if (profile.role !== "business_owner") {
      return NextResponse.json(
        { error: "Only business owners can update business profile." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as BusinessProfilePayload;

    const name = cleanText(body.name);

    if (!name) {
      return NextResponse.json(
        { error: "Business name is required." },
        { status: 400 }
      );
    }

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
          location,
          public_whatsapp_number,
          public_whatsapp_label,
          latitude,
          longitude,
          delivery_base_fee,
          delivery_fee_per_km,
          delivery_free_radius_km,
          delivery_minimum_fee,
          delivery_max_radius_km
        `
        )
        .eq("id", profile.business_id)
        .single();

    if (existingError || !existingBusiness) {
      return NextResponse.json(
        { error: "Business profile not found." },
        { status: 404 }
      );
    }

    const latitude = nullableNumber(body.latitude);
    const longitude = nullableNumber(body.longitude);

    if (latitude !== null && (latitude < -90 || latitude > 90)) {
      return NextResponse.json(
        { error: "Latitude must be between -90 and 90." },
        { status: 400 }
      );
    }

    if (longitude !== null && (longitude < -180 || longitude > 180)) {
      return NextResponse.json(
        { error: "Longitude must be between -180 and 180." },
        { status: 400 }
      );
    }

    const updatePayload = {
      name,
      type: cleanText(body.type) || null,
      description: cleanText(body.description) || null,
      phone: cleanText(body.phone) || null,
      whatsapp: cleanPhone(body.whatsapp),
      email: cleanText(body.email) || null,
      location: cleanText(body.location) || null,
      public_whatsapp_number: cleanPhone(body.public_whatsapp_number),
      public_whatsapp_label:
        cleanText(body.public_whatsapp_label) || "Main WhatsApp / Status number",
      latitude,
      longitude,
      delivery_base_fee: zeroNumber(body.delivery_base_fee),
      delivery_fee_per_km: zeroNumber(body.delivery_fee_per_km),
      delivery_free_radius_km: zeroNumber(body.delivery_free_radius_km),
      delivery_minimum_fee: zeroNumber(body.delivery_minimum_fee),
      delivery_max_radius_km: nullableNumber(body.delivery_max_radius_km),
      updated_at: new Date().toISOString(),
    };

    const { data: updatedBusiness, error: updateError } = await supabaseAdmin
      .from("businesses")
      .update(updatePayload)
      .eq("id", profile.business_id)
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
        public_whatsapp_number,
        public_whatsapp_label,
        latitude,
        longitude,
        delivery_base_fee,
        delivery_fee_per_km,
        delivery_free_radius_km,
        delivery_minimum_fee,
        delivery_max_radius_km,
        created_at,
        updated_at
      `
      )
      .single();

    if (updateError || !updatedBusiness) {
      return NextResponse.json(
        {
          error: updateError?.message || "Failed to update business profile.",
        },
        { status: 500 }
      );
    }

    await createActivityLog({
      actor_id: user.id,
      business_id: profile.business_id,
      school_id: null,
      action: "business_profile_updated",
      entity_type: "business",
      entity_id: profile.business_id,
      title: `Business profile updated: ${updatedBusiness.name}`,
      description: buildChangeSummary(existingBusiness, updatedBusiness),
      metadata: {
        business_id: profile.business_id,
        business_name: updatedBusiness.name,
        public_whatsapp_number: updatedBusiness.public_whatsapp_number,
        delivery_enabled: Boolean(
          updatedBusiness.latitude !== null && updatedBusiness.longitude !== null
        ),
      },
    });

    return NextResponse.json({
      business: updatedBusiness,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update business profile.",
      },
      { status: 500 }
    );
  }
}