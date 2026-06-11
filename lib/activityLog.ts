import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CreateActivityLogPayload = {
  actor_id?: string | null;
  business_id?: string | null;
  school_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function createActivityLog(payload: CreateActivityLogPayload) {
  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin.from("activity_logs").insert({
    actor_id: payload.actor_id || null,
    business_id: payload.business_id || null,
    school_id: payload.school_id || null,
    action: payload.action,
    entity_type: payload.entity_type,
    entity_id: payload.entity_id || null,
    title: payload.title,
    description: payload.description || null,
    metadata: payload.metadata || {},
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to create activity log:", error.message);
  }
}