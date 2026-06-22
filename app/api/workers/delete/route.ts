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
        { error: "You must be logged in to delete workers." },
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

    if (!managerProfile.is_active) {
      return NextResponse.json(
        { error: "Your worker account is deactivated." },
        { status: 403 }
      );
    }

    if (!allowedManagerRoles.includes(managerProfile.role)) {
      return NextResponse.json(
        { error: "You do not have permission to delete workers." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const workerId = String(body.id || "").trim();

    if (!workerId) {
      return NextResponse.json(
        { error: "Worker ID is required." },
        { status: 400 }
      );
    }

    if (workerId === user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 }
      );
    }

    const { data: workerProfile, error: workerProfileError } =
      await adminSupabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("id", workerId)
        .maybeSingle();

    if (workerProfileError) {
      return NextResponse.json(
        { error: workerProfileError.message },
        { status: 400 }
      );
    }

    if (!workerProfile) {
      return NextResponse.json(
        { error: "Worker profile could not be found." },
        { status: 404 }
      );
    }

    const { error: unassignError } = await adminSupabase
      .from("first_timers")
      .update({ assigned_to: null })
      .eq("assigned_to", workerId);

    if (unassignError) {
      return NextResponse.json(
        { error: `Could not unassign first timers: ${unassignError.message}` },
        { status: 400 }
      );
    }

    const { error: followUpWorkerError } = await adminSupabase
      .from("follow_ups")
      .update({ worker_id: null })
      .eq("worker_id", workerId);

    if (followUpWorkerError) {
      return NextResponse.json(
        {
          error: `Could not clear follow-up notes: ${followUpWorkerError.message}`,
        },
        { status: 400 }
      );
    }

    const { error: deleteProfileError } = await adminSupabase
      .from("profiles")
      .delete()
      .eq("id", workerId);

    if (deleteProfileError) {
      return NextResponse.json(
        { error: `Could not delete profile: ${deleteProfileError.message}` },
        { status: 400 }
      );
    }

    const { error: deleteAuthError } =
      await adminSupabase.auth.admin.deleteUser(workerId);

    if (deleteAuthError) {
      return NextResponse.json(
        {
          error: `Profile was deleted, but Auth user could not be deleted: ${deleteAuthError.message}`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted_worker: {
        id: workerId,
        full_name: workerProfile.full_name,
        email: workerProfile.email,
        role: workerProfile.role,
      },
    });
  } catch (error) {
    console.error("Delete worker error:", error);

    return NextResponse.json(
      { error: "Something went wrong while deleting the worker." },
      { status: 500 }
    );
  }
}