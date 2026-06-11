import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type Profile = {
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

async function requireUser(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const token = getBearerToken(request);

  if (!token) {
    return {
      supabaseAdmin,
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
      profile: null,
      error: NextResponse.json(
        { error: "Profile not found." },
        { status: 404 }
      ),
    };
  }

  return {
    supabaseAdmin,
    profile: profile as Profile,
    error: null,
  };
}

function canAccessConversation({
  profile,
  conversation,
}: {
  profile: Profile;
  conversation: Record<string, unknown>;
}) {
  if (profile.role === "super_admin") return true;

  const conversationBusinessId =
    typeof conversation.business_id === "string"
      ? conversation.business_id
      : null;

  const conversationSchoolId =
    typeof conversation.school_id === "string" ? conversation.school_id : null;

  if (
    (profile.role === "business_owner" || profile.role === "staff") &&
    profile.business_id &&
    conversationBusinessId === profile.business_id
  ) {
    return true;
  }

  if (
    (profile.role === "school_admin" || profile.role === "teacher") &&
    profile.school_id &&
    conversationSchoolId === profile.school_id
  ) {
    return true;
  }

  return false;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Conversation ID is required." },
        { status: 400 }
      );
    }

    const { supabaseAdmin, profile, error } = await requireUser(request);

    if (error || !profile) return error;

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("id", id)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: conversationError?.message || "Chat not found." },
        { status: 404 }
      );
    }

    if (!canAccessConversation({ profile, conversation })) {
      return NextResponse.json(
        { error: "You do not have access to this chat." },
        { status: 403 }
      );
    }

    const { data: updatedConversation, error: updateError } =
      await supabaseAdmin
        .from("conversations")
        .update({
          status: "open",
          handoff_status: "resolved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

    if (updateError || !updatedConversation) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to resume AI." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      conversation: updatedConversation,
      message: "AI replies resumed for this chat.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to resume AI.",
      },
      { status: 500 }
    );
  }
}