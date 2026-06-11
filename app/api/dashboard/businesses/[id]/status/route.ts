import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

type UserRole = "super_admin" | "business_owner" | "staff" | string;

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
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
    .select("id, email, full_name, role")
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

    const isActive =
      typeof body.is_active === "boolean"
        ? body.is_active
        : typeof body.isActive === "boolean"
        ? body.isActive
        : null;

    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "is_active must be true or false." },
        { status: 400 }
      );
    }

    const { supabase, profile, error } = await getCurrentUserAndProfile();

    if (error || !profile) {
      return error;
    }

    if (profile.role !== "super_admin") {
      return NextResponse.json(
        {
          error:
            "Only a super admin can activate or deactivate a business assistant.",
        },
        { status: 403 }
      );
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      );
    }

    const { data: updatedBusiness, error: updateError } = await supabase
      .from("businesses")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId)
      .select("id, name, type, description, phone, whatsapp, email, location, created_at, updated_at")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: isActive
        ? "Business assistant activated successfully."
        : "Business assistant deactivated successfully.",
      business: {
        ...updatedBusiness,
        business_name: updatedBusiness.name,
        business_type: updatedBusiness.type,
        category: updatedBusiness.type,
        owner_email: updatedBusiness.email,
        is_active: isActive,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update business status.",
      },
      { status: 500 }
    );
  }
}