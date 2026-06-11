import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateBusinessReply } from "@/lib/ai";

type TestReplyPayload = {
  business_id?: string;
  customer_name?: string;
  customer_message?: string;
};

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) return null;

  return token;
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized. Missing session token." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Invalid session." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, business_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found." },
        { status: 404 }
      );
    }

    const body = (await request.json()) as TestReplyPayload;

    const customerName =
      typeof body.customer_name === "string"
        ? body.customer_name.trim()
        : "";

    const customerMessage =
      typeof body.customer_message === "string"
        ? body.customer_message.trim()
        : "";

    if (!customerMessage) {
      return NextResponse.json(
        { error: "Customer message is required." },
        { status: 400 }
      );
    }

    let businessId = profile.business_id;

    if (profile.role === "super_admin" && body.business_id) {
      businessId = body.business_id;
    }

    if (!businessId) {
      return NextResponse.json(
        { error: "Business ID is required." },
        { status: 400 }
      );
    }

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      );
    }

    const { data: knowledgeRows, error: knowledgeError } = await supabaseAdmin
      .from("business_knowledge")
      .select("title, content")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (knowledgeError) {
      return NextResponse.json(
        { error: knowledgeError.message },
        { status: 500 }
      );
    }

    const businessKnowledge = (knowledgeRows || [])
      .map((item) => `${item.title}: ${item.content}`)
      .join("\n\n");

    const reply = await generateBusinessReply({
      businessName: business.name,
      customerName: customerName || null,
      customerMessage,
      businessKnowledge,
      recentMessages: [
        {
          sender_type: "customer",
          content: customerMessage,
        },
      ],
    });

    return NextResponse.json({
      reply,
      business,
      knowledge_count: knowledgeRows?.length || 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate test reply.",
      },
      { status: 500 }
    );
  }
}