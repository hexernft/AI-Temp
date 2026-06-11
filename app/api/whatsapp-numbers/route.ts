import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type WorkspaceType = "business" | "school";

type WhatsAppNumberDeletePayload = {
  id?: string;
  workspace_type?: WorkspaceType;
  confirmation_text?: string;
};

type WhatsAppNumberPayload = {
  workspace_type?: WorkspaceType;
  business_id?: string | null;
  school_id?: string | null;
  phone_number?: string;
  phone_number_id?: string;
  display_phone_number?: string | null;
  verified_name?: string | null;
  provider?: string | null;
  is_active?: boolean;
};

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) return null;

  return token;
}

async function requireSuperAdmin(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();

  const token = getBearerToken(request);

  if (!token) {
    return {
      supabaseAdmin,
      user: null,
      profile: null,
      error: NextResponse.json(
        { error: "Unauthorized. Missing session token." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return {
      supabaseAdmin,
      user: null,
      profile: null,
      error: NextResponse.json(
        { error: "Unauthorized. Invalid session." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, business_id, school_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      supabaseAdmin,
      user,
      profile: null,
      error: NextResponse.json(
        { error: "Profile not found." },
        { status: 404 }
      ),
    };
  }

  if (profile.role !== "super_admin") {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        { error: "Only platform admins can manage WhatsApp numbers." },
        { status: 403 }
      ),
    };
  }

  return {
    supabaseAdmin,
    user,
    profile,
    error: null,
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhoneNumber(value: string) {
  return value.replace(/[^\d]/g, "");
}

function buildChangeSummary(
  existingNumber: Record<string, unknown> | null,
  workspaceType: WorkspaceType
) {
  if (!existingNumber) {
    return `WhatsApp number was connected to a ${workspaceType} workspace.`;
  }

  return `WhatsApp number setup was updated for a ${workspaceType} workspace.`;
}

export async function GET(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireSuperAdmin(request);

    if (error || !profile) {
      return error;
    }

    const { data: businesses, error: businessesError } = await supabaseAdmin
      .from("businesses")
      .select("id, name")
      .order("name", { ascending: true });

    if (businessesError) {
      return NextResponse.json(
        { error: businessesError.message },
        { status: 500 }
      );
    }

    const { data: schools, error: schoolsError } = await supabaseAdmin
      .from("schools")
      .select("id, name")
      .order("name", { ascending: true });

    if (schoolsError) {
      return NextResponse.json(
        { error: schoolsError.message },
        { status: 500 }
      );
    }

    const { data: businessNumbers, error: businessNumbersError } =
      await supabaseAdmin
        .from("business_phone_numbers")
        .select(
          `
          id,
          business_id,
          phone_number,
          phone_number_id,
          display_phone_number,
          verified_name,
          provider,
          is_active,
          created_at,
          updated_at
        `
        )
        .order("created_at", { ascending: false });

    if (businessNumbersError) {
      return NextResponse.json(
        { error: businessNumbersError.message },
        { status: 500 }
      );
    }

    const { data: schoolNumbers, error: schoolNumbersError } =
      await supabaseAdmin
        .from("school_phone_numbers")
        .select(
          `
          id,
          school_id,
          phone_number,
          phone_number_id,
          display_phone_number,
          verified_name,
          provider,
          is_active,
          created_at,
          updated_at
        `
        )
        .order("created_at", { ascending: false });

    if (schoolNumbersError) {
      return NextResponse.json(
        { error: schoolNumbersError.message },
        { status: 500 }
      );
    }

    const businessMap = new Map(
      (businesses || []).map((business) => [business.id, business])
    );

    const schoolMap = new Map(
      (schools || []).map((school) => [school.id, school])
    );

    const normalizedBusinessNumbers = (businessNumbers || []).map((item) => {
      const business = item.business_id
        ? businessMap.get(item.business_id)
        : null;

      return {
        id: item.id,
        workspace_type: "business" as WorkspaceType,
        workspace_id: item.business_id,
        workspace_name: business?.name || null,
        business_id: item.business_id,
        school_id: null,
        phone_number: item.phone_number,
        phone_number_id: item.phone_number_id,
        display_phone_number: item.display_phone_number,
        verified_name: item.verified_name,
        provider: item.provider,
        is_active: item.is_active,
        created_at: item.created_at,
        updated_at: item.updated_at,
      };
    });

    const normalizedSchoolNumbers = (schoolNumbers || []).map((item) => {
      const school = item.school_id ? schoolMap.get(item.school_id) : null;

      return {
        id: item.id,
        workspace_type: "school" as WorkspaceType,
        workspace_id: item.school_id,
        workspace_name: school?.name || null,
        business_id: null,
        school_id: item.school_id,
        phone_number: item.phone_number,
        phone_number_id: item.phone_number_id,
        display_phone_number: item.display_phone_number,
        verified_name: item.verified_name,
        provider: item.provider,
        is_active: item.is_active,
        created_at: item.created_at,
        updated_at: item.updated_at,
      };
    });

    const numbers = [
      ...normalizedBusinessNumbers,
      ...normalizedSchoolNumbers,
    ].sort((a, b) => {
      return (
        new Date(b.created_at || "").getTime() -
        new Date(a.created_at || "").getTime()
      );
    });

    return NextResponse.json({
      numbers,
      businesses: businesses || [],
      schools: schools || [],
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load WhatsApp numbers.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const {
      supabaseAdmin,
      user,
      profile,
      error,
    } = await requireSuperAdmin(request);

    if (error || !profile || !user) {
      return error;
    }

    const body = (await request.json()) as WhatsAppNumberPayload;

    const workspaceType: WorkspaceType =
      body.workspace_type === "school" ? "school" : "business";

    const businessId = cleanText(body.business_id);
    const schoolId = cleanText(body.school_id);

    const phoneNumber = normalizePhoneNumber(cleanText(body.phone_number));
    const phoneNumberId = cleanText(body.phone_number_id);
    const displayPhoneNumber = cleanText(body.display_phone_number) || null;
    const verifiedName = cleanText(body.verified_name) || null;
    const provider = cleanText(body.provider) || "whatsapp_cloud_api";
    const isActive =
      typeof body.is_active === "boolean" ? body.is_active : true;

    if (workspaceType === "business" && !businessId) {
      return NextResponse.json(
        { error: "Business is required." },
        { status: 400 }
      );
    }

    if (workspaceType === "school" && !schoolId) {
      return NextResponse.json(
        { error: "School is required." },
        { status: 400 }
      );
    }

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "WhatsApp phone number is required." },
        { status: 400 }
      );
    }

    if (!phoneNumberId) {
      return NextResponse.json(
        { error: "Meta Phone Number ID is required." },
        { status: 400 }
      );
    }

    let workspaceName = "";
    let tableName: "business_phone_numbers" | "school_phone_numbers";
    let idColumn: "business_id" | "school_id";
    let workspaceId: string;

    if (workspaceType === "business") {
      const { data: business, error: businessError } = await supabaseAdmin
        .from("businesses")
        .select("id, name")
        .eq("id", businessId)
        .maybeSingle();

      if (businessError || !business) {
        return NextResponse.json(
          { error: "Selected business was not found." },
          { status: 404 }
        );
      }

      workspaceName = business.name || "Business";
      tableName = "business_phone_numbers";
      idColumn = "business_id";
      workspaceId = business.id;
    } else {
      const { data: school, error: schoolError } = await supabaseAdmin
        .from("schools")
        .select("id, name")
        .eq("id", schoolId)
        .maybeSingle();

      if (schoolError || !school) {
        return NextResponse.json(
          { error: "Selected school was not found." },
          { status: 404 }
        );
      }

      workspaceName = school.name || "School";
      tableName = "school_phone_numbers";
      idColumn = "school_id";
      workspaceId = school.id;
    }

    const { data: existingBusinessNumber } = await supabaseAdmin
      .from("business_phone_numbers")
      .select("id, phone_number_id")
      .eq("phone_number_id", phoneNumberId)
      .maybeSingle();

    const { data: existingSchoolNumber } = await supabaseAdmin
      .from("school_phone_numbers")
      .select("id, phone_number_id")
      .eq("phone_number_id", phoneNumberId)
      .maybeSingle();

    const existingInOtherWorkspace =
      workspaceType === "business"
        ? existingSchoolNumber
        : existingBusinessNumber;

    if (existingInOtherWorkspace) {
      return NextResponse.json(
        {
          error:
            "This Meta Phone Number ID is already assigned to another workspace type.",
        },
        { status: 400 }
      );
    }

    const existingNumber =
      workspaceType === "business"
        ? existingBusinessNumber
        : existingSchoolNumber;

    const now = new Date().toISOString();

    const payload = {
      [idColumn]: workspaceId,
      phone_number: phoneNumber,
      phone_number_id: phoneNumberId,
      display_phone_number: displayPhoneNumber,
      verified_name: verifiedName,
      provider,
      is_active: isActive,
      updated_at: now,
    };

    let savedNumber;
    let saveError;

    if (existingNumber?.id) {
      const { data, error: updateError } = await supabaseAdmin
        .from(tableName)
        .update(payload)
        .eq("id", existingNumber.id)
        .select("*")
        .single();

      savedNumber = data;
      saveError = updateError;
    } else {
      const { data, error: insertError } = await supabaseAdmin
        .from(tableName)
        .insert({
          ...payload,
          created_at: now,
        })
        .select("*")
        .single();

      savedNumber = data;
      saveError = insertError;
    }

    if (saveError || !savedNumber) {
      return NextResponse.json(
        { error: saveError?.message || "Failed to save WhatsApp number." },
        { status: 500 }
      );
    }

    await createActivityLog({
      actor_id: user.id,
      business_id: workspaceType === "business" ? workspaceId : null,
      action: existingNumber
        ? "whatsapp_number_updated"
        : "whatsapp_number_created",
      entity_type: "whatsapp_number",
      entity_id: savedNumber.id,
      title: existingNumber
        ? `WhatsApp number updated for ${workspaceName}`
        : `WhatsApp number connected for ${workspaceName}`,
      description: buildChangeSummary(existingNumber, workspaceType),
      metadata: {
        workspace_type: workspaceType,
        workspace_id: workspaceId,
        workspace_name: workspaceName,
        business_id: workspaceType === "business" ? workspaceId : null,
        school_id: workspaceType === "school" ? workspaceId : null,
        phone_number: savedNumber.phone_number,
        phone_number_id: savedNumber.phone_number_id,
        is_active: savedNumber.is_active,
      },
    });

    return NextResponse.json({
      number: {
        id: savedNumber.id,
        workspace_type: workspaceType,
        workspace_id: workspaceId,
        workspace_name: workspaceName,
        business_id: workspaceType === "business" ? workspaceId : null,
        school_id: workspaceType === "school" ? workspaceId : null,
        phone_number: savedNumber.phone_number,
        phone_number_id: savedNumber.phone_number_id,
        display_phone_number: savedNumber.display_phone_number,
        verified_name: savedNumber.verified_name,
        provider: savedNumber.provider,
        is_active: savedNumber.is_active,
        created_at: savedNumber.created_at,
        updated_at: savedNumber.updated_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save WhatsApp number.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const {
      supabaseAdmin,
      user,
      profile,
      error,
    } = await requireSuperAdmin(request);

    if (error || !profile || !user) {
      return error;
    }

    const body = (await request.json()) as WhatsAppNumberDeletePayload;

    const id = cleanText(body.id);
    const workspaceType: WorkspaceType =
      body.workspace_type === "school" ? "school" : "business";
    const confirmationText = cleanText(body.confirmation_text);

    if (!id) {
      return NextResponse.json(
        { error: "WhatsApp number ID is required." },
        { status: 400 }
      );
    }

    if (!confirmationText) {
      return NextResponse.json(
        { error: "Confirmation text is required." },
        { status: 400 }
      );
    }

    const tableName =
      workspaceType === "business"
        ? "business_phone_numbers"
        : "school_phone_numbers";

    const workspaceColumn =
      workspaceType === "business" ? "business_id" : "school_id";

    const workspaceTable = workspaceType === "business" ? "businesses" : "schools";

    const { data: existingNumber, error: existingError } = await supabaseAdmin
      .from(tableName)
      .select(
        `
        id,
        ${workspaceColumn},
        phone_number,
        phone_number_id,
        display_phone_number,
        verified_name,
        provider,
        is_active
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    if (!existingNumber) {
      return NextResponse.json(
        { error: "WhatsApp number was not found." },
        { status: 404 }
      );
    }

    if (confirmationText !== existingNumber.phone_number_id) {
      return NextResponse.json(
        {
          error:
            "Deletion blocked. The confirmation text must match the Meta Phone Number ID exactly.",
        },
        { status: 400 }
      );
    }

    const workspaceId =
      workspaceType === "business"
        ? ((existingNumber as { business_id: string | null }).business_id)
        : ((existingNumber as { school_id: string | null }).school_id);

    let workspaceName = workspaceType === "business" ? "Business" : "School";

    if (workspaceId) {
      const { data: workspace } = await supabaseAdmin
        .from(workspaceTable)
        .select("id, name")
        .eq("id", workspaceId)
        .maybeSingle();

      workspaceName = workspace?.name || workspaceName;
    }

    const { error: deleteError } = await supabaseAdmin
      .from(tableName)
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    await createActivityLog({
      actor_id: user.id,
      business_id: workspaceType === "business" ? workspaceId : null,
      action: "whatsapp_number_deleted",
      entity_type: "whatsapp_number",
      entity_id: id,
      title: `WhatsApp number deleted for ${workspaceName}`,
      description: `A WhatsApp number was removed from a ${workspaceType} workspace after confirmation.`,
      metadata: {
        workspace_type: workspaceType,
        workspace_id: workspaceId,
        workspace_name: workspaceName,
        business_id: workspaceType === "business" ? workspaceId : null,
        school_id: workspaceType === "school" ? workspaceId : null,
        phone_number: existingNumber.phone_number,
        phone_number_id: existingNumber.phone_number_id,
        display_phone_number: existingNumber.display_phone_number,
      },
    });

    return NextResponse.json({
      success: true,
      deleted_number: {
        id,
        workspace_type: workspaceType,
        workspace_id: workspaceId,
        phone_number: existingNumber.phone_number,
        phone_number_id: existingNumber.phone_number_id,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete WhatsApp number.",
      },
      { status: 500 }
    );
  }
}
