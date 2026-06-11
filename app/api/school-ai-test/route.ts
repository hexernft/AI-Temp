import { NextResponse } from "next/server";
import { generateBusinessReply } from "@/lib/ai";
import { requireSchoolUser } from "@/lib/requireSchoolUser";

type TestPayload = {
  pupil_id?: string;
  guardian_phone?: string;
  message?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhoneNumber(value: string) {
  return value.replace(/[^\d]/g, "");
}

function getPupilName(pupil: {
  first_name?: string | null;
  last_name?: string | null;
}) {
  return `${pupil.first_name || ""} ${pupil.last_name || ""}`.trim();
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

    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .select(
        `
        id,
        name,
        type,
        description,
        phone,
        whatsapp,
        email,
        location
      `
      )
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: "School profile not found." },
        { status: 404 }
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
        created_at,
        updated_at
      `
      )
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("first_name", { ascending: true });

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
              is_active
            `
            )
            .eq("school_id", schoolId)
            .eq("is_active", true)
            .in("pupil_id", pupilIds)
            .order("slot_number", { ascending: true })
        : { data: [] };

    const guardiansByPupil = new Map<string, typeof guardians>();

    for (const guardian of guardians || []) {
      const existing = guardiansByPupil.get(guardian.pupil_id) || [];
      existing.push(guardian);
      guardiansByPupil.set(guardian.pupil_id, existing);
    }

    const pupilsWithGuardians = (pupils || []).map((pupil) => ({
      ...pupil,
      guardians: guardiansByPupil.get(pupil.id) || [],
    }));

    return NextResponse.json({
      school,
      pupils: pupilsWithGuardians,
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load school AI test data.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const body = (await request.json()) as TestPayload;

    const pupilId = cleanText(body.pupil_id);
    const guardianPhone = normalizePhoneNumber(cleanText(body.guardian_phone));
    const message = cleanText(body.message);

    if (!pupilId) {
      return NextResponse.json(
        { error: "Select a pupil first." },
        { status: 400 }
      );
    }

    if (!guardianPhone) {
      return NextResponse.json(
        { error: "Select or enter an authorized guardian phone number." },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "Test message is required." },
        { status: 400 }
      );
    }

    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .select(
        `
        id,
        name,
        type,
        description,
        phone,
        whatsapp,
        email,
        location
      `
      )
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: "School profile not found." },
        { status: 404 }
      );
    }

    const { data: guardian, error: guardianError } = await supabaseAdmin
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
        is_active
      `
      )
      .eq("school_id", schoolId)
      .eq("pupil_id", pupilId)
      .eq("phone", guardianPhone)
      .eq("is_active", true)
      .maybeSingle();

    if (guardianError) {
      return NextResponse.json(
        { error: guardianError.message },
        { status: 500 }
      );
    }

    if (!guardian) {
      return NextResponse.json(
        {
          error:
            "This phone number is not authorized for the selected pupil. The real WhatsApp flow would block this request.",
        },
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
        is_active
      `
      )
      .eq("id", pupilId)
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .single();

    if (pupilError || !pupil) {
      return NextResponse.json(
        { error: "Active pupil not found." },
        { status: 404 }
      );
    }

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
        created_at
      `
      )
      .eq("school_id", schoolId)
      .eq("pupil_id", pupilId)
      .order("activity_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);

    if (activitiesError) {
      return NextResponse.json(
        { error: activitiesError.message },
        { status: 500 }
      );
    }

    const schoolProfileContext = `
School Profile:
Name: ${school.name || "Not set"}
Type: ${school.type || "Not set"}
Phone: ${school.phone || "Not set"}
WhatsApp: ${school.whatsapp || "Not set"}
Email: ${school.email || "Not set"}
Location: ${school.location || "Not set"}
Description: ${school.description || "No description added"}
    `.trim();

    const activityText =
      activities && activities.length > 0
        ? activities
            .map((activity) => {
              return [
                `Date: ${activity.activity_date}`,
                activity.title ? `Title: ${activity.title}` : null,
                `Details: ${activity.details}`,
              ]
                .filter(Boolean)
                .join("\n");
            })
            .join("\n\n")
        : "No activity notes have been added yet.";

    const pupilContext = `
Pupil:
Name: ${getPupilName(pupil)}
Class: ${pupil.class_name || "Not set"}
Admission Number: ${pupil.admission_number || "Not set"}
General Notes: ${pupil.notes || "No general notes"}

Authorized Guardian:
Name: ${guardian.guardian_name || "Not set"}
Relationship: ${guardian.relationship || "Not set"}
Phone: ${guardian.phone}

Activity Notes:
${activityText}
    `.trim();

    const schoolInstructions = `
You are the WhatsApp school assistant for ${school.name}.
This is a safe test environment, but you must follow the same rules as the live WhatsApp flow.
You may only answer using the school profile, selected pupil information, and activity notes provided below.
The selected guardian phone number is authorized only for this selected pupil.
Do not reveal information about any other pupil.
If the question asks for information that is not in the school profile or pupil notes, say that the school has not added that information yet.
If the guardian asks for school contact, location, or general school details, answer from the school profile.
Keep the answer warm, clear, concise, and suitable for a parent or guardian.
    `.trim();

    const aiReply = await generateBusinessReply({
      businessName: school.name,
      customerName: guardian.guardian_name,
      customerMessage: message,
      businessKnowledge: `${schoolInstructions}\n\n${schoolProfileContext}\n\n${pupilContext}`,
      recentMessages: [],
    });

    return NextResponse.json({
      reply: aiReply,
      authorization: {
        authorized: true,
        guardian,
        pupil: {
          id: pupil.id,
          name: getPupilName(pupil),
          class_name: pupil.class_name,
          admission_number: pupil.admission_number,
        },
      },
      context: {
        school_name: school.name,
        activity_count: activities?.length || 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate school AI test reply.",
      },
      { status: 500 }
    );
  }
}