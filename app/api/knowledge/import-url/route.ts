import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activityLog";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ImportUrlPayload = {
  url?: string;
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
        { error: "Only business users can import knowledge." },
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

function validateUrl(value: string) {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractTitle(html: string, fallbackUrl: URL) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  if (!titleMatch?.[1]) {
    return `Imported from ${fallbackUrl.hostname}`;
  }

  const title = decodeHtmlEntities(titleMatch[1])
    .replace(/\s+/g, " ")
    .trim();

  return title || `Imported from ${fallbackUrl.hostname}`;
}

function extractReadableText(html: string) {
  let text = html;

  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  text = text.replace(/<svg[\s\S]*?<\/svg>/gi, " ");

  text = text.replace(/<\/(p|div|section|article|main|header|footer|li|h1|h2|h3|h4|h5|h6|br)>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");

  text = decodeHtmlEntities(text);

  text = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");

  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

function limitText(value: string, maxCharacters = 18000) {
  if (value.length <= maxCharacters) return value;

  return `${value.slice(0, maxCharacters).trim()}\n\n[Content shortened during import.]`;
}

export async function POST(request: Request) {
  try {
    const {
      supabaseAdmin,
      user,
      profile,
      error,
    } = await requireBusinessUser(request);

    if (error || !profile || !user) {
      return error;
    }

    const body = (await request.json()) as ImportUrlPayload;
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";

    if (!rawUrl) {
      return NextResponse.json(
        { error: "Website URL is required." },
        { status: 400 }
      );
    }

    const parsedUrl = validateUrl(rawUrl);

    if (!parsedUrl) {
      return NextResponse.json(
        { error: "Enter a valid http or https website URL." },
        { status: 400 }
      );
    }

    const response = await fetch(parsedUrl.toString(), {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 Knowledge Importer for WhatsApp AI Platform",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Could not fetch this URL. Website returned status ${response.status}.`,
        },
        { status: 400 }
      );
    }

    const contentType = response.headers.get("content-type") || "";

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/xhtml")
    ) {
      return NextResponse.json(
        {
          error:
            "This URL does not look like a readable web page. Try copying the content manually.",
        },
        { status: 400 }
      );
    }

    const html = await response.text();

    const title = extractTitle(html, parsedUrl);
    const readableText = limitText(extractReadableText(html));

    if (!readableText || readableText.length < 80) {
      return NextResponse.json(
        {
          error:
            "Could not extract enough readable text from this website. It may be blocked, empty, or loaded mostly with JavaScript.",
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: knowledge, error: insertError } = await supabaseAdmin
      .from("business_knowledge")
      .insert({
        business_id: profile.business_id,
        title,
        content: readableText,
        is_active: true,
        source_type: "url",
        source_url: parsedUrl.toString(),
        imported_at: now,
        metadata: {
          imported_from: parsedUrl.toString(),
          hostname: parsedUrl.hostname,
          content_type: contentType,
          extracted_characters: readableText.length,
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
        {
          error:
            insertError?.message || "Failed to save imported knowledge entry.",
        },
        { status: 500 }
      );
    }

    await createActivityLog({
      actor_id: user.id,
      business_id: profile.business_id,
      school_id: null,
      action: "knowledge_imported_from_url",
      entity_type: "business_knowledge",
      entity_id: knowledge.id,
      title: `Knowledge imported from URL: ${title}`,
      description: `Imported website content from ${parsedUrl.hostname}.`,
      metadata: {
        knowledge_id: knowledge.id,
        source_type: "url",
        source_url: parsedUrl.toString(),
        hostname: parsedUrl.hostname,
      },
    });

    return NextResponse.json({
      knowledge,
      extracted: {
        title,
        source_url: parsedUrl.toString(),
        characters: readableText.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to import website content.",
      },
      { status: 500 }
    );
  }
}