import { NextResponse } from "next/server";
import { requireBusinessUser } from "@/lib/requireBusinessUser";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type StatusPayload = {
  status?: string;
};

const allowedStatuses = ["open", "closed", "archived"];

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: conversationId } = await context.params;

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

    const body = (await request.json()) as StatusPayload;

    const status = typeof body.status === "string" ? body.status.trim() : "";

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid conversation status." },
        { status: 400 }
      );
    }

    const { data: existingConversation, error: existingError } =
      await supabaseAdmin
        .from("conversations")
        .select("id, business_id, status")
        .eq("id", conversationId)
        .eq("business_id", businessId)
        .maybeSingle();

    if (existingError || !existingConversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    const { data: updatedConversation, error: updateError } =
      await supabaseAdmin
        .from("conversations")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)
        .eq("business_id", businessId)
        .select("*")
        .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      conversation: updatedConversation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update conversation status.",
      },
      { status: 500 }
    );
  }
}