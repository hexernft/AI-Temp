import { NextResponse } from "next/server";
import { requireBusinessUser } from "@/lib/requireBusinessUser";

export async function GET(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireBusinessUser(request);

    if (error || !profile) {
      return error;
    }

    const { data: customers, error: customersError } = await supabaseAdmin
      .from("customers")
      .select(
        `
        id,
        business_id,
        name,
        phone,
        email,
        metadata,
        created_at,
        updated_at
      `
      )
      .eq("business_id", profile.business_id)
      .order("updated_at", { ascending: false });

    if (customersError) {
      return NextResponse.json(
        { error: customersError.message },
        { status: 500 }
      );
    }

    const customerIds = Array.from(
      new Set((customers || []).map((item) => item.id).filter(Boolean))
    ) as string[];

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name, type")
      .eq("id", profile.business_id)
      .maybeSingle();

    const { data: conversations } =
      customerIds.length > 0
        ? await supabaseAdmin
            .from("conversations")
            .select("id, customer_id, status, handoff_required, last_message_at")
            .eq("business_id", profile.business_id)
            .in("customer_id", customerIds)
        : { data: [] };

    const conversationsByCustomer = new Map<string, typeof conversations>();

    for (const conversation of conversations || []) {
      if (!conversation.customer_id) continue;

      const existing = conversationsByCustomer.get(conversation.customer_id) || [];
      existing.push(conversation);
      conversationsByCustomer.set(conversation.customer_id, existing);
    }

    const customersWithDetails = (customers || []).map((customer) => {
      const customerConversations =
        conversationsByCustomer.get(customer.id) || [];

      const latestConversation = customerConversations
        .slice()
        .sort((a, b) => {
          const first = a.last_message_at
            ? new Date(a.last_message_at).getTime()
            : 0;

          const second = b.last_message_at
            ? new Date(b.last_message_at).getTime()
            : 0;

          return second - first;
        })[0];

      return {
        ...customer,
        business_name: business?.name || null,
        business_type: business?.type || null,
        conversation_count: customerConversations.length,
        latest_conversation_id: latestConversation?.id || null,
        latest_conversation_status: latestConversation?.status || null,
        latest_conversation_handoff:
          latestConversation?.handoff_required || false,
        latest_message_at: latestConversation?.last_message_at || null,
      };
    });

    return NextResponse.json({
      customers: customersWithDetails,
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load customers.",
      },
      { status: 500 }
    );
  }
}