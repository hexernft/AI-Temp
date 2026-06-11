import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) return null;

  return token;
}

export async function GET(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized. Missing session token." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Invalid session." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, business_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found." },
        { status: 404 }
      );
    }

    let query = supabaseAdmin
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
        businesses (
          id,
          name
        ),
        customers (
          id,
          name,
          phone
        )
      `
      )
      .eq("handoff_required", true)
      .order("last_message_at", { ascending: false });

    if (profile.role !== "super_admin") {
      if (!profile.business_id) {
        return NextResponse.json({
          conversations: [],
          profile,
        });
      }

      query = query.eq("business_id", profile.business_id);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      conversations: data || [],
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load handoff queue.",
      },
      { status: 500 }
    );
  }
}