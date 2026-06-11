import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { requireSchoolUser } from "@/lib/requireSchoolUser";

type SchoolProfilePayload = {
  name?: string;
  type?: string | null;
  description?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  location?: string | null;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildChangeSummary(
  oldSchool: Record<string, unknown>,
  newSchool: Record<string, unknown>
) {
  const fields = [
    "name",
    "type",
    "description",
    "phone",
    "whatsapp",
    "email",
    "location",
  ];

  const changedFields = fields.filter((field) => {
    return (oldSchool[field] || "") !== (newSchool[field] || "");
  });

  if (changedFields.length === 0) {
    return "School profile was saved with no major changes.";
  }

  return `Updated school profile fields: ${changedFields.join(", ")}.`;
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
        location,
        created_at,
        updated_at
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

    return NextResponse.json({
      school,
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load school profile.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabaseAdmin, profile, user, error } = await requireSchoolUser(
      request
    );

    if (error || !profile || !user) {
      return error;
    }

    if (profile.role !== "school_admin") {
      return NextResponse.json(
        { error: "Only school admins can update school profile." },
        { status: 403 }
      );
    }

    const schoolId = profile.school_id;

    if (!schoolId) {
      return NextResponse.json(
        { error: "School is required." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as SchoolProfilePayload;

    const name = cleanText(body.name);

    if (!name) {
      return NextResponse.json(
        { error: "School name is required." },
        { status: 400 }
      );
    }

    const { data: existingSchool, error: existingError } = await supabaseAdmin
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

    if (existingError || !existingSchool) {
      return NextResponse.json(
        { error: "School profile not found." },
        { status: 404 }
      );
    }

    const updatePayload = {
      name,
      type: cleanText(body.type) || null,
      description: cleanText(body.description) || null,
      phone: cleanText(body.phone) || null,
      whatsapp: cleanText(body.whatsapp) || null,
      email: cleanText(body.email) || null,
      location: cleanText(body.location) || null,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedSchool, error: updateError } = await supabaseAdmin
      .from("schools")
      .update(updatePayload)
      .eq("id", schoolId)
      .select(
        `
        id,
        name,
        type,
        description,
        phone,
        whatsapp,
        email,
        location,
        created_at,
        updated_at
      `
      )
      .single();

    if (updateError || !updatedSchool) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to update school profile." },
        { status: 500 }
      );
    }

    await createActivityLog({
      actor_id: user.id,
      business_id: null,
      school_id: schoolId,
      action: "school_profile_updated",
      entity_type: "school",
      entity_id: schoolId,
      title: `School profile updated: ${updatedSchool.name}`,
      description: buildChangeSummary(existingSchool, updatedSchool),
      metadata: {
        school_id: schoolId,
        school_name: updatedSchool.name,
      },
    });

    return NextResponse.json({
      school: updatedSchool,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update school profile.",
      },
      { status: 500 }
    );
  }
}