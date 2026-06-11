import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type SchoolUserProfile = {
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

export async function requireSchoolUser(request: Request) {
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

  if (profile.role !== "school_admin" && profile.role !== "teacher") {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        { error: "Only school users can access this resource." },
        { status: 403 }
      ),
    };
  }

  if (!profile.school_id) {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        { error: "This account is not assigned to a school." },
        { status: 403 }
      ),
    };
  }

  return {
    supabaseAdmin,
    user,
    profile: profile as SchoolUserProfile,
    error: null,
  };
}