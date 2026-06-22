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

    const { data: managerProfile, error: managerProfileError } =
      await adminSupabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

    if (managerProfileError || !managerProfile) {
      return NextResponse.json(
        { error: "Your worker profile could not be found." },
        { status: 403 }
      );
    }

    if (!allowedManagerRoles.includes(managerProfile.role)) {
      return NextResponse.json(
        { error: "You do not have permission to update workers." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const workerId = String(body.id || "").trim();
    const isActive = Boolean(body.is_active);

    if (!workerId) {
      return NextResponse.json(
        { error: "Worker ID is required." },
        { status: 400 }
      );
    }

    if (workerId === user.id && !isActive) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account." },
        { status: 400 }
      );
    }

    const { data: workerProfile, error: workerProfileError } =
      await adminSupabase
        .from("profiles")
        .select("id, full_name, email, role, created_at, is_active")
        .eq("id", workerId)
        .single();

    if (workerProfileError || !workerProfile) {
      return NextResponse.json(
        { error: "Worker profile could not be found." },
        { status: 404 }
      );
    }

    const { data: updatedProfile, error: updateProfileError } =
      await adminSupabase
        .from("profiles")
        .update({
          is_active: isActive,
        })
        .eq("id", workerId)
        .select("id, full_name, email, role, created_at, is_active")
        .single();

    if (updateProfileError) {
      return NextResponse.json(
        { error: updateProfileError.message },
        { status: 400 }
      );
    }

    if (isActive) {
      const { error: authUpdateError } =
        await adminSupabase.auth.admin.updateUserById(workerId, {
          ban_duration: "none",
        });

      if (authUpdateError) {
        return NextResponse.json(
          { error: authUpdateError.message },
          { status: 400 }
        );
      }
    } else {
      const { error: authUpdateError } =
        await adminSupabase.auth.admin.updateUserById(workerId, {
          ban_duration: "876000h",
        });

      if (authUpdateError) {
        return NextResponse.json(
          { error: authUpdateError.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      worker: updatedProfile,
    });
  } catch (error) {
    console.error("Toggle worker active error:", error);

    return NextResponse.json(
      { error: "Something went wrong while updating the worker." },
      { status: 500 }
    );
  }
}