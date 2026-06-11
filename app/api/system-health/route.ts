import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) return null;

  return token;
}

async function getSuperAdmin(request: Request) {
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
    .select("id, role, business_id, school_id")
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

  if (profile.role !== "super_admin") {
    return {
      supabaseAdmin,
      profile,
      error: NextResponse.json(
        { error: "Only super admins can view system health." },
        { status: 403 }
      ),
    };
  }

  return {
    supabaseAdmin,
    profile,
    error: null,
  };
}

function hasEnv(name: string) {
  return Boolean(process.env[name]);
}

function countValue(result: { count: number | null }) {
  return result.count || 0;
}

export async function GET(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await getSuperAdmin(request);

    if (error || !profile) {
      return error;
    }

    const [
      businessesResult,
      schoolsResult,

      businessPhoneNumbersResult,
      activeBusinessPhoneNumbersResult,

      schoolPhoneNumbersResult,
      activeSchoolPhoneNumbersResult,

      knowledgeResult,
      aiSettingsResult,
      conversationsResult,
      ordersResult,

      pupilsResult,
      guardianNumbersResult,
      pupilActivitiesResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("businesses")
        .select("id", { count: "exact", head: true }),

      supabaseAdmin
        .from("schools")
        .select("id", { count: "exact", head: true }),

      supabaseAdmin
        .from("business_phone_numbers")
        .select("id", { count: "exact", head: true }),

      supabaseAdmin
        .from("business_phone_numbers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),

      supabaseAdmin
        .from("school_phone_numbers")
        .select("id", { count: "exact", head: true }),

      supabaseAdmin
        .from("school_phone_numbers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),

      supabaseAdmin
        .from("business_knowledge")
        .select("id", { count: "exact", head: true }),

      supabaseAdmin
        .from("business_ai_settings")
        .select("id", { count: "exact", head: true }),

      supabaseAdmin
        .from("conversations")
        .select("id", { count: "exact", head: true }),

      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true }),

      supabaseAdmin
        .from("pupils")
        .select("id", { count: "exact", head: true }),

      supabaseAdmin
        .from("pupil_guardians")
        .select("id", { count: "exact", head: true }),

      supabaseAdmin
        .from("pupil_activity_logs")
        .select("id", { count: "exact", head: true }),
    ]);

    const firstError =
      businessesResult.error ||
      schoolsResult.error ||
      businessPhoneNumbersResult.error ||
      activeBusinessPhoneNumbersResult.error ||
      schoolPhoneNumbersResult.error ||
      activeSchoolPhoneNumbersResult.error ||
      knowledgeResult.error ||
      aiSettingsResult.error ||
      conversationsResult.error ||
      ordersResult.error ||
      pupilsResult.error ||
      guardianNumbersResult.error ||
      pupilActivitiesResult.error;

    if (firstError) {
      return NextResponse.json({ error: firstError.message }, { status: 500 });
    }

    const envChecks = [
      {
        key: "NEXT_PUBLIC_SUPABASE_URL",
        label: "Supabase URL",
        ok: hasEnv("NEXT_PUBLIC_SUPABASE_URL"),
        required: true,
        group: "environment",
      },
      {
        key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        label: "Supabase anon key",
        ok: hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
        required: true,
        group: "environment",
      },
      {
        key: "SUPABASE_SERVICE_ROLE_KEY",
        label: "Supabase service role key",
        ok: hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
        required: true,
        group: "environment",
      },
      {
        key: "GEMINI_API_KEY",
        label: "Gemini API key",
        ok: hasEnv("GEMINI_API_KEY"),
        required: true,
        group: "environment",
      },
      {
        key: "WHATSAPP_ACCESS_TOKEN",
        label: "WhatsApp access token",
        ok: hasEnv("WHATSAPP_ACCESS_TOKEN"),
        required: true,
        group: "environment",
      },
      {
        key: "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
        label: "WhatsApp webhook verify token",
        ok: hasEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
        required: true,
        group: "environment",
      },
    ];

    const dataChecks = [
      {
        key: "businesses",
        label: "Business workspaces created",
        count: countValue(businessesResult),
        ok: countValue(businessesResult) > 0,
        required: true,
        group: "business",
      },
      {
        key: "business_phone_numbers",
        label: "Business WhatsApp numbers added",
        count: countValue(businessPhoneNumbersResult),
        ok: countValue(businessPhoneNumbersResult) > 0,
        required: false,
        group: "business",
      },
      {
        key: "active_business_phone_numbers",
        label: "Active business WhatsApp numbers",
        count: countValue(activeBusinessPhoneNumbersResult),
        ok: countValue(activeBusinessPhoneNumbersResult) > 0,
        required: false,
        group: "business",
      },
      {
        key: "knowledge",
        label: "Business knowledge base entries",
        count: countValue(knowledgeResult),
        ok: countValue(knowledgeResult) > 0,
        required: false,
        group: "business",
      },
      {
        key: "ai_settings",
        label: "Business AI settings configured",
        count: countValue(aiSettingsResult),
        ok: countValue(aiSettingsResult) > 0,
        required: false,
        group: "business",
      },
      {
        key: "conversations",
        label: "Business conversations captured",
        count: countValue(conversationsResult),
        ok: true,
        required: false,
        group: "business",
      },
      {
        key: "orders",
        label: "Business orders tracked",
        count: countValue(ordersResult),
        ok: true,
        required: false,
        group: "business",
      },

      {
        key: "schools",
        label: "School workspaces created",
        count: countValue(schoolsResult),
        ok: countValue(schoolsResult) > 0,
        required: false,
        group: "school",
      },
      {
        key: "school_phone_numbers",
        label: "School WhatsApp numbers added",
        count: countValue(schoolPhoneNumbersResult),
        ok: countValue(schoolPhoneNumbersResult) > 0,
        required: false,
        group: "school",
      },
      {
        key: "active_school_phone_numbers",
        label: "Active school WhatsApp numbers",
        count: countValue(activeSchoolPhoneNumbersResult),
        ok: countValue(activeSchoolPhoneNumbersResult) > 0,
        required: false,
        group: "school",
      },
      {
        key: "pupils",
        label: "Pupils added",
        count: countValue(pupilsResult),
        ok: countValue(pupilsResult) > 0,
        required: false,
        group: "school",
      },
      {
        key: "guardian_numbers",
        label: "Authorized guardian numbers",
        count: countValue(guardianNumbersResult),
        ok: countValue(guardianNumbersResult) > 0,
        required: false,
        group: "school",
      },
      {
        key: "pupil_activities",
        label: "Pupil activity notes",
        count: countValue(pupilActivitiesResult),
        ok: countValue(pupilActivitiesResult) > 0,
        required: false,
        group: "school",
      },
    ];

    const requiredChecks = [...envChecks, ...dataChecks].filter(
      (check) => check.required
    );

    const readyCount = requiredChecks.filter((check) => check.ok).length;
    const totalRequired = requiredChecks.length;

    const businessReadyCount = dataChecks.filter(
      (check) => check.group === "business" && check.ok
    ).length;

    const businessTotal = dataChecks.filter(
      (check) => check.group === "business"
    ).length;

    const schoolReadyCount = dataChecks.filter(
      (check) => check.group === "school" && check.ok
    ).length;

    const schoolTotal = dataChecks.filter(
      (check) => check.group === "school"
    ).length;

    return NextResponse.json({
      profile,
      summary: {
        readyCount,
        totalRequired,
        isReady: readyCount === totalRequired,
        businessReadyCount,
        businessTotal,
        schoolReadyCount,
        schoolTotal,
      },
      envChecks,
      dataChecks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load system health.",
      },
      { status: 500 }
    );
  }
}