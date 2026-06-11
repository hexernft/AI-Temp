import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Profile = {
  id: string;
  role: string | null;
  business_id: string | null;
  school_id: string | null;
};

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) return null;

  return token;
}

function isBusinessUser(profile: Profile) {
  return profile.role === "business_owner" || profile.role === "staff";
}

function isSchoolUser(profile: Profile) {
  return profile.role === "school_admin" || profile.role === "teacher";
}

async function requireProfile(request: Request) {
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

function getSafeAdminActions() {
  return [
    "business_created",
    "business_updated",
    "school_created",
    "school_updated",
    "user_created",
    "team_member_created",
    "whatsapp_number_created",
    "whatsapp_number_updated",
  ];
}

export async function GET(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireProfile(request);

    if (error || !profile) {
      return error;
    }

    const { searchParams } = new URL(request.url);

    const limitParam = Number(searchParams.get("limit") || "100");
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 200)
      : 100;

    const action = searchParams.get("action");
    const entityType = searchParams.get("entity_type");

    let query = supabaseAdmin
      .from("activity_logs")
      .select(
        `
        id,
        actor_id,
        business_id,
        school_id,
        action,
        entity_type,
        entity_id,
        title,
        description,
        metadata,
        created_at
      `
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (action) {
      query = query.eq("action", action);
    }

    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    if (profile.role === "super_admin") {
      query = query.in("action", getSafeAdminActions());
    } else if (isBusinessUser(profile)) {
      if (!profile.business_id) {
        return NextResponse.json(
          { error: "This account is not assigned to a business." },
          { status: 403 }
        );
      }

      query = query.eq("business_id", profile.business_id);
    } else if (isSchoolUser(profile)) {
      if (!profile.school_id) {
        return NextResponse.json(
          { error: "This account is not assigned to a school." },
          { status: 403 }
        );
      }

      query = query.eq("school_id", profile.school_id);
    } else {
      return NextResponse.json(
        { error: "This role cannot view activity logs." },
        { status: 403 }
      );
    }

    const { data: logs, error: logsError } = await query;

    if (logsError) {
      return NextResponse.json({ error: logsError.message }, { status: 500 });
    }

    const actorIds = Array.from(
      new Set((logs || []).map((log) => log.actor_id).filter(Boolean))
    ) as string[];

    const { data: authUsersData } =
      actorIds.length > 0
        ? await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          })
        : { data: { users: [] } };

    const actorMap = new Map(
      (authUsersData?.users || []).map((authUser) => [
        authUser.id,
        {
          id: authUser.id,
          email: authUser.email || "",
        },
      ])
    );

    const businessIds = Array.from(
      new Set((logs || []).map((log) => log.business_id).filter(Boolean))
    ) as string[];

    const schoolIds = Array.from(
      new Set((logs || []).map((log) => log.school_id).filter(Boolean))
    ) as string[];

    const { data: businesses } =
      businessIds.length > 0
        ? await supabaseAdmin
            .from("businesses")
            .select("id, name")
            .in("id", businessIds)
        : { data: [] };

    const { data: schools } =
      schoolIds.length > 0
        ? await supabaseAdmin
            .from("schools")
            .select("id, name")
            .in("id", schoolIds)
        : { data: [] };

    const businessMap = new Map(
      (businesses || []).map((business) => [business.id, business])
    );

    const schoolMap = new Map(
      (schools || []).map((school) => [school.id, school])
    );

    const logsWithRelations = (logs || []).map((log) => {
      const actor = log.actor_id ? actorMap.get(log.actor_id) : null;
      const business = log.business_id
        ? businessMap.get(log.business_id)
        : null;
      const school = log.school_id ? schoolMap.get(log.school_id) : null;

      return {
        ...log,
        actor,
        business,
        school,
      };
    });

    return NextResponse.json({
      logs: logsWithRelations,
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load activity logs.",
      },
      { status: 500 }
    );
  }
}