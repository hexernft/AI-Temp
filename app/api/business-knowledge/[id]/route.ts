import { NextResponse } from "next/server";
import { requireBusinessUser } from "@/lib/requireBusinessUser";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type KnowledgePayload = {
  title?: string;
  content?: string;
  is_active?: boolean;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const { supabaseAdmin, profile, error } = await requireBusinessUser(request);

    if (error || !profile) {
      return error;
    }

    const businessId = profile.business_id;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business is required." },
        { status: 403 }
      );
    }

    const { data: existingKnowledge, error: existingError } =
      await supabaseAdmin
        .from("business_knowledge")
        .select("id, business_id")
        .eq("id", id)
        .eq("business_id", businessId)
        .maybeSingle();

    if (existingError || !existingKnowledge) {
      return NextResponse.json(
        { error: "Knowledge entry not found." },
        { status: 404 }
      );
    }

    const body = (await request.json()) as KnowledgePayload;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.title === "string") {
      const title = body.title.trim();

      if (!title) {
        return NextResponse.json(
          { error: "Title cannot be empty." },
          { status: 400 }
        );
      }

      updatePayload.title = title;
    }

    if (typeof body.content === "string") {
      const content = body.content.trim();

      if (!content) {
        return NextResponse.json(
          { error: "Content cannot be empty." },
          { status: 400 }
        );
      }

      updatePayload.content = content;
    }

    if (typeof body.is_active === "boolean") {
      updatePayload.is_active = body.is_active;
    }

    const { data: updatedKnowledge, error: updateError } = await supabaseAdmin
      .from("business_knowledge")
      .update(updatePayload)
      .eq("id", id)
      .eq("business_id", businessId)
      .select(
        `
        id,
        business_id,
        title,
        content,
        is_active,
        created_at,
        updated_at
      `
      )
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      knowledge: updatedKnowledge,
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
    const { id } = await context.params;

    const { supabaseAdmin, profile, error } = await requireBusinessUser(request);

    if (error || !profile) {
      return error;
    }

    const businessId = profile.business_id;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business is required." },
        { status: 403 }
      );
    }

    const { data: existingKnowledge, error: existingError } =
      await supabaseAdmin
        .from("business_knowledge")
        .select("id, business_id")
        .eq("id", id)
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
      .eq("id", id)
      .eq("business_id", businessId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
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