import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const allowedRoles = [
  "super_admin",
  "admin",
  "pastor",
  "follow_up_coordinator",
  "worker",
  "foundation_school_teacher",
  "baptism_coordinator",
];

const allowedEditorRoles = ["super_admin", "admin", "pastor"];

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "You must be logged in to update workers." },
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

    const { data: editorProfile, error: editorProfileError } =
      await adminSupabase
        .from("profiles")
        .select("id, role, is_active")
        .eq("id", user.id)
        .single();

    if (editorProfileError || !editorProfile) {
      return NextResponse.json(
        { error: "Your worker profile could not be found." },
        { status: 403 }
      );
    }

    if (!editorProfile.is_active) {
      return NextResponse.json(
        { error: "Your worker account is deactivated." },
        { status: 403 }
      );
    }

    if (!allowedEditorRoles.includes(editorProfile.role)) {
      return NextResponse.json(
        { error: "You do not have permission to update workers." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const workerId = String(body.id || "").trim();
    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "worker");

    if (!workerId) {
      return NextResponse.json(
        { error: "Worker ID is required." },
        { status: 400 }
      );
    }

    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Email address is required." },
        { status: 400 }
      );
    }

    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    const { data: existingWorker, error: existingWorkerError } =
      await adminSupabase
        .from("profiles")
        .select("id, role, is_active")
        .eq("id", workerId)
        .single();

    if (existingWorkerError || !existingWorker) {
      return NextResponse.json(
        { error: "Worker profile could not be found." },
        { status: 404 }
      );
    }

    const { data: updatedProfile, error: updateError } = await adminSupabase
      .from("profiles")
      .update({
        full_name: fullName,
        email,
        role,
      })
      .eq("id", workerId)
      .select("id, full_name, email, role, created_at, is_active")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      worker: updatedProfile,
    });
  } catch (error) {
    console.error("Update worker error:", error);

    return NextResponse.json(
      { error: "Something went wrong while updating the worker." },
      { status: 500 }
    );
  }
}