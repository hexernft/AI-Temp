import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { requireBusinessUser } from "@/lib/requireBusinessUser";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: conversationId } = await context.params;

    const { supabaseAdmin, profile, user, error } = await requireBusinessUser(
      request
    );

    if (error || !profile || !user) {
      return error;
    }

    const businessId = profile.business_id;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business is required." },
        { status: 403 }
      );
    }

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("conversations")
      .select(
        `
        id,
        business_id,
        customer_id,
        handoff_required,
        customers (
          id,
          name,
          phone
        ),
        businesses (
          id,
          name
        )
      `
      )
      .eq("id", conversationId)
      .eq("business_id", businessId)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    const { data: updatedConversation, error: updateError } =
      await supabaseAdmin
        .from("conversations")
        .update({
          handoff_required: false,
          updated_at: now,
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

    const customerRelation = conversation.customers;
    const businessRelation = conversation.businesses;

    const customer = Array.isArray(customerRelation)
      ? customerRelation[0]
      : customerRelation;

    const business = Array.isArray(businessRelation)
      ? businessRelation[0]
      : businessRelation;

    await createActivityLog({
      actor_id: user.id,
      business_id: businessId,
      action: "handoff_resolved",
      entity_type: "conversation",
      entity_id: conversation.id,
      title: "Human handoff resolved",
      description: `Handoff was resolved for ${
        customer?.name || customer?.phone || "a customer"
      }${business?.name ? ` under ${business.name}` : ""}.`,
      metadata: {
        conversation_id: conversation.id,
        customer_id: conversation.customer_id,
        customer_name: customer?.name || null,
        customer_phone: customer?.phone || null,
        business_name: business?.name || null,
        previous_handoff_required: conversation.handoff_required,
        new_handoff_required: false,
      },
    });

    return NextResponse.json({
      conversation: updatedConversation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to resolve handoff.",
      },
      { status: 500 }
    );
  }
}