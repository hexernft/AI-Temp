import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CreateTeamMemberPayload = {
  email?: string;
  password?: string;
};

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) return null;

  return token;
}

function formatRole(role: string) {
  if (role === "staff") return "Staff";
  if (role === "teacher") return "Teacher";
  if (role === "business_owner") return "Business Owner";
  if (role === "school_admin") return "School Admin";

  return role;
}

async function requireTeamManager(request: Request) {
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

  if (profile.role !== "business_owner" && profile.role !== "school_admin") {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        {
          error:
            "Only business owners and school admins can manage team members.",
        },
        { status: 403 }
      ),
    };
  }

  if (profile.role === "business_owner" && !profile.business_id) {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        { error: "This business owner is not assigned to a business." },
        { status: 403 }
      ),
    };
  }

  if (profile.role === "school_admin" && !profile.school_id) {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        { error: "This school admin is not assigned to a school." },
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
    const { supabaseAdmin, profile, error } = await requireTeamManager(request);

    if (error || !profile) {
      return error;
    }

    const isBusinessOwner = profile.role === "business_owner";
    const teamRole = isBusinessOwner ? "staff" : "teacher";

    let profilesQuery = supabaseAdmin
      .from("profiles")
      .select("id, role, business_id, school_id")
      .eq("role", teamRole);

    if (isBusinessOwner) {
      profilesQuery = profilesQuery.eq("business_id", profile.business_id);
    } else {
      profilesQuery = profilesQuery.eq("school_id", profile.school_id);
    }

    const { data: teamProfiles, error: teamProfilesError } =
      await profilesQuery;

    if (teamProfilesError) {
      return NextResponse.json(
        { error: teamProfilesError.message },
        { status: 500 }
      );
    }

    const { data: authUsersData, error: authUsersError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (authUsersError) {
      return NextResponse.json(
        { error: authUsersError.message },
        { status: 500 }
      );
    }

    const authUserMap = new Map(
      (authUsersData.users || []).map((authUser) => [authUser.id, authUser])
    );

    const members = (teamProfiles || []).map((teamProfile) => {
      const authUser = authUserMap.get(teamProfile.id);

      return {
        id: teamProfile.id,
        email: authUser?.email || "",
        created_at: authUser?.created_at || null,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        role: teamProfile.role,
        business_id: teamProfile.business_id,
        school_id: teamProfile.school_id,
      };
    });

    let workspace = null;

    if (isBusinessOwner && profile.business_id) {
      const { data: business } = await supabaseAdmin
        .from("businesses")
        .select("id, name")
        .eq("id", profile.business_id)
        .maybeSingle();

      workspace = business
        ? {
            type: "business",
            id: business.id,
            name: business.name,
          }
        : null;
    }

    if (!isBusinessOwner && profile.school_id) {
      const { data: school } = await supabaseAdmin
        .from("schools")
        .select("id, name")
        .eq("id", profile.school_id)
        .maybeSingle();

      workspace = school
        ? {
            type: "school",
            id: school.id,
            name: school.name,
          }
        : null;
    }

    return NextResponse.json({
      members,
      workspace,
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load team.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const {
      supabaseAdmin,
      user: actorUser,
      profile,
      error,
    } = await requireTeamManager(request);

    if (error || !profile || !actorUser) {
      return error;
    }

    const body = (await request.json()) as CreateTeamMemberPayload;

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password =
      typeof body.password === "string" ? body.password.trim() : "";

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const isBusinessOwner = profile.role === "business_owner";
    const memberRole = isBusinessOwner ? "staff" : "teacher";

    const { data: createdUserData, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createUserError || !createdUserData.user) {
      return NextResponse.json(
        {
          error:
            createUserError?.message || "Failed to create authentication user.",
        },
        { status: 500 }
      );
    }

    const userId = createdUserData.user.id;
    const now = new Date().toISOString();

    const { data: createdProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          role: memberRole,
          business_id: isBusinessOwner ? profile.business_id : null,
          school_id: isBusinessOwner ? null : profile.school_id,
          updated_at: now,
        },
        {
          onConflict: "id",
        }
      )
      .select("id, role, business_id, school_id")
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    let workspaceName: string | null = null;

    if (isBusinessOwner && profile.business_id) {
      const { data: business } = await supabaseAdmin
        .from("businesses")
        .select("id, name")
        .eq("id", profile.business_id)
        .maybeSingle();

      workspaceName = business?.name || null;
    }

    if (!isBusinessOwner && profile.school_id) {
      const { data: school } = await supabaseAdmin
        .from("schools")
        .select("id, name")
        .eq("id", profile.school_id)
        .maybeSingle();

      workspaceName = school?.name || null;
    }

    await createActivityLog({
      actor_id: actorUser.id,
      business_id: createdProfile.business_id,
      school_id: createdProfile.school_id,
      action: "team_member_created",
      entity_type: "user",
      entity_id: userId,
      title: `Team member created: ${email}`,
      description: `Created ${formatRole(memberRole)} account${
        workspaceName ? ` for ${workspaceName}` : ""
      }.`,
      metadata: {
        created_user_id: userId,
        created_user_email: email,
        role: memberRole,
        workspace_type: isBusinessOwner ? "business" : "school",
        business_id: createdProfile.business_id,
        school_id: createdProfile.school_id,
        workspace_name: workspaceName,
      },
    });

    return NextResponse.json({
      member: {
        id: createdUserData.user.id,
        email: createdUserData.user.email || email,
        created_at: createdUserData.user.created_at || null,
        last_sign_in_at: createdUserData.user.last_sign_in_at || null,
        role: createdProfile.role,
        business_id: createdProfile.business_id,
        school_id: createdProfile.school_id,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create team member.",
      },
      { status: 500 }
    );
  }
}