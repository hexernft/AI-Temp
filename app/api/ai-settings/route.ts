import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { requireBusinessUser } from "@/lib/requireBusinessUser";

type AiSettingsPayload = {
  auto_reply_enabled?: boolean;
  handoff_enabled?: boolean;
  fallback_message?: string;
};

type Business = {
  id: string;
  name: string | null;
};

type ExistingSettings = {
  id: string;
  business_id: string;
  auto_reply_enabled: boolean | null;
  handoff_enabled: boolean | null;
  fallback_message: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function buildSettingsChangeSummary(
  existingSettings: ExistingSettings | null,
  nextSettings: {
    auto_reply_enabled: boolean;
    handoff_enabled: boolean;
    fallback_message: string;
  }
) {
  if (!existingSettings) {
    return "AI settings were created.";
  }

  const changes: string[] = [];

  if (existingSettings.auto_reply_enabled !== nextSettings.auto_reply_enabled) {
    changes.push(
      `auto reply changed from ${
        existingSettings.auto_reply_enabled ? "enabled" : "disabled"
      } to ${nextSettings.auto_reply_enabled ? "enabled" : "disabled"}`
    );
  }

  if (existingSettings.handoff_enabled !== nextSettings.handoff_enabled) {
    changes.push(
      `handoff changed from ${
        existingSettings.handoff_enabled ? "enabled" : "disabled"
      } to ${nextSettings.handoff_enabled ? "enabled" : "disabled"}`
    );
  }

  if ((existingSettings.fallback_message || "") !== nextSettings.fallback_message) {
    changes.push("fallback message was updated");
  }

  if (changes.length === 0) {
    return "AI settings were saved with no major changes.";
  }

  return `AI settings updated: ${changes.join(", ")}.`;
}

function attachBusinessToSettings(
  settings: ExistingSettings[],
  business: Business | null
) {
  return settings.map((setting) => ({
    ...setting,
    businesses: business
      ? {
          id: business.id,
          name: business.name,
        }
      : null,
  }));
}

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

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      return NextResponse.json({ error: businessError.message }, { status: 500 });
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("business_ai_settings")
      .select(
        `
        id,
        business_id,
        auto_reply_enabled,
        handoff_enabled,
        fallback_message,
        created_at,
        updated_at
      `
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (settingsError) {
      return NextResponse.json(
        { error: settingsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      settings: attachBusinessToSettings(
        (settings || []) as ExistingSettings[],
        business as Business | null
      ),
      businesses: business ? [business] : [],
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load AI settings.",
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

    const businessId = profile.business_id;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business is required." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as AiSettingsPayload;

    const autoReplyEnabled =
      typeof body.auto_reply_enabled === "boolean"
        ? body.auto_reply_enabled
        : true;

    const handoffEnabled =
      typeof body.handoff_enabled === "boolean" ? body.handoff_enabled : true;

    const fallbackMessage =
      typeof body.fallback_message === "string"
        ? body.fallback_message.trim()
        : "";

    if (!fallbackMessage) {
      return NextResponse.json(
        { error: "Fallback message is required." },
        { status: 400 }
      );
    }

    const { data: existingSettings } = await supabaseAdmin
      .from("business_ai_settings")
      .select(
        `
        id,
        business_id,
        auto_reply_enabled,
        handoff_enabled,
        fallback_message,
        created_at,
        updated_at
      `
      )
      .eq("business_id", businessId)
      .maybeSingle();

    const now = new Date().toISOString();

    const { data, error: upsertError } = await supabaseAdmin
      .from("business_ai_settings")
      .upsert(
        {
          business_id: businessId,
          auto_reply_enabled: autoReplyEnabled,
          handoff_enabled: handoffEnabled,
          fallback_message: fallbackMessage,
          updated_at: now,
        },
        {
          onConflict: "business_id",
        }
      )
      .select(
        `
        id,
        business_id,
        auto_reply_enabled,
        handoff_enabled,
        fallback_message,
        created_at,
        updated_at
      `
      )
      .single();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .maybeSingle();

    await createActivityLog({
      actor_id: user.id,
      business_id: businessId,
      action: existingSettings ? "ai_settings_updated" : "ai_settings_created",
      entity_type: "ai_settings",
      entity_id: data.id,
      title: existingSettings
        ? `AI settings updated for ${business?.name || "business"}`
        : `AI settings created for ${business?.name || "business"}`,
      description: buildSettingsChangeSummary(
        existingSettings as ExistingSettings | null,
        {
          auto_reply_enabled: autoReplyEnabled,
          handoff_enabled: handoffEnabled,
          fallback_message: fallbackMessage,
        }
      ),
      metadata: {
        business_id: businessId,
        business_name: business?.name || null,
        previous_auto_reply_enabled:
          existingSettings?.auto_reply_enabled ?? null,
        new_auto_reply_enabled: autoReplyEnabled,
        previous_handoff_enabled: existingSettings?.handoff_enabled ?? null,
        new_handoff_enabled: handoffEnabled,
        fallback_message_changed:
          (existingSettings?.fallback_message || "") !== fallbackMessage,
      },
    });

    return NextResponse.json({
      settings: {
        ...data,
        businesses: business
          ? {
              id: business.id,
              name: business.name,
            }
          : null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save AI settings.",
      },
      { status: 500 }
    );
  }
}