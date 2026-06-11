import { NextResponse } from "next/server";
import { requireBusinessUser } from "@/lib/requireBusinessUser";

type ChannelPayload = {
  channel?: "whatsapp" | "instagram";
  phone_number?: string;
  phone_number_id?: string;
  display_phone_number?: string;
  verified_name?: string;
  whatsapp_access_token?: string;
  instagram_business_account_id?: string;
  page_id?: string;
  username?: string;
  instagram_access_token?: string;
  is_active?: boolean;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanPhone(value: unknown) {
  return cleanText(value).replace(/[^\d]/g, "");
}

function hasGlobalWhatsAppToken() {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN ||
      process.env.META_WHATSAPP_ACCESS_TOKEN ||
      process.env.WHATSAPP_TOKEN ||
      process.env.META_ACCESS_TOKEN
  );
}

function hasGlobalInstagramToken() {
  return Boolean(
    process.env.INSTAGRAM_ACCESS_TOKEN ||
      process.env.META_INSTAGRAM_ACCESS_TOKEN ||
      process.env.META_ACCESS_TOKEN
  );
}

export async function GET(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireBusinessUser(request);

    if (error || !profile) return error;

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name")
      .eq("id", profile.business_id)
      .maybeSingle();

    const { data: whatsappNumbers, error: whatsappError } = await supabaseAdmin
      .from("business_phone_numbers")
      .select(
        `
        id,
        business_id,
        phone_number,
        phone_number_id,
        display_phone_number,
        verified_name,
        provider,
        access_token,
        waba_id,
        token_expires_at,
        last_webhook_at,
        is_active,
        created_at,
        updated_at
      `
      )
      .eq("business_id", profile.business_id)
      .order("created_at", { ascending: false });

    if (whatsappError) {
      return NextResponse.json(
        { error: whatsappError.message },
        { status: 500 }
      );
    }

    const { data: instagramAccounts, error: instagramError } =
      await supabaseAdmin
        .from("business_instagram_accounts")
        .select(
          `
          id,
          business_id,
          instagram_business_account_id,
          page_id,
          username,
          access_token,
          token_expires_at,
          last_webhook_at,
          is_active,
          created_at,
          updated_at
        `
        )
        .eq("business_id", profile.business_id)
        .order("created_at", { ascending: false });

    if (instagramError) {
      return NextResponse.json(
        { error: instagramError.message },
        { status: 500 }
      );
    }

    const whatsapp = (whatsappNumbers || []).map((item) => ({
      ...item,
      access_token: undefined,
      has_access_token: Boolean(item.access_token),
      has_global_access_token: hasGlobalWhatsAppToken(),
      is_connected: Boolean(item.phone_number_id && item.is_active !== false),
    }));

    const instagram = (instagramAccounts || []).map((item) => ({
      ...item,
      access_token: undefined,
      has_access_token: Boolean(item.access_token),
      has_global_access_token: hasGlobalInstagramToken(),
      is_connected: Boolean(
        item.instagram_business_account_id && item.is_active !== false
      ),
    }));

    return NextResponse.json({
      business: business || null,
      whatsapp,
      instagram,
      summary: {
        whatsapp_connected: whatsapp.some((item) => item.is_connected),
        instagram_connected: instagram.some((item) => item.is_connected),
        global_whatsapp_token: hasGlobalWhatsAppToken(),
        global_instagram_token: hasGlobalInstagramToken(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load channel connections.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireBusinessUser(request);

    if (error || !profile) return error;

    const body = (await request.json()) as ChannelPayload;
    const channel = body.channel;
    const isActive = typeof body.is_active === "boolean" ? body.is_active : true;
    const now = new Date().toISOString();

    if (channel === "whatsapp") {
      const phoneNumber = cleanPhone(body.phone_number);
      const phoneNumberId = cleanText(body.phone_number_id);
      const displayPhoneNumber = cleanText(body.display_phone_number);
      const verifiedName = cleanText(body.verified_name);
      const accessToken = cleanText(body.whatsapp_access_token);

      if (!phoneNumberId) {
        return NextResponse.json(
          { error: "Meta Phone Number ID is required." },
          { status: 400 }
        );
      }

      const payload: Record<string, unknown> = {
        business_id: profile.business_id,
        phone_number: phoneNumber || displayPhoneNumber || phoneNumberId,
        phone_number_id: phoneNumberId,
        display_phone_number: displayPhoneNumber || null,
        verified_name: verifiedName || null,
        provider: "whatsapp_cloud_api",
        is_active: isActive,
        updated_at: now,
      };

      if (accessToken) payload.access_token = accessToken;

      const { data: existing } = await supabaseAdmin
        .from("business_phone_numbers")
        .select("id")
        .eq("business_id", profile.business_id)
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();

      const query = existing?.id
        ? supabaseAdmin
            .from("business_phone_numbers")
            .update(payload)
            .eq("id", existing.id)
            .eq("business_id", profile.business_id)
            .select("id, business_id, phone_number, phone_number_id, display_phone_number, verified_name, provider, is_active, created_at, updated_at")
            .single()
        : supabaseAdmin
            .from("business_phone_numbers")
            .insert({ ...payload, created_at: now })
            .select("id, business_id, phone_number, phone_number_id, display_phone_number, verified_name, provider, is_active, created_at, updated_at")
            .single();

      const { data: whatsapp, error: saveError } = await query;

      if (saveError || !whatsapp) {
        return NextResponse.json(
          { error: saveError?.message || "Failed to save WhatsApp channel." },
          { status: 500 }
        );
      }

      return NextResponse.json({ channel: "whatsapp", connection: whatsapp });
    }

    if (channel === "instagram") {
      const instagramBusinessAccountId = cleanText(
        body.instagram_business_account_id
      );
      const pageId = cleanText(body.page_id);
      const username = cleanText(body.username);
      const accessToken = cleanText(body.instagram_access_token);

      if (!instagramBusinessAccountId) {
        return NextResponse.json(
          { error: "Instagram business account ID is required." },
          { status: 400 }
        );
      }

      const payload: Record<string, unknown> = {
        business_id: profile.business_id,
        instagram_business_account_id: instagramBusinessAccountId,
        page_id: pageId || null,
        username: username || null,
        is_active: isActive,
        updated_at: now,
      };

      if (accessToken) payload.access_token = accessToken;

      const { data: existing } = await supabaseAdmin
        .from("business_instagram_accounts")
        .select("id")
        .eq("business_id", profile.business_id)
        .eq("instagram_business_account_id", instagramBusinessAccountId)
        .maybeSingle();

      const query = existing?.id
        ? supabaseAdmin
            .from("business_instagram_accounts")
            .update(payload)
            .eq("id", existing.id)
            .eq("business_id", profile.business_id)
            .select("id, business_id, instagram_business_account_id, page_id, username, is_active, created_at, updated_at")
            .single()
        : supabaseAdmin
            .from("business_instagram_accounts")
            .insert({ ...payload, created_at: now })
            .select("id, business_id, instagram_business_account_id, page_id, username, is_active, created_at, updated_at")
            .single();

      const { data: instagram, error: saveError } = await query;

      if (saveError || !instagram) {
        return NextResponse.json(
          { error: saveError?.message || "Failed to save Instagram channel." },
          { status: 500 }
        );
      }

      return NextResponse.json({ channel: "instagram", connection: instagram });
    }

    return NextResponse.json(
      { error: "Channel must be whatsapp or instagram." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save channel connection.",
      },
      { status: 500 }
    );
  }
}
