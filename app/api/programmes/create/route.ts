import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const allowedManagerRoles = ["super_admin", "admin", "pastor"];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
        { error: "You must be logged in to create programmes." },
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
        { error: "You do not have permission to create programmes." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const programmeDate = String(body.programme_date || "").trim() || null;
    const requestedSlug = slugify(String(body.slug || ""));
    const slug = requestedSlug || slugify(name);

    if (!name) {
      return NextResponse.json(
        { error: "Programme name is required." },
        { status: 400 }
      );
    }

    if (!slug) {
      return NextResponse.json(
        { error: "Programme slug could not be generated." },
        { status: 400 }
      );
    }

    const { data: existingProgramme } = await adminSupabase
      .from("programmes")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingProgramme) {
      return NextResponse.json(
        { error: "A programme with this slug already exists." },
        { status: 400 }
      );
    }

    const { data: programme, error: createError } = await adminSupabase
      .from("programmes")
      .insert({
        name,
        slug,
        description,
        programme_date: programmeDate,
        is_active: true,
        created_by: user.id,
      })
      .select(
        "id, name, slug, description, programme_date, is_active, created_at"
      )
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, programme });
  } catch (error) {
    console.error("Create programme error:", error);

    return NextResponse.json(
      { error: "Something went wrong while creating the programme." },
      { status: 500 }
    );
  }
}
