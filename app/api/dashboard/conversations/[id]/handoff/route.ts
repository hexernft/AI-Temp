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

type Conversation = {
  id: string;
  business_id: string | null;
  customer_id: string | null;
  status: string | null;
  handoff_required: boolean | null;
  ai_paused: boolean | null;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
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
      profile: null,
      error: NextResponse.json(
        { error: "Profile not found for this account." },
        { status: 403 }
      ),
    };
  }

  return {
    supabase,
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

async function saveSystemMessage(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  conversation: Conversation,
  content: string,
  profile: Profile
) {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversation.id,
    business_id: conversation.business_id,
    customer_id: conversation.customer_id,
    sender: "system",
    role: "system",
    content,
    message_text: content,
    message: content,
    direction: "system",
    message_type: "system",
    metadata: {
      source: "handoff_action",
      actor_profile_id: profile.id,
      actor_email: profile.email,
      actor_role: profile.role,
    },
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("saveSystemMessage error:", error.message);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: conversationId } = await context.params;

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : "Manual handoff requested.";

    const assignToMe = Boolean(body.assignToMe);

    const { supabase, profile, error } = await getCurrentUserAndProfile();

    if (error || !profile) {
      return error;
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select(
        "id, business_id, customer_id, status, handoff_required, ai_paused"
      )
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

    const updatePayload: Record<string, string | boolean | null> = {
      handoff_required: true,
      status: "needs_human_follow_up",
      ai_paused: true,
      handoff_reason: reason,
      handoff_triggered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (assignToMe) {
      updatePayload.assigned_to = profile.id;
    }

    const { data: updatedConversation, error: updateError } = await supabase
      .from("conversations")
      .update(updatePayload)
      .eq("id", conversationId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await saveSystemMessage(
      supabase,
      typedConversation,
      assignToMe
        ? `Human handoff started and assigned to ${profile.full_name || profile.email || "staff"}. Reason: ${reason}`
        : `Human handoff started. Reason: ${reason}`,
      profile
    );

    return NextResponse.json({
      message: "Human handoff started successfully.",
      conversation: updatedConversation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start human handoff.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  return PATCH(request, context);
}