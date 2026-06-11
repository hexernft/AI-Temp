import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

type UserRole = "super_admin" | "business_owner" | "staff" | string;

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  business_id: string | null;
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

async function getAssignedBusinessIds(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  profileId: string
) {
  const { data: assignments, error } = await supabase
    .from("business_staff")
    .select("business_id")
    .eq("user_id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  return assignments?.map((assignment) => assignment.business_id) || [];
}

export async function GET() {
  try {
    const { supabase, profile, error } = await getCurrentUserAndProfile();

    if (error || !profile) {
      return error;
    }

    let allowedBusinessIds: string[] | null = null;

    if (profile.role === "business_owner") {
      if (!profile.business_id) {
        return NextResponse.json({
          leads: [],
          profile,
        });
      }

      allowedBusinessIds = [profile.business_id];
    }

    if (profile.role === "staff") {
      allowedBusinessIds = await getAssignedBusinessIds(supabase, profile.id);

      if (allowedBusinessIds.length === 0) {
        return NextResponse.json({
          leads: [],
          profile,
        });
      }
    }

    if (
      profile.role !== "super_admin" &&
      profile.role !== "business_owner" &&
      profile.role !== "staff"
    ) {
      return NextResponse.json(
        { error: "You do not have permission to view leads." },
        { status: 403 }
      );
    }

    let query = supabase
      .from("leads")
      .select(
        `
        id,
        business_id,
        customer_id,
        conversation_id,
        customer_name,
        whatsapp_number,
        service_requested,
        budget,
        date_needed,
        location,
        notes,
        status,
        created_at,
        updated_at,
        business:businesses (
          id,
          name,
          type,
          email
        ),
        customer:customers (
          id,
          name,
          whatsapp_number,
          phone
        )
      `
      )
      .order("created_at", { ascending: false });

    if (allowedBusinessIds) {
      query = query.in("business_id", allowedBusinessIds);
    }

    const { data: leads, error: leadsError } = await query;

    if (leadsError) {
      return NextResponse.json(
        { error: leadsError.message },
        { status: 500 }
      );
    }

    const formattedLeads =
      leads?.map((lead) => {
        const business = Array.isArray(lead.business)
          ? lead.business[0]
          : lead.business;

        const customer = Array.isArray(lead.customer)
          ? lead.customer[0]
          : lead.customer;

        return {
          id: lead.id,
          business_id: lead.business_id,
          customer_id: lead.customer_id,
          conversation_id: lead.conversation_id,

          customer_name:
            lead.customer_name ||
            customer?.name ||
            "Unknown Customer",

          whatsapp_number:
            lead.whatsapp_number ||
            customer?.whatsapp_number ||
            customer?.phone ||
            "No phone",

          business_name: business?.name || business?.type || "Business",

          business_type: business?.type || null,

          service_requested: lead.service_requested,
          budget: lead.budget,
          date_needed: lead.date_needed,
          location: lead.location,
          notes: lead.notes,
          status: lead.status || "new",
          created_at: lead.created_at,
          updated_at: lead.updated_at,
        };
      }) || [];

    return NextResponse.json({
      leads: formattedLeads,
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load leads.",
      },
      { status: 500 }
    );
  }
}