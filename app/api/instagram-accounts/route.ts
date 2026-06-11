import { NextResponse } from "next/server";
import { requireBusinessUser } from "@/lib/requireBusinessUser";

type InstagramAccountPayload = {
  id?: string;
  instagram_business_account_id?: string;
  page_id?: string;
  username?: string;
  access_token?: string;
  is_active?: boolean;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireBusinessUser(request);

    if (error || !profile) return error;

    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from("business_instagram_accounts")
      .select(
        `
        id,
        business_id,
        instagram_business_account_id,
        page_id,
        username,
        is_active,
        created_at,
        updated_at
      `
      )
      .eq("business_id", profile.business_id)
      .order("created_at", { ascending: false });

    if (accountsError) {
      return NextResponse.json(
        { error: accountsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ accounts: accounts || [] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Instagram accounts.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireBusinessUser(request);

    if (error || !profile) return error;

    const body = (await request.json()) as InstagramAccountPayload;
    const id = cleanText(body.id);
    const instagramBusinessAccountId = cleanText(
      body.instagram_business_account_id
    );
    const pageId = cleanText(body.page_id);
    const username = cleanText(body.username);
    const accessToken = cleanText(body.access_token);

    if (!instagramBusinessAccountId) {
      return NextResponse.json(
        { error: "Instagram business account ID is required." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const payload: Record<string, unknown> = {
      business_id: profile.business_id,
      instagram_business_account_id: instagramBusinessAccountId,
      page_id: pageId || null,
      username: username || null,
      is_active: body.is_active ?? true,
      updated_at: now,
    };

    if (accessToken) {
      payload.access_token = accessToken;
    }

    if (!id) {
      payload.created_at = now;
    }

    const query = id
      ? supabaseAdmin
          .from("business_instagram_accounts")
          .update(payload)
          .eq("id", id)
          .eq("business_id", profile.business_id)
          .select(
            "id, business_id, instagram_business_account_id, page_id, username, is_active, created_at, updated_at"
          )
          .single()
      : supabaseAdmin
          .from("business_instagram_accounts")
          .insert(payload)
          .select(
            "id, business_id, instagram_business_account_id, page_id, username, is_active, created_at, updated_at"
          )
          .single();

    const { data: account, error: saveError } = await query;

    if (saveError || !account) {
      return NextResponse.json(
        { error: saveError?.message || "Failed to save Instagram account." },
        { status: 500 }
      );
    }

    return NextResponse.json({ account });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save Instagram account.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabaseAdmin, profile, error } = await requireBusinessUser(request);

    if (error || !profile) return error;

    const body = (await request.json()) as InstagramAccountPayload;
    const id = cleanText(body.id);

    if (!id) {
      return NextResponse.json(
        { error: "Instagram account ID is required." },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("business_instagram_accounts")
      .delete()
      .eq("id", id)
      .eq("business_id", profile.business_id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete Instagram account.",
      },
      { status: 500 }
    );
  }
}
