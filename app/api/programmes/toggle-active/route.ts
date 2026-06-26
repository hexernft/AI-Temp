import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const allowedManagerRoles = ["super_admin", "admin", "pastor"];

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase environment variables." },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "You must be logged in to update programmes." },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Your login session could not be verified." },
        { status: 401 }
      );
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: managerProfile, error: managerProfileError } =
      await adminSupabase
        .from("profiles")
        .select("id, role, is_active")
        .eq("id", user.id)
        .single();

    if (managerProfileError || !managerProfile) {
      return NextResponse.json(
        { error: "Your worker profile could not be found." },
        { status: 403 }
      );
    }

    if (
      !managerProfile.is_active ||
      !allowedManagerRoles.includes(managerProfile.role)
    ) {
      return NextResponse.json(
        { error: "You do not have permission to update programmes." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const programmeId = String(body.id || "").trim();
    const isActive = Boolean(body.is_active);

    if (!programmeId) {
      return NextResponse.json(
        { error: "Programme ID is required." },
        { status: 400 }
      );
    }

    const { data: programme, error: updateError } = await adminSupabase
      .from("programmes")
      .update({ is_active: isActive })
      .eq("id", programmeId)
      .select(
        "id, name, slug, description, programme_date, is_active, created_at"
      )
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, programme });
  } catch (error) {
    console.error("Toggle programme active error:", error);

    return NextResponse.json(
      { error: "Something went wrong while updating the programme." },
      { status: 500 }
    );
  }
}
