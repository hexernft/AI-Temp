import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type KnowledgeType = "product" | "service" | "faq" | "policy" | "general";

type StructuredFields = {
  knowledge_type?: KnowledgeType;

  product_name?: string;
  service_name?: string;
  question?: string;
  answer?: string;
  policy_title?: string;

  category?: string;
  price?: string;
  currency?: string;
  availability?: string;
  description?: string;
  variants?: string;
  delivery_notes?: string;
  payment_notes?: string;
  extra_notes?: string;

  general_title?: string;
  general_content?: string;
};

type KnowledgePayload = {
  title?: string;
  content?: string;
  is_active?: boolean;
  knowledge_type?: KnowledgeType;
  fields?: StructuredFields;
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

function cleanKnowledgeType(value: unknown): KnowledgeType {
  if (
    value === "product" ||
    value === "service" ||
    value === "faq" ||
    value === "policy" ||
    value === "general"
  ) {
    return value;
  }

  return "general";
}

function removeEmptyFields(fields: StructuredFields) {
  const cleaned: Record<string, string> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string" && value.trim()) {
      cleaned[key] = value.trim();
    }
  }

  return cleaned;
}

function buildLine(label: string, value?: string | null) {
  const cleanValue = cleanText(value);

  if (!cleanValue) return null;

  return `${label}: ${cleanValue}`;
}

function compileStructuredKnowledge(fields: StructuredFields) {
  const knowledgeType = cleanKnowledgeType(fields.knowledge_type);

  if (knowledgeType === "product") {
    const title = cleanText(fields.product_name);

    const lines = [
      buildLine("Product", fields.product_name),
      buildLine("Category", fields.category),
      buildLine("Price", fields.price),
      buildLine("Currency", fields.currency),
      buildLine("Availability", fields.availability),
      buildLine("Description", fields.description),
      buildLine("Variants / sizes / colors", fields.variants),
      buildLine("Delivery notes", fields.delivery_notes),
      buildLine("Payment notes", fields.payment_notes),
      buildLine("Extra notes", fields.extra_notes),
    ].filter(Boolean);

    return {
      title: title || "Product knowledge",
      content: lines.join("\n"),
    };
  }

  if (knowledgeType === "service") {
    const title = cleanText(fields.service_name);

    const lines = [
      buildLine("Service", fields.service_name),
      buildLine("Category", fields.category),
      buildLine("Price", fields.price),
      buildLine("Currency", fields.currency),
      buildLine("Availability", fields.availability),
      buildLine("Description", fields.description),
      buildLine("Delivery / booking notes", fields.delivery_notes),
      buildLine("Payment notes", fields.payment_notes),
      buildLine("Extra notes", fields.extra_notes),
    ].filter(Boolean);

    return {
      title: title || "Service knowledge",
      content: lines.join("\n"),
    };
  }

  if (knowledgeType === "faq") {
    const question = cleanText(fields.question);

    const lines = [
      buildLine("Question", fields.question),
      buildLine("Answer", fields.answer),
      buildLine("Extra notes", fields.extra_notes),
    ].filter(Boolean);

    return {
      title: question || "FAQ knowledge",
      content: lines.join("\n"),
    };
  }

  if (knowledgeType === "policy") {
    const title = cleanText(fields.policy_title);

    const lines = [
      buildLine("Policy", fields.policy_title),
      buildLine("Description", fields.description),
      buildLine("Delivery notes", fields.delivery_notes),
      buildLine("Payment notes", fields.payment_notes),
      buildLine("Extra notes", fields.extra_notes),
    ].filter(Boolean);

    return {
      title: title || "Policy knowledge",
      content: lines.join("\n"),
    };
  }

  const title = cleanText(fields.general_title);
  const content = cleanText(fields.general_content);

  return {
    title: title || "General knowledge",
    content,
  };
}

export async function GET(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireBusinessUser(request);

    if (error || !profile) {
      return error;
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
        source_type,
        source_url,
        imported_at,
        metadata,
        created_at,
        updated_at
      `
      )
      .eq("business_id", profile.business_id)
      .order("created_at", { ascending: false });

    if (knowledgeError) {
      return NextResponse.json(
        { error: knowledgeError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      knowledge: knowledge || [],
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
    const { supabaseAdmin, user, profile, error } = await requireBusinessUser(
      request
    );

    if (error || !profile || !user) {
      return error;
    }

    const body = (await request.json()) as KnowledgePayload;

    const isActive = typeof body.is_active === "boolean" ? body.is_active : true;
    const knowledgeType = cleanKnowledgeType(
      body.knowledge_type || body.fields?.knowledge_type
    );

    let title = "";
    let content = "";
    let structuredFields: Record<string, string> = {};

    if (body.fields) {
      const compiled = compileStructuredKnowledge({
        ...body.fields,
        knowledge_type: knowledgeType,
      });

      title = compiled.title;
      content = compiled.content;
      structuredFields = removeEmptyFields({
        ...body.fields,
        knowledge_type: knowledgeType,
      });
    } else {
      title = cleanText(body.title);
      content = cleanText(body.content);
      structuredFields = {
        knowledge_type: knowledgeType,
      };
    }

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

    const now = new Date().toISOString();

    const { data: knowledge, error: insertError } = await supabaseAdmin
      .from("business_knowledge")
      .insert({
        business_id: profile.business_id,
        title,
        content,
        is_active: isActive,
        source_type: "manual",
        source_url: null,
        imported_at: null,
        metadata: {
          knowledge_type: knowledgeType,
          fields: structuredFields,
          entry_mode: body.fields ? "structured" : "freeform",
        },
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
        source_type,
        source_url,
        imported_at,
        metadata,
        created_at,
        updated_at
      `
      )
      .single();

    if (insertError || !knowledge) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create knowledge." },
        { status: 500 }
      );
    }

    await createActivityLog({
      actor_id: user.id,
      business_id: profile.business_id,
      school_id: null,
      action: "knowledge_created",
      entity_type: "business_knowledge",
      entity_id: knowledge.id,
      title: `Knowledge created: ${knowledge.title}`,
      description: `Created a ${knowledgeType} business knowledge entry.`,
      metadata: {
        knowledge_id: knowledge.id,
        source_type: "manual",
        knowledge_type: knowledgeType,
        entry_mode: body.fields ? "structured" : "freeform",
      },
    });

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