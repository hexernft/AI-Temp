import {
  runSalesAgentCore,
  type SalesAgentCoreResult,
} from "@/lib/salesAgentCore";
import type { ProductCatalogItem } from "@/lib/orderState";

type SupabaseAdminClient = any;

type RecentMessage = {
  sender_type?: string | null;
  role?: string | null;
  sender?: string | null;
  direction?: string | null;
  content?: string | null;
  body?: string | null;
  message?: string | null;
  text?: string | null;
  created_at?: string | null;
};

type SalesControllerPayload = {
  supabaseAdmin: SupabaseAdminClient;
  businessId: string;
  customerId: string;
  conversationId: string;
  customerName?: string | null;
  customerMessage: string;
  businessKnowledge?: string | null;
  recentMessages?: RecentMessage[];
  productCatalog?: ProductCatalogItem[];
};

type SalesControllerResult = {
  handled: boolean;
  directReply: string | null;
  orderStateContext: string;
  orderStateId: string | null;
  stage: string;
  intent?: SalesAgentCoreResult["intent"];
};

export async function runSalesController({
  supabaseAdmin,
  businessId,
  customerId,
  conversationId,
  customerName,
  customerMessage,
  businessKnowledge,
  recentMessages = [],
  productCatalog = [],
}: SalesControllerPayload): Promise<SalesControllerResult> {
  const result = await runSalesAgentCore({
    supabaseAdmin,
    businessId,
    customerId,
    conversationId,
    customerName,
    customerMessage,
    businessKnowledge,
    recentMessages,
    productCatalog,
  });

  return {
    handled: result.handled,
    directReply: result.directReply,
    orderStateContext: result.orderStateContext,
    orderStateId: result.orderStateId,
    stage: result.stage,
    intent: result.intent,
  };
}
