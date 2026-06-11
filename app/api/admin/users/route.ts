import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CreateUserPayload = {
  email?: string;
  password?: string;
  role?: string;
  business_id?: string | null;
  school_id?: string | null;
};

const allowedAdminCreatedRoles = ["super_admin", "business_owner", "school_admin"];

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) return null;

  return token;
}

function formatRole(role: string) {
  if (role === "super_admin") return "Super Admin";
  if (role === "business_owner") return "Business Owner";
  if (role === "school_admin") return "School Admin";

  return role;
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
        { error: "Only platform admins can manage users." },
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

function isBusinessOwnerRole(role: string) {
  return role === "business_owner";
}

function isSchoolAdminRole(role: string) {
  return role === "school_admin";
}

export async function GET(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireSuperAdmin(request);

    if (error || !profile) {
      return error;
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

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, business_id, school_id");

    if (profilesError) {
      return NextResponse.json(
        { error: profilesError.message },
        { status: 500 }
      );
    }

    const { data: businesses, error: businessesError } = await supabaseAdmin
      .from("businesses")
      .select("id, name")
      .order("name", { ascending: true });

    if (businessesError) {
      return NextResponse.json(
        { error: businessesError.message },
        { status: 500 }
      );
    }

    const { data: schools, error: schoolsError } = await supabaseAdmin
      .from("schools")
      .select("id, name")
      .order("name", { ascending: true });

    if (schoolsError) {
      return NextResponse.json(
        { error: schoolsError.message },
        { status: 500 }
      );
    }

    const profileMap = new Map(
      (profiles || []).map((profileItem) => [profileItem.id, profileItem])
    );

    const users = (authUsersData.users || []).map((authUser) => {
      const userProfile = profileMap.get(authUser.id);

      return {
        id: authUser.id,
        email: authUser.email || "",
        created_at: authUser.created_at || null,
        last_sign_in_at: authUser.last_sign_in_at || null,
        role: userProfile?.role || null,
        business_id: userProfile?.business_id || null,
        school_id: userProfile?.school_id || null,
      };
    });

    return NextResponse.json({
      users,
      businesses: businesses || [],
      schools: schools || [],
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load users.",
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
    } = await requireSuperAdmin(request);

    if (error || !profile || !actorUser) {
      return error;
    }

    const body = (await request.json()) as CreateUserPayload;

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password =
      typeof body.password === "string" ? body.password.trim() : "";
    const role =
      typeof body.role === "string" ? body.role.trim() : "business_owner";

    const businessId =
      typeof body.business_id === "string" && body.business_id.trim()
        ? body.business_id.trim()
        : null;

    const schoolId =
      typeof body.school_id === "string" && body.school_id.trim()
        ? body.school_id.trim()
        : null;

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

    if (!allowedAdminCreatedRoles.includes(role)) {
      return NextResponse.json(
        {
          error:
            "Invalid role selected. Super admin can only create platform admins, business owners, and school admins.",
        },
        { status: 400 }
      );
    }

    if (role === "super_admin" && (businessId || schoolId)) {
      return NextResponse.json(
        { error: "Super admin users should not be assigned to a workspace." },
        { status: 400 }
      );
    }

    if (isBusinessOwnerRole(role) && !businessId) {
      return NextResponse.json(
        { error: "Business is required for business owner accounts." },
        { status: 400 }
      );
    }

    if (isSchoolAdminRole(role) && !schoolId) {
      return NextResponse.json(
        { error: "School is required for school admin accounts." },
        { status: 400 }
      );
    }

    if (isBusinessOwnerRole(role) && businessId) {
      const { data: business, error: businessError } = await supabaseAdmin
        .from("businesses")
        .select("id")
        .eq("id", businessId)
        .maybeSingle();

      if (businessError || !business) {
        return NextResponse.json(
          { error: "Selected business was not found." },
          { status: 404 }
        );
      }
    }

    if (isSchoolAdminRole(role) && schoolId) {
      const { data: school, error: schoolError } = await supabaseAdmin
        .from("schools")
        .select("id")
        .eq("id", schoolId)
        .maybeSingle();

      if (schoolError || !school) {
        return NextResponse.json(
          { error: "Selected school was not found." },
          { status: 404 }
        );
      }
    }

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
          role,
          business_id: isBusinessOwnerRole(role) ? businessId : null,
          school_id: isSchoolAdminRole(role) ? schoolId : null,
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
    let workspaceType: "business" | "school" | "platform" = "platform";

    if (createdProfile.business_id) {
      workspaceType = "business";

      const { data: business } = await supabaseAdmin
        .from("businesses")
        .select("id, name")
        .eq("id", createdProfile.business_id)
        .maybeSingle();

      workspaceName = business?.name || null;
    }

    if (createdProfile.school_id) {
      workspaceType = "school";

      const { data: school } = await supabaseAdmin
        .from("schools")
        .select("id, name")
        .eq("id", createdProfile.school_id)
        .maybeSingle();

      workspaceName = school?.name || null;
    }

    await createActivityLog({
      actor_id: actorUser.id,
      business_id: createdProfile.business_id,
      school_id: createdProfile.school_id,
      action: "user_created",
      entity_type: "user",
      entity_id: userId,
      title: `User created: ${email}`,
      description: `Created ${formatRole(role)} account${
        workspaceName ? ` for ${workspaceName}` : ""
      }.`,
      metadata: {
        created_user_id: userId,
        created_user_email: email,
        role,
        workspace_type: workspaceType,
        business_id: createdProfile.business_id,
        school_id: createdProfile.school_id,
        workspace_name: workspaceName,
      },
    });

    return NextResponse.json({
      user: {
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
          error instanceof Error ? error.message : "Failed to create user.",
      },
      { status: 500 }
    );
  }
}