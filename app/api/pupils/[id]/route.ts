import { NextResponse } from "next/server";
import { requireSchoolUser } from "@/lib/requireSchoolUser";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type PupilUpdatePayload = {
  first_name?: string;
  last_name?: string | null;
  class_name?: string | null;
  admission_number?: string | null;
  date_of_birth?: string | null;
  notes?: string | null;
  is_active?: boolean;

  guardian_1_name?: string | null;
  guardian_1_relationship?: string | null;
  guardian_1_phone?: string | null;

  guardian_2_name?: string | null;
  guardian_2_relationship?: string | null;
  guardian_2_phone?: string | null;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return "";

  return value.replace(/[^\d]/g, "");
}

function cleanDate(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  if (!trimmed) return null;

  return trimmed;
}

async function saveGuardian({
  supabaseAdmin,
  schoolId,
  pupilId,
  slotNumber,
  guardianName,
  relationship,
  phone,
}: {
  supabaseAdmin: ReturnType<
    typeof import("@/lib/supabaseAdmin").getSupabaseAdmin
  >;
  schoolId: string;
  pupilId: string;
  slotNumber: 1 | 2;
  guardianName: string | null;
  relationship: string | null;
  phone: string;
}) {
  if (!phone) {
    await supabaseAdmin
      .from("pupil_guardians")
      .delete()
      .eq("school_id", schoolId)
      .eq("pupil_id", pupilId)
      .eq("slot_number", slotNumber);

    return;
  }

  const now = new Date().toISOString();

  await supabaseAdmin.from("pupil_guardians").upsert(
    {
      school_id: schoolId,
      pupil_id: pupilId,
      slot_number: slotNumber,
      guardian_name: guardianName,
      relationship,
      phone,
      is_active: true,
      updated_at: now,
    },
    {
      onConflict: "pupil_id,slot_number",
    }
  );
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: pupilId } = await context.params;

    const { supabaseAdmin, profile, error } = await requireSchoolUser(request);

    if (error || !profile) {
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
      .select(
        `
        id,
        school_id,
        first_name,
        last_name,
        class_name,
        admission_number,
        date_of_birth,
        notes,
        is_active,
        created_by,
        created_at,
        updated_at
      `
      )
      .eq("id", pupilId)
      .eq("school_id", schoolId)
      .single();

    if (pupilError || !pupil) {
      return NextResponse.json({ error: "Pupil not found." }, { status: 404 });
    }

    const { data: guardians } = await supabaseAdmin
      .from("pupil_guardians")
      .select(
        `
        id,
        school_id,
        pupil_id,
        guardian_name,
        relationship,
        phone,
        slot_number,
        is_active,
        created_at,
        updated_at
      `
      )
      .eq("school_id", schoolId)
      .eq("pupil_id", pupilId)
      .order("slot_number", { ascending: true });

    const { data: activities, error: activitiesError } = await supabaseAdmin
      .from("pupil_activity_logs")
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
      .eq("school_id", schoolId)
      .eq("pupil_id", pupilId)
      .order("activity_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (activitiesError) {
      return NextResponse.json(
        { error: activitiesError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      pupil: {
        ...pupil,
        guardians: guardians || [],
        activities: activities || [],
      },
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load pupil.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: pupilId } = await context.params;

    const { supabaseAdmin, profile, error } = await requireSchoolUser(request);

    if (error || !profile) {
      return error;
    }

    const schoolId = profile.school_id;

    if (!schoolId) {
      return NextResponse.json(
        { error: "School is required." },
        { status: 403 }
      );
    }

    const { data: existingPupil, error: existingError } = await supabaseAdmin
      .from("pupils")
      .select("id, school_id")
      .eq("id", pupilId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (existingError || !existingPupil) {
      return NextResponse.json({ error: "Pupil not found." }, { status: 404 });
    }

    const body = (await request.json()) as PupilUpdatePayload;

    const firstName = cleanText(body.first_name);
    const lastName = cleanText(body.last_name) || null;
    const className = cleanText(body.class_name) || null;
    const admissionNumber = cleanText(body.admission_number) || null;
    const dateOfBirth = cleanDate(body.date_of_birth);
    const notes = cleanText(body.notes) || null;
    const isActive = typeof body.is_active === "boolean" ? body.is_active : true;

    const guardian1Name = cleanText(body.guardian_1_name) || null;
    const guardian1Relationship =
      cleanText(body.guardian_1_relationship) || null;
    const guardian1Phone = normalizePhone(body.guardian_1_phone);

    const guardian2Name = cleanText(body.guardian_2_name) || null;
    const guardian2Relationship =
      cleanText(body.guardian_2_relationship) || null;
    const guardian2Phone = normalizePhone(body.guardian_2_phone);

    if (!firstName) {
      return NextResponse.json(
        { error: "Pupil first name is required." },
        { status: 400 }
      );
    }

    if (guardian1Phone && guardian2Phone && guardian1Phone === guardian2Phone) {
      return NextResponse.json(
        { error: "Authorized phone 1 and phone 2 must be different." },
        { status: 400 }
      );
    }

    const { data: updatedPupil, error: updateError } = await supabaseAdmin
      .from("pupils")
      .update({
        first_name: firstName,
        last_name: lastName,
        class_name: className,
        admission_number: admissionNumber,
        date_of_birth: dateOfBirth,
        notes,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pupilId)
      .eq("school_id", schoolId)
      .select(
        `
        id,
        school_id,
        first_name,
        last_name,
        class_name,
        admission_number,
        date_of_birth,
        notes,
        is_active,
        created_by,
        created_at,
        updated_at
      `
      )
      .single();

    if (updateError || !updatedPupil) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to update pupil." },
        { status: 500 }
      );
    }

    await saveGuardian({
      supabaseAdmin,
      schoolId,
      pupilId,
      slotNumber: 1,
      guardianName: guardian1Name,
      relationship: guardian1Relationship,
      phone: guardian1Phone,
    });

    await saveGuardian({
      supabaseAdmin,
      schoolId,
      pupilId,
      slotNumber: 2,
      guardianName: guardian2Name,
      relationship: guardian2Relationship,
      phone: guardian2Phone,
    });

    const { data: guardians } = await supabaseAdmin
      .from("pupil_guardians")
      .select(
        `
        id,
        school_id,
        pupil_id,
        guardian_name,
        relationship,
        phone,
        slot_number,
        is_active,
        created_at,
        updated_at
      `
      )
      .eq("school_id", schoolId)
      .eq("pupil_id", pupilId)
      .order("slot_number", { ascending: true });

    return NextResponse.json({
      pupil: {
        ...updatedPupil,
        guardians: guardians || [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update pupil.",
      },
      { status: 500 }
    );
  }
}