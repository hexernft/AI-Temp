import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateUserPayload = {
  role?: string;
  business_id?: string | null;
};

const allowedRoles = ["super_admin", "business_owner", "staff", "school_admin", "teacher"];

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
      error: NextResponse.json(
        { error: "Unauthorized. Missing session token." },
        { status: 401 }
      ),
      user: null,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return {
      supabaseAdmin,
      error: NextResponse.json(
        { error: "Unauthorized. Invalid session." },
        { status: 401 }
      ),
      user: null,
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      supabaseAdmin,
      error: NextResponse.json(
        { error: "Profile not found." },
        { status: 404 }
      ),
      user: null,
    };
  }

  if (profile.role !== "super_admin") {
    return {
      supabaseAdmin,
      error: NextResponse.json(
        { error: "Only super admins can manage users." },
        { status: 403 }
      ),
      user: null,
    };
  }

  return {
    supabaseAdmin,
    error: null,
    user,
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: userId } = await context.params;

    const { supabaseAdmin, error, user } = await getSuperAdmin(request);

    if (error || !user) {
      return error;
    }

    const body = (await request.json()) as UpdateUserPayload;

    const role = typeof body.role === "string" ? body.role.trim() : "";

    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role selected." },
        { status: 400 }
      );
    }

    const businessId =
      typeof body.business_id === "string" && body.business_id.trim()
        ? body.business_id.trim()
        : null;

    if (role !== "super_admin" && !businessId) {
      return NextResponse.json(
        { error: "Workspace is required for business owners, staff, school admins, and teachers." },
        { status: 400 }
      );
    }

    if (role === "super_admin" && userId === user.id) {
      return NextResponse.json(
        { error: "You cannot edit your own super admin role here." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        role,
        business_id: role === "super_admin" ? null : businessId,
        updated_at: now,
      })
      .eq("id", userId)
      .select("id, role, business_id")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      profile: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update user.",
      },
      { status: 500 }
    );
  }
}