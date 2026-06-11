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
          conversations: [],
          profile,
        });
      }

      allowedBusinessIds = [profile.business_id];
    }

    if (profile.role === "staff") {
      allowedBusinessIds = await getAssignedBusinessIds(supabase, profile.id);

      if (allowedBusinessIds.length === 0) {
        return NextResponse.json({
          conversations: [],
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
        { error: "You do not have permission to view conversations." },
        { status: 403 }
      );
    }

    let query = supabase
      .from("conversations")
      .select(
        `
        id,
        business_id,
        customer_id,
        status,
        handoff_required,
        last_message_at,
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
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (allowedBusinessIds) {
      query = query.in("business_id", allowedBusinessIds);
    }

    const { data: conversations, error: conversationsError } = await query;

    if (conversationsError) {
      return NextResponse.json(
        { error: conversationsError.message },
        { status: 500 }
      );
    }

    const conversationIds =
      conversations?.map((conversation) => conversation.id) || [];

    const { data: messageCounts, error: messageCountsError } =
      conversationIds.length > 0
        ? await supabase
            .from("messages")
            .select("conversation_id")
            .in("conversation_id", conversationIds)
        : { data: [], error: null };

    if (messageCountsError) {
      return NextResponse.json(
        { error: messageCountsError.message },
        { status: 500 }
      );
    }

    const conversationsWithDetails =
      conversations?.map((conversation) => {
        const business = Array.isArray(conversation.business)
          ? conversation.business[0]
          : conversation.business;

        const customer = Array.isArray(conversation.customer)
          ? conversation.customer[0]
          : conversation.customer;

        const messageCount =
          messageCounts?.filter(
            (message) => message.conversation_id === conversation.id
          ).length || 0;

        return {
          id: conversation.id,
          business_id: conversation.business_id,
          customer_id: conversation.customer_id,
          status: conversation.status,
          handoff_required: conversation.handoff_required,
          last_message_at: conversation.last_message_at,
          created_at: conversation.created_at,
          updated_at: conversation.updated_at,

          business_name: business?.name || business?.type || "Business",

          business_type: business?.type || null,

          customer_name: customer?.name || "Unknown Customer",

          customer_phone:
            customer?.whatsapp_number || customer?.phone || "No phone",

          message_count: messageCount,
        };
      }) || [];

    const sortedConversations = conversationsWithDetails.sort((a, b) => {
      const aNeedsHuman = a.status === "needs_human_follow_up" ? 1 : 0;
      const bNeedsHuman = b.status === "needs_human_follow_up" ? 1 : 0;

      if (aNeedsHuman !== bNeedsHuman) {
        return bNeedsHuman - aNeedsHuman;
      }

      const aDate = a.last_message_at
        ? new Date(a.last_message_at).getTime()
        : 0;

      const bDate = b.last_message_at
        ? new Date(b.last_message_at).getTime()
        : 0;

      return bDate - aDate;
    });

    return NextResponse.json({
      conversations: sortedConversations,
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load conversations.",
      },
      { status: 500 }
    );
  }
}