import { NextResponse } from "next/server";
import { requireSchoolUser } from "@/lib/requireSchoolUser";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ActivityPayload = {
  activity_date?: string;
  title?: string | null;
  details?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: pupilId } = await context.params;

    const { supabaseAdmin, profile, user, error } = await requireSchoolUser(
      request
    );

    if (error || !profile || !user) {
      return error;
    }

    const schoolId = profile.school_id;

    if (!schoolId) {
      return NextResponse.json(
        { error: "School is required." },
        { status: 403 }
      );
    }

    const { data: pupil, error: pupilError } = await supabaseAdmin
      .from("pupils")
      .select("id, school_id")
      .eq("id", pupilId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (pupilError || !pupil) {
      return NextResponse.json({ error: "Pupil not found." }, { status: 404 });
    }

    const body = (await request.json()) as ActivityPayload;

    const activityDate =
      typeof body.activity_date === "string" && body.activity_date.trim()
        ? body.activity_date.trim()
        : new Date().toISOString().slice(0, 10);

    const title = cleanText(body.title) || null;
    const details = cleanText(body.details);

    if (!details) {
      return NextResponse.json(
        { error: "Activity details are required." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: activity, error: activityError } = await supabaseAdmin
      .from("pupil_activity_logs")
      .insert({
        school_id: schoolId,
        pupil_id: pupilId,
        activity_date: activityDate,
        title,
        details,
        created_by: user.id,
        created_at: now,
        updated_at: now,
      })
      .select(
        `
        id,
        school_id,
        pupil_id,
        activity_date,
        title,
        details,
        created_by,
        created_at,
        updated_at
      `
      )
      .single();

    if (activityError || !activity) {
      return NextResponse.json(
        { error: activityError?.message || "Failed to add activity." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      activity,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to add activity.",
      },
      { status: 500 }
    );
  }
}