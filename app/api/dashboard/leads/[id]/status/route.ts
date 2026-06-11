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

type LeadStatus =
  | "new"
  | "collecting_details"
  | "qualified"
  | "needs_human_follow_up"
  | "closed";

type Lead = {
  id: string;
  business_id: string | null;
  conversation_id: string | null;
  status: string | null;
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

function isValidLeadStatus(status: unknown): status is LeadStatus {
  return (
    status === "new" ||
    status === "collecting_details" ||
    status === "qualified" ||
    status === "needs_human_follow_up" ||
    status === "closed"
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;

    if (!leadId) {
      return NextResponse.json(
        { error: "Lead ID is required." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const status = body.status;

    if (!isValidLeadStatus(status)) {
      return NextResponse.json(
        {
          error:
            "Invalid lead status. Use new, collecting_details, qualified, needs_human_follow_up, or closed.",
        },
        { status: 400 }
      );
    }

    const { supabase, profile, error } = await getCurrentUserAndProfile();

    if (error || !profile) {
      return error;
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, business_id, conversation_id, status")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: "Lead not found." },
        { status: 404 }
      );
    }

    const typedLead = lead as Lead;

    const canAccess = await userCanAccessBusiness(
      supabase,
      profile,
      typedLead.business_id
    );

    if (!canAccess) {
      return NextResponse.json(
        { error: "You do not have permission to update this lead." },
        { status: 403 }
      );
    }

    const { data: updatedLead, error: updateError } = await supabase
      .from("leads")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    if (
      status === "needs_human_follow_up" &&
      typedLead.conversation_id
    ) {
      await supabase
        .from("conversations")
        .update({
          status: "needs_human_follow_up",
          handoff_required: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", typedLead.conversation_id);
    }

    return NextResponse.json({
      message:
        status === "needs_human_follow_up"
          ? "Lead updated and conversation marked for human follow-up."
          : "Lead status updated successfully.",
      lead: updatedLead,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update lead status.",
      },
      { status: 500 }
    );
  }
}