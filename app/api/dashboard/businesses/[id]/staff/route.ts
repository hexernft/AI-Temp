import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

type StaffRole = "staff" | "manager";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "super_admin" | "business_owner" | "staff" | string;
  business_id: string | null;
};

type Business = {
  id: string;
  name: string | null;
};

function createSupabaseServerClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          const cookieStore = await cookies();
          return cookieStore.getAll();
        },
        async setAll(cookiesToSet) {
          const cookieStore = await cookies();

          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Safe to ignore in route handlers/server rendering edge cases.
          }
        },
      },
    }
  );
}

function isValidStaffRole(role: unknown): role is StaffRole {
  return role === "staff" || role === "manager";
}

function cleanEmail(email: unknown) {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

async function getCurrentUserAndProfile() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      user: null,
      profile: null,
      error: NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, business_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      supabase,
      user,
      profile: null,
      error: NextResponse.json(
        { error: "Profile not found for this account." },
        { status: 403 }
      ),
    };
  }

  return {
    supabase,
    user,
    profile: profile as Profile,
    error: null,
  };
}

async function getBusinessAccess(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  businessId: string,
  profile: Profile
) {
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .single();

  if (businessError || !business) {
    return {
      business: null,
      canManageStaff: false,
      error: NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      ),
    };
  }

  const typedBusiness = business as Business;

  const isSuperAdmin = profile.role === "super_admin";

  const isBusinessOwner =
    profile.role === "business_owner" && profile.business_id === typedBusiness.id;

  const canManageStaff = isSuperAdmin || isBusinessOwner;

  if (!canManageStaff) {
    return {
      business: typedBusiness,
      canManageStaff: false,
      error: NextResponse.json(
        {
          error:
            "You do not have permission to manage staff for this business.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    business: typedBusiness,
    canManageStaff: true,
    error: null,
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await context.params;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business ID is required." },
        { status: 400 }
      );
    }

    const { supabase, profile, error } = await getCurrentUserAndProfile();

    if (error || !profile) {
      return error;
    }

    const access = await getBusinessAccess(supabase, businessId, profile);

    if (access.error) {
      return access.error;
    }

    const { data: staff, error: staffError } = await supabase
      .from("business_staff")
      .select(
        `
        id,
        business_id,
        user_id,
        role,
        created_at,
        updated_at,
        profile:profiles!business_staff_user_id_fkey (
          id,
          email,
          full_name,
          role
        )
      `
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (staffError) {
      return NextResponse.json(
        { error: staffError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      staff: staff || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load business staff.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await context.params;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business ID is required." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const email = cleanEmail(body.email);
    const role = body.role || "staff";

    if (!email) {
      return NextResponse.json(
        { error: "Staff email is required." },
        { status: 400 }
      );
    }

    if (!isValidStaffRole(role)) {
      return NextResponse.json(
        { error: "Invalid staff role. Use staff or manager." },
        { status: 400 }
      );
    }

    const { supabase, profile, error } = await getCurrentUserAndProfile();

    if (error || !profile) {
      return error;
    }

    const access = await getBusinessAccess(supabase, businessId, profile);

    if (access.error) {
      return access.error;
    }

    const { data: staffProfile, error: staffProfileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, business_id")
      .eq("email", email)
      .single();

    if (staffProfileError || !staffProfile) {
      return NextResponse.json(
        {
          error:
            "No user profile was found with that email. Ask the staff member to sign up first, then assign them.",
        },
        { status: 404 }
      );
    }

    if (staffProfile.id === profile.id) {
      return NextResponse.json(
        { error: "You cannot assign yourself as staff." },
        { status: 400 }
      );
    }

    if (staffProfile.role === "super_admin") {
      return NextResponse.json(
        { error: "Super admins do not need staff assignment." },
        { status: 400 }
      );
    }

    const { data: existingAssignment } = await supabase
      .from("business_staff")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", staffProfile.id)
      .maybeSingle();

    if (existingAssignment) {
      return NextResponse.json(
        { error: "This user is already assigned to this business." },
        { status: 409 }
      );
    }

    const { data: assignment, error: insertError } = await supabase
      .from("business_staff")
      .insert({
        business_id: businessId,
        user_id: staffProfile.id,
        role,
      })
      .select(
        `
        id,
        business_id,
        user_id,
        role,
        created_at,
        updated_at,
        profile:profiles!business_staff_user_id_fkey (
          id,
          email,
          full_name,
          role
        )
      `
      )
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Staff member assigned successfully.",
      staff: assignment,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to assign staff member.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await context.params;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business ID is required." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const assignmentId =
      typeof body.assignmentId === "string" ? body.assignmentId : "";

    const role = body.role;

    if (!assignmentId) {
      return NextResponse.json(
        { error: "Assignment ID is required." },
        { status: 400 }
      );
    }

    if (!isValidStaffRole(role)) {
      return NextResponse.json(
        { error: "Invalid staff role. Use staff or manager." },
        { status: 400 }
      );
    }

    const { supabase, profile, error } = await getCurrentUserAndProfile();

    if (error || !profile) {
      return error;
    }

    const access = await getBusinessAccess(supabase, businessId, profile);

    if (access.error) {
      return access.error;
    }

    const { data: updatedAssignment, error: updateError } = await supabase
      .from("business_staff")
      .update({ role })
      .eq("id", assignmentId)
      .eq("business_id", businessId)
      .select(
        `
        id,
        business_id,
        user_id,
        role,
        created_at,
        updated_at,
        profile:profiles!business_staff_user_id_fkey (
          id,
          email,
          full_name,
          role
        )
      `
      )
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Staff role updated successfully.",
      staff: updatedAssignment,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update staff role.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await context.params;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business ID is required." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);

    const assignmentId =
      typeof body?.assignmentId === "string" ? body.assignmentId : "";

    if (!assignmentId) {
      return NextResponse.json(
        { error: "Assignment ID is required." },
        { status: 400 }
      );
    }

    const { supabase, profile, error } = await getCurrentUserAndProfile();

    if (error || !profile) {
      return error;
    }

    const access = await getBusinessAccess(supabase, businessId, profile);

    if (access.error) {
      return access.error;
    }

    const { error: deleteError } = await supabase
      .from("business_staff")
      .delete()
      .eq("id", assignmentId)
      .eq("business_id", businessId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Staff member removed successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove staff member.",
      },
      { status: 500 }
    );
  }
}