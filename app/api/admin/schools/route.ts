import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CreateSchoolPayload = {
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
        { error: "Only platform admins can manage schools." },
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

export async function GET(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireSuperAdmin(request);

    if (error || !profile) {
      return error;
    }

    const { data: schools, error: schoolsError } = await supabaseAdmin
      .from("schools")
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

    if (schoolsError) {
      return NextResponse.json(
        { error: schoolsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      schools: schools || [],
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load schools.",
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

    const body = (await request.json()) as CreateSchoolPayload;

    const name = cleanText(body.name);
    const type = cleanText(body.type) || null;
    const description = cleanText(body.description) || null;
    const phone = cleanText(body.phone) || null;
    const whatsapp = cleanText(body.whatsapp) || null;
    const email = cleanText(body.email) || null;
    const location = cleanText(body.location) || null;

    if (!name) {
      return NextResponse.json(
        { error: "School name is required." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: school, error: createError } = await supabaseAdmin
      .from("schools")
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

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    await createActivityLog({
      actor_id: user.id,
      business_id: null,
      school_id: school.id,
      action: "school_created",
      entity_type: "school",
      entity_id: school.id,
      title: `School created: ${school.name}`,
      description: `Created school setup for ${school.name}.`,
      metadata: {
        school_id: school.id,
        school_name: school.name,
        school_type: school.type,
      },
    });

    return NextResponse.json({
      school,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create school.",
      },
      { status: 500 }
    );
  }
}