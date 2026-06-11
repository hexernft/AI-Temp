import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { requireSchoolUser } from "@/lib/requireSchoolUser";

type PupilPayload = {
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

function getPupilName(pupil: {
  first_name?: string | null;
  last_name?: string | null;
}) {
  return `${pupil.first_name || ""} ${pupil.last_name || ""}`.trim();
}

async function upsertGuardian({
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

export async function GET(request: Request) {
  try {
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

    const { data: pupils, error: pupilsError } = await supabaseAdmin
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
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    if (pupilsError) {
      return NextResponse.json({ error: pupilsError.message }, { status: 500 });
    }

    const pupilIds = (pupils || []).map((pupil) => pupil.id);

    const { data: guardians } =
      pupilIds.length > 0
        ? await supabaseAdmin
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
            .in("pupil_id", pupilIds)
            .order("slot_number", { ascending: true })
        : { data: [] };

    const { data: activityCounts } =
      pupilIds.length > 0
        ? await supabaseAdmin
            .from("pupil_activity_logs")
            .select("id, pupil_id, activity_date")
            .eq("school_id", schoolId)
            .in("pupil_id", pupilIds)
        : { data: [] };

    const guardiansByPupil = new Map<string, typeof guardians>();

    for (const guardian of guardians || []) {
      const existing = guardiansByPupil.get(guardian.pupil_id) || [];
      existing.push(guardian);
      guardiansByPupil.set(guardian.pupil_id, existing);
    }

    const activityCountByPupil = new Map<string, number>();

    for (const activity of activityCounts || []) {
      const current = activityCountByPupil.get(activity.pupil_id) || 0;
      activityCountByPupil.set(activity.pupil_id, current + 1);
    }

    const pupilsWithDetails = (pupils || []).map((pupil) => ({
      ...pupil,
      guardians: guardiansByPupil.get(pupil.id) || [],
      guardian_count: guardiansByPupil.get(pupil.id)?.length || 0,
      activity_count: activityCountByPupil.get(pupil.id) || 0,
    }));

    return NextResponse.json({
      pupils: pupilsWithDetails,
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load pupils.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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

    const body = (await request.json()) as PupilPayload;

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

    const now = new Date().toISOString();

    const { data: pupil, error: pupilError } = await supabaseAdmin
      .from("pupils")
      .insert({
        school_id: schoolId,
        first_name: firstName,
        last_name: lastName,
        class_name: className,
        admission_number: admissionNumber,
        date_of_birth: dateOfBirth,
        notes,
        is_active: isActive,
        created_by: user.id,
        created_at: now,
        updated_at: now,
      })
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

    if (pupilError || !pupil) {
      return NextResponse.json(
        { error: pupilError?.message || "Failed to create pupil." },
        { status: 500 }
      );
    }

    await upsertGuardian({
      supabaseAdmin,
      schoolId,
      pupilId: pupil.id,
      slotNumber: 1,
      guardianName: guardian1Name,
      relationship: guardian1Relationship,
      phone: guardian1Phone,
    });

    await upsertGuardian({
      supabaseAdmin,
      schoolId,
      pupilId: pupil.id,
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
      .eq("pupil_id", pupil.id)
      .order("slot_number", { ascending: true });

    await createActivityLog({
      actor_id: user.id,
      business_id: null,
      school_id: schoolId,
      action: "pupil_created",
      entity_type: "pupil",
      entity_id: pupil.id,
      title: `Pupil created: ${getPupilName(pupil)}`,
      description: `Created pupil profile for ${getPupilName(pupil)}.`,
      metadata: {
        school_id: schoolId,
        pupil_id: pupil.id,
        pupil_name: getPupilName(pupil),
        class_name: pupil.class_name,
        admission_number: pupil.admission_number,
        guardian_slots_added: guardians?.length || 0,
      },
    });

    return NextResponse.json({
      pupil: {
        ...pupil,
        guardians: guardians || [],
        guardian_count: guardians?.length || 0,
        activity_count: 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create pupil.",
      },
      { status: 500 }
    );
  }
}