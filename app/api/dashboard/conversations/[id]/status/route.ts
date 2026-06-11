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

type ConversationStatus = "active" | "needs_human_follow_up";

type Conversation = {
  id: string;
  business_id: string | null;
  status: string | null;
  handoff_required: boolean | null;
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

async function userCanAccessBusiness(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  profile: Profile,
  businessId: string | null
) {
  if (!businessId) return false;

  if (profile.role === "super_admin") {
    return true;
  }

  if (profile.role === "business_owner") {
    return profile.business_id === businessId;
  }

  if (profile.role === "staff") {
    const { data: assignment, error } = await supabase
      .from("business_staff")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (error || !assignment) {
      return false;
    }

    return true;
  }

  return false;
}

function isValidStatus(status: unknown): status is ConversationStatus {
  return status === "active" || status === "needs_human_follow_up";
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await context.params;

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const status = body.status;
    const handoffRequired =
      typeof body.handoff_required === "boolean"
        ? body.handoff_required
        : status === "needs_human_follow_up";

    if (!isValidStatus(status)) {
      return NextResponse.json(
        {
          error:
            "Invalid conversation status. Use active or needs_human_follow_up.",
        },
        { status: 400 }
      );
    }

    const { supabase, profile, error } = await getCurrentUserAndProfile();

    if (error || !profile) {
      return error;
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id, business_id, status, handoff_required")
      .eq("id", conversationId)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    const typedConversation = conversation as Conversation;

    const canAccess = await userCanAccessBusiness(
      supabase,
      profile,
      typedConversation.business_id
    );

    if (!canAccess) {
      return NextResponse.json(
        { error: "You do not have permission to update this conversation." },
        { status: 403 }
      );
    }

    const { data: updatedConversation, error: updateError } = await supabase
      .from("conversations")
      .update({
        status,
        handoff_required: handoffRequired,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .select("id, business_id, status, handoff_required, updated_at")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message:
        status === "needs_human_follow_up"
          ? "AI paused. Conversation marked for human follow-up."
          : "AI resumed for this conversation.",
      conversation: updatedConversation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update conversation status.",
      },
      { status: 500 }
    );
  }
}