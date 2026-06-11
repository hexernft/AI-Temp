import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SchoolPayload = {
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
  oldSchool: Record<string, unknown>,
  newSchool: Record<string, unknown>
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
    return (oldSchool[field] || "") !== (newSchool[field] || "");
  });

  if (changedFields.length === 0) {
    return "School setup was saved with no major changes.";
  }

  return `Updated school setup fields: ${changedFields.join(", ")}.`;
}

async function safeCount(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  schoolId: string
) {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId);

  if (error) return 0;

  return count || 0;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: schoolId } = await context.params;

    const { supabaseAdmin, profile, error } = await requireSuperAdmin(request);

    if (error || !profile) {
      return error;
    }

    const { data: school, error: schoolError } = await supabaseAdmin
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
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: "School not found." },
        { status: 404 }
      );
    }

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, role, school_id")
      .eq("school_id", schoolId);

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
      .from("school_phone_numbers")
      .select(
        `
        id,
        school_id,
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
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    const [pupilCount, guardianCount, activityCount, activePhoneNumberCount] =
      await Promise.all([
        safeCount(supabaseAdmin, "pupils", schoolId),
        safeCount(supabaseAdmin, "pupil_guardians", schoolId),
        safeCount(supabaseAdmin, "pupil_activity_logs", schoolId),
        supabaseAdmin
          .from("school_phone_numbers")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .then(({ count }) => count || 0),
      ]);

    const setupChecks = [
      {
        key: "school_profile",
        label: "School profile",
        ok: Boolean(school.name && school.type),
      },
      {
        key: "contact_details",
        label: "Contact details",
        ok: Boolean(school.phone || school.whatsapp || school.email),
      },
      {
        key: "location",
        label: "School location",
        ok: Boolean(school.location),
      },
      {
        key: "whatsapp_number",
        label: "School WhatsApp number connected",
        ok: activePhoneNumberCount > 0,
      },
      {
        key: "assigned_users",
        label: "School users assigned",
        ok: assignedUsers.length > 0,
      },
      {
        key: "pupils",
        label: "Pupils added",
        ok: pupilCount > 0,
      },
      {
        key: "guardian_numbers",
        label: "Guardian phone numbers added",
        ok: guardianCount > 0,
      },
    ];

    return NextResponse.json({
      school,
      assignedUsers,
      phoneNumbers: phoneNumbers || [],
      counts: {
        pupils: pupilCount,
        guardian_numbers: guardianCount,
        activity_logs: activityCount,
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
            : "Failed to load school details.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: schoolId } = await context.params;

    const { supabaseAdmin, user, profile, error } = await requireSuperAdmin(
      request
    );

    if (error || !profile || !user) {
      return error;
    }

    const body = (await request.json()) as SchoolPayload;

    const { data: existingSchool, error: existingError } = await supabaseAdmin
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
        location
      `
      )
      .eq("id", schoolId)
      .single();

    if (existingError || !existingSchool) {
      return NextResponse.json(
        { error: "School not found." },
        { status: 404 }
      );
    }

    const name = cleanText(body.name);

    if (!name) {
      return NextResponse.json(
        { error: "School name is required." },
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

    const { data: updatedSchool, error: updateError } = await supabaseAdmin
      .from("schools")
      .update(updatePayload)
      .eq("id", schoolId)
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

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await createActivityLog({
      actor_id: user.id,
      business_id: null,
      school_id: schoolId,
      action: "school_updated",
      entity_type: "school",
      entity_id: schoolId,
      title: `School updated: ${updatedSchool.name}`,
      description: buildChangeSummary(existingSchool, updatedSchool),
      metadata: {
        school_id: schoolId,
        school_name: updatedSchool.name,
      },
    });

    return NextResponse.json({
      school: updatedSchool,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update school.",
      },
      { status: 500 }
    );
  }
}