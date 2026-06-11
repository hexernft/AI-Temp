import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

type UserRole = "super_admin" | "business_owner" | "staff" | string;

type InviteRole = "business_owner" | "staff";

type InviteStatus = "pending" | "accepted" | "expired" | "cancelled";

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
  email: string | null;
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

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function cleanEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

function isValidInviteRole(role: unknown): role is InviteRole {
  return role === "business_owner" || role === "staff";
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

async function getBusiness(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  businessId: string
) {
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, name, type, email")
    .eq("id", businessId)
    .single();

  if (error || !business) {
    return null;
  }

  return business as Business;
}

async function canCreateInviteForBusiness(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  profile: Profile,
  businessId: string,
  invitedRole: InviteRole
) {
  if (profile.role === "super_admin") {
    return true;
  }

  if (profile.role === "business_owner") {
    if (invitedRole !== "staff") {
      return false;
    }

    const business = await getBusiness(supabase, businessId);

    if (!business) {
      return false;
    }

    return profile.business_id === business.id;
  }

  return false;
}

async function getVisibleInviteQuery(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  profile: Profile
) {
  const query = supabase
    .from("business_invites")
    .select(
      `
      id,
      business_id,
      email,
      full_name,
      invited_role,
      status,
      invited_by,
      accepted_by,
      token,
      expires_at,
      created_at,
      updated_at,
      accepted_at,
      business:businesses (
        id,
        name,
        type,
        email
      )
    `
    )
    .order("created_at", { ascending: false });

  if (profile.role === "super_admin") {
    return query;
  }

  if (profile.role === "business_owner") {
    if (!profile.business_id) {
      return null;
    }

    return query.eq("business_id", profile.business_id);
  }

  return query.eq("email", profile.email);
}

export async function GET() {
  try {
    const { supabase, profile, error } = await getCurrentUserAndProfile();

    if (error || !profile) {
      return error;
    }

    const query = await getVisibleInviteQuery(supabase, profile);

    if (!query) {
      return NextResponse.json({
        invites: [],
        profile,
      });
    }

    const { data: invites, error: invitesError } = await query;

    if (invitesError) {
      return NextResponse.json(
        { error: invitesError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      invites: invites || [],
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load invites.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const businessId = cleanText(body.business_id || body.businessId);
    const email = cleanEmail(body.email);
    const fullName = cleanText(body.full_name || body.fullName);
    const invitedRole = cleanText(body.invited_role || body.invitedRole);

    if (!businessId) {
      return NextResponse.json(
        { error: "Business ID is required." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Invite email is required." },
        { status: 400 }
      );
    }

    if (!isValidInviteRole(invitedRole)) {
      return NextResponse.json(
        { error: "Invalid invite role. Use business_owner or staff." },
        { status: 400 }
      );
    }

    const { supabase, profile, error } = await getCurrentUserAndProfile();

    if (error || !profile) {
      return error;
    }

    const business = await getBusiness(supabase, businessId);

    if (!business) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      );
    }

    const canCreate = await canCreateInviteForBusiness(
      supabase,
      profile,
      businessId,
      invitedRole
    );

    if (!canCreate) {
      return NextResponse.json(
        { error: "You do not have permission to create this invite." },
        { status: 403 }
      );
    }

    const { data: existingPendingInvite } = await supabase
      .from("business_invites")
      .select("id")
      .eq("business_id", businessId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingPendingInvite) {
      return NextResponse.json(
        { error: "There is already a pending invite for this email." },
        { status: 409 }
      );
    }

    const { data: invite, error: inviteError } = await supabase
      .from("business_invites")
      .insert({
        business_id: businessId,
        email,
        full_name: fullName || null,
        invited_role: invitedRole,
        status: "pending" as InviteStatus,
        invited_by: profile.id,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
      })
      .select(
        `
        id,
        business_id,
        email,
        full_name,
        invited_role,
        status,
        invited_by,
        accepted_by,
        token,
        expires_at,
        created_at,
        updated_at,
        accepted_at,
        business:businesses (
          id,
          name,
          type,
          email
        )
      `
      )
      .single();

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Invite created successfully.",
      invite,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create invite.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const inviteId = cleanText(body.invite_id || body.inviteId);
    const action = cleanText(body.action);

    if (!inviteId) {
      return NextResponse.json(
        { error: "Invite ID is required." },
        { status: 400 }
      );
    }

    if (action !== "cancel" && action !== "accept") {
      return NextResponse.json(
        { error: "Invalid action. Use cancel or accept." },
        { status: 400 }
      );
    }

    const { supabase, profile, error } = await getCurrentUserAndProfile();

    if (error || !profile) {
      return error;
    }

    const { data: invite, error: inviteError } = await supabase
      .from("business_invites")
      .select(
        `
        id,
        business_id,
        email,
        full_name,
        invited_role,
        status,
        expires_at,
        business:businesses (
          id,
          name,
          type,
          email
        )
      `
      )
      .eq("id", inviteId)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: "Invite not found." },
        { status: 404 }
      );
    }

    const inviteEmail = String(invite.email || "").toLowerCase();
    const profileEmail = String(profile.email || "").toLowerCase();

    if (action === "cancel") {
      const business = Array.isArray(invite.business)
        ? invite.business[0]
        : invite.business;

      const canCancel =
        profile.role === "super_admin" ||
        (profile.role === "business_owner" &&
          profile.business_id === business?.id);

      if (!canCancel) {
        return NextResponse.json(
          { error: "You do not have permission to cancel this invite." },
          { status: 403 }
        );
      }

      if (invite.status !== "pending") {
        return NextResponse.json(
          { error: "Only pending invites can be cancelled." },
          { status: 400 }
        );
      }

      const { data: cancelledInvite, error: cancelError } = await supabase
        .from("business_invites")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", inviteId)
        .select("*")
        .single();

      if (cancelError) {
        return NextResponse.json(
          { error: cancelError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Invite cancelled successfully.",
        invite: cancelledInvite,
      });
    }

    if (action === "accept") {
      if (invite.status !== "pending") {
        return NextResponse.json(
          { error: "Only pending invites can be accepted." },
          { status: 400 }
        );
      }

      if (inviteEmail !== profileEmail) {
        return NextResponse.json(
          { error: "This invite does not belong to your email address." },
          { status: 403 }
        );
      }

      const expiresAt = new Date(invite.expires_at).getTime();

      if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
        await supabase
          .from("business_invites")
          .update({
            status: "expired",
            updated_at: new Date().toISOString(),
          })
          .eq("id", inviteId);

        return NextResponse.json(
          { error: "This invite has expired." },
          { status: 400 }
        );
      }

      if (invite.invited_role === "business_owner") {
        await supabase
          .from("profiles")
          .update({
            role: "business_owner",
            business_id: invite.business_id,
            full_name: profile.full_name || invite.full_name || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id);
      }

      if (invite.invited_role === "staff") {
        await supabase
          .from("profiles")
          .update({
            role: "staff",
            full_name: profile.full_name || invite.full_name || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id);

        const { data: existingAssignment } = await supabase
          .from("business_staff")
          .select("id")
          .eq("business_id", invite.business_id)
          .eq("user_id", profile.id)
          .maybeSingle();

        if (!existingAssignment) {
          await supabase.from("business_staff").insert({
            business_id: invite.business_id,
            user_id: profile.id,
            role: "staff",
          });
        }
      }

      const { data: acceptedInvite, error: acceptError } = await supabase
        .from("business_invites")
        .update({
          status: "accepted",
          accepted_by: profile.id,
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", inviteId)
        .select("*")
        .single();

      if (acceptError) {
        return NextResponse.json(
          { error: acceptError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Invite accepted successfully.",
        invite: acceptedInvite,
      });
    }

    return NextResponse.json(
      { error: "Unsupported invite action." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update invite.",
      },
      { status: 500 }
    );
  }
}