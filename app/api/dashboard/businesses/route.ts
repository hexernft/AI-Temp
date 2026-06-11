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

type BusinessRow = {
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

function toDashboardBusiness(business: BusinessRow) {
  return {
    ...business,

    // Backward-compatible aliases for older dashboard pages.
    business_name: business.name,
    business_type: business.type,
    category: business.type,
    owner_email: business.email,
    opening_hours: null,
    tone_instructions: null,
    whatsapp_phone_number_id: null,
    whatsapp_access_token: null,
    human_handoff_phone: business.whatsapp || business.phone,
    knowledge_limit: 50,
    is_active: true,
  };
}

export async function GET() {
  try {
    const { supabase, profile, error } = await getCurrentUserAndProfile();

    if (error || !profile) {
      return error;
    }

    let query = supabase
      .from("businesses")
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
      .order("created_at", { ascending: false });

    if (profile.role === "business_owner") {
      if (!profile.business_id) {
        return NextResponse.json({ businesses: [], profile });
      }

      query = query.eq("id", profile.business_id);
    }

    if (profile.role === "staff") {
      const assignedBusinessIds = await getAssignedBusinessIds(
        supabase,
        profile.id
      );

      if (assignedBusinessIds.length === 0) {
        return NextResponse.json({ businesses: [], profile });
      }

      query = query.in("id", assignedBusinessIds);
    }

    if (
      profile.role !== "super_admin" &&
      profile.role !== "business_owner" &&
      profile.role !== "staff"
    ) {
      return NextResponse.json(
        { error: "You do not have permission to view businesses." },
        { status: 403 }
      );
    }

    const { data: businesses, error: businessesError } = await query;

    if (businessesError) {
      return NextResponse.json(
        { error: businessesError.message },
        { status: 500 }
      );
    }

    const businessIds = businesses?.map((business) => business.id) || [];

    const [conversationsResult, leadsResult, knowledgeResult, phoneResult] =
      businessIds.length > 0
        ? await Promise.all([
            supabase
              .from("conversations")
              .select("id, business_id, status")
              .in("business_id", businessIds),
            supabase
              .from("leads")
              .select("id, business_id, status")
              .in("business_id", businessIds),
            supabase
              .from("business_knowledge")
              .select("id, business_id")
              .in("business_id", businessIds),
            supabase
              .from("business_phone_numbers")
              .select("id, business_id, is_active")
              .in("business_id", businessIds),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
          ];

    if (conversationsResult.error) {
      return NextResponse.json(
        { error: conversationsResult.error.message },
        { status: 500 }
      );
    }

    if (leadsResult.error) {
      return NextResponse.json(
        { error: leadsResult.error.message },
        { status: 500 }
      );
    }

    const conversations = conversationsResult.data || [];
    const leads = leadsResult.data || [];
    const knowledgeItems = knowledgeResult.data || [];
    const phoneNumbers = phoneResult.data || [];

    const businessesWithStats =
      businesses?.map((business) => {
        const normalizedBusiness = toDashboardBusiness(business as BusinessRow);

        const businessConversations = conversations.filter(
          (conversation) => conversation.business_id === business.id
        );

        const businessLeads = leads.filter(
          (lead) => lead.business_id === business.id
        );

        const businessKnowledgeItems = knowledgeItems.filter(
          (item) => item.business_id === business.id
        );

        const activePhoneNumbers = phoneNumbers.filter(
          (number) => number.business_id === business.id && number.is_active
        );

        const checklist = [
          Boolean(business.name),
          Boolean(business.type || business.location || business.description),
          Boolean(business.phone || business.whatsapp || business.email),
          activePhoneNumbers.length > 0,
          businessKnowledgeItems.length > 0,
        ];

        const completedItems = checklist.filter(Boolean).length;
        const setupPercentage = Math.round(
          (completedItems / checklist.length) * 100
        );

        return {
          ...normalizedBusiness,
          conversations_count: businessConversations.length,
          leads_count: businessLeads.length,
          human_follow_up_count: businessConversations.filter(
            (conversation) =>
              conversation.status === "needs_human_follow_up"
          ).length,
          qualified_leads_count: businessLeads.filter(
            (lead) => lead.status === "qualified"
          ).length,
          knowledge_items_count: businessKnowledgeItems.length,
          setup_percentage: setupPercentage,
        };
      }) || [];

    return NextResponse.json({
      businesses: businessesWithStats,
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load businesses.",
      },
      { status: 500 }
    );
  }
}
