import { NextResponse } from "next/server";
import { requireBusinessUser } from "@/lib/requireBusinessUser";

type KnowledgePayload = {
  title?: string;
  content?: string;
  is_active?: boolean;
};

export async function GET(request: Request) {
  try {
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

    const { data: knowledge, error: knowledgeError } = await supabaseAdmin
      .from("business_knowledge")
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
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (knowledgeError) {
      return NextResponse.json(
        { error: knowledgeError.message },
        { status: 500 }
      );
    }

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .maybeSingle();

    const knowledgeWithBusiness = (knowledge || []).map((item) => ({
      ...item,
      businesses: business
        ? {
            id: business.id,
            name: business.name,
          }
        : null,
    }));

    return NextResponse.json({
      knowledge: knowledgeWithBusiness,
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load knowledge.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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

    const body = (await request.json()) as KnowledgePayload;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const isActive =
      typeof body.is_active === "boolean" ? body.is_active : true;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required." },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: "Content is required." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: knowledge, error: createError } = await supabaseAdmin
      .from("business_knowledge")
      .insert({
        business_id: businessId,
        title,
        content,
        is_active: isActive,
        created_at: now,
        updated_at: now,
      })
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

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json({
      knowledge,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create knowledge.",
      },
      { status: 500 }
    );
  }
}