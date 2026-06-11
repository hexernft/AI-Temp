import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

type UserRole = "super_admin" | "business_owner" | "staff" | string;

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  business_id: string | null;
};

type Business = {
  id: string;
  name: string | null;
  type: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  location: string | null;
  created_at: string | null;
  updated_at: string | null;
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

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function pickSafeBusinessOwnerFields(body: Record<string, unknown>) {
  const name = cleanText(body.name) || cleanText(body.business_name);
  const type = cleanText(body.type) || cleanText(body.business_type) || cleanText(body.category);
  const phone = cleanText(body.phone);
  const whatsapp = cleanText(body.whatsapp) || cleanText(body.human_handoff_phone);
  const email = cleanText(body.email) || cleanText(body.owner_email);

  return {
    name,
    type,
    description: cleanText(body.description),
    phone,
    whatsapp,
    email,
    location: cleanText(body.location),
    updated_at: new Date().toISOString(),
  };
}

function pickSuperAdminFields(body: Record<string, unknown>) {
  return pickSafeBusinessOwnerFields(body);
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

    const { supabase, profile, error } = await getCurrentUserAndProfile();

    if (error || !profile) {
      return error;
    }

    if (profile.role === "staff") {
      return NextResponse.json(
        { error: "Staff members cannot edit business settings." },
        { status: 403 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      profile.role !== "business_owner"
    ) {
      return NextResponse.json(
        { error: "You do not have permission to update this business." },
        { status: 403 }
      );
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, name, type, description, phone, whatsapp, email, location, created_at, updated_at")
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      );
    }

    const typedBusiness = business as Business;

    if (profile.role === "business_owner") {
      const ownsBusiness = profile.business_id === typedBusiness.id;

      if (!ownsBusiness) {
        return NextResponse.json(
          { error: "You can only update your own business." },
          { status: 403 }
        );
      }
    }

    const updatePayload =
      profile.role === "super_admin"
        ? pickSuperAdminFields(body)
        : pickSafeBusinessOwnerFields(body);

    const { data: updatedBusiness, error: updateError } = await supabase
      .from("businesses")
      .update(updatePayload)
      .eq("id", businessId)
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
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Business updated successfully.",
      business: {
        ...updatedBusiness,
        business_name: updatedBusiness.name,
        business_type: updatedBusiness.type,
        category: updatedBusiness.type,
        owner_email: updatedBusiness.email,
        opening_hours: null,
        tone_instructions: null,
        whatsapp_phone_number_id: null,
        whatsapp_access_token: null,
        human_handoff_phone: updatedBusiness.whatsapp || updatedBusiness.phone,
        knowledge_limit: 50,
        is_active: true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update business.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context);
}