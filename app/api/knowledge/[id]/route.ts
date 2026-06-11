import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type KnowledgeUpdatePayload = {
  title?: string;
  content?: string;
  is_active?: boolean;
};

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) return null;

  return token;
}

async function requireBusinessUser(request: Request) {
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

  if (profile.role !== "business_owner" && profile.role !== "staff") {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        { error: "Only business users can manage knowledge." },
        { status: 403 }
      ),
    };
  }

  if (!profile.business_id) {
    return {
      supabaseAdmin,
      user,
      profile,
      error: NextResponse.json(
        { error: "This account is not assigned to a business." },
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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: knowledgeId } = await context.params;

    const { supabaseAdmin, user, profile, error } = await requireBusinessUser(
      request
    );

    if (error || !profile || !user) {
      return error;
    }

    const businessId = profile.business_id;

    const { data: existingKnowledge, error: existingError } =
      await supabaseAdmin
        .from("business_knowledge")
        .select(
          `
          id,
          business_id,
          title,
          content,
          is_active,
          source_type,
          source_url,
          imported_at,
          metadata,
          created_at,
          updated_at
        `
        )
        .eq("id", knowledgeId)
        .eq("business_id", businessId)
        .maybeSingle();

    if (existingError || !existingKnowledge) {
      return NextResponse.json(
        { error: "Knowledge entry not found." },
        { status: 404 }
      );
    }

    const body = (await request.json()) as KnowledgeUpdatePayload;

    const title = cleanText(body.title);
    const content = cleanText(body.content);
    const isActive =
      typeof body.is_active === "boolean"
        ? body.is_active
        : existingKnowledge.is_active;

    if (!title) {
      return NextResponse.json(
        { error: "Knowledge title is required." },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: "Knowledge content is required." },
        { status: 400 }
      );
    }

    const { data: knowledge, error: updateError } = await supabaseAdmin
      .from("business_knowledge")
      .update({
        title,
        content,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", knowledgeId)
      .eq("business_id", businessId)
      .select(
        `
        id,
        business_id,
        title,
        content,
        is_active,
        source_type,
        source_url,
        imported_at,
        metadata,
        created_at,
        updated_at
      `
      )
      .single();

    if (updateError || !knowledge) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to update knowledge." },
        { status: 500 }
      );
    }

    await createActivityLog({
      actor_id: user.id,
      business_id: businessId,
      school_id: null,
      action: "knowledge_updated",
      entity_type: "business_knowledge",
      entity_id: knowledge.id,
      title: `Knowledge updated: ${knowledge.title}`,
      description: "Updated a business knowledge entry.",
      metadata: {
        knowledge_id: knowledge.id,
        source_type: knowledge.source_type || "manual",
        source_url: knowledge.source_url || null,
        is_active: knowledge.is_active,
      },
    });

    return NextResponse.json({
      knowledge,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update knowledge.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id: knowledgeId } = await context.params;

    const { supabaseAdmin, user, profile, error } = await requireBusinessUser(
      request
    );

    if (error || !profile || !user) {
      return error;
    }

    const businessId = profile.business_id;

    const { data: existingKnowledge, error: existingError } =
      await supabaseAdmin
        .from("business_knowledge")
        .select("id, business_id, title, source_type, source_url")
        .eq("id", knowledgeId)
        .eq("business_id", businessId)
        .maybeSingle();

    if (existingError || !existingKnowledge) {
      return NextResponse.json(
        { error: "Knowledge entry not found." },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("business_knowledge")
      .delete()
      .eq("id", knowledgeId)
      .eq("business_id", businessId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    await createActivityLog({
      actor_id: user.id,
      business_id: businessId,
      school_id: null,
      action: "knowledge_deleted",
      entity_type: "business_knowledge",
      entity_id: knowledgeId,
      title: `Knowledge deleted: ${existingKnowledge.title}`,
      description: "Deleted a business knowledge entry.",
      metadata: {
        knowledge_id: knowledgeId,
        source_type: existingKnowledge.source_type || "manual",
        source_url: existingKnowledge.source_url || null,
      },
    });

    return NextResponse.json({
      deleted: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete knowledge.",
      },
      { status: 500 }
    );
  }
}