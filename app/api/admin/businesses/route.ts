import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CreateBusinessPayload = {
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

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
        { error: "Only platform admins can manage businesses." },
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

export async function GET(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireSuperAdmin(request);

    if (error || !profile) {
      return error;
    }

    const { data: businesses, error: businessesError } = await supabaseAdmin
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
      .order("created_at", { ascending: false });

    if (businessesError) {
      return NextResponse.json(
        { error: businessesError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      businesses: businesses || [],
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load businesses.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const {
      supabaseAdmin,
      user,
      profile,
      error,
    } = await requireSuperAdmin(request);

    if (error || !profile || !user) {
      return error;
    }

    const body = (await request.json()) as CreateBusinessPayload;

    const name = cleanText(body.name);
    const type = cleanText(body.type) || null;
    const description = cleanText(body.description) || null;
    const phone = cleanText(body.phone) || null;
    const whatsapp = cleanText(body.whatsapp) || null;
    const email = cleanText(body.email) || null;
    const location = cleanText(body.location) || null;

    if (!name) {
      return NextResponse.json(
        { error: "Business name is required." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: business, error: createError } = await supabaseAdmin
      .from("businesses")
      .insert({
        name,
        type,
        description,
        phone,
        whatsapp,
        email,
        location,
        created_at: now,
        updated_at: now,
      })
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

    if (createError || !business) {
      return NextResponse.json(
        { error: createError?.message || "Failed to create business." },
        { status: 500 }
      );
    }

    await createActivityLog({
      actor_id: user.id,
      business_id: business.id,
      school_id: null,
      action: "business_created",
      entity_type: "business",
      entity_id: business.id,
      title: `Business created: ${business.name}`,
      description: `Created business setup for ${business.name}.`,
      metadata: {
        business_id: business.id,
        business_name: business.name,
        business_type: business.type,
      },
    });

    return NextResponse.json({
      business,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create business.",
      },
      { status: 500 }
    );
  }
}