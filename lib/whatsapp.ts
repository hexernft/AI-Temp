type SendWhatsAppTextPayload = {
  to: string;
  message: string;
  phoneNumberId: string;
  accessToken?: string | null;
};

type SendWhatsAppImagePayload = {
  to: string;
  imageUrl: string;
  phoneNumberId: string;
  caption?: string;
  accessToken?: string | null;
};

function getWhatsAppAccessToken(accessToken?: string | null) {
  return (
    accessToken ||
    process.env.WHATSAPP_ACCESS_TOKEN ||
    process.env.META_WHATSAPP_ACCESS_TOKEN ||
    process.env.WHATSAPP_TOKEN ||
    process.env.META_ACCESS_TOKEN ||
    ""
  );
}

function cleanPhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

async function parseWhatsAppResponse(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function sendWhatsAppText({
  to,
  message,
  phoneNumberId,
  accessToken,
}: SendWhatsAppTextPayload) {
  const token = getWhatsAppAccessToken(accessToken);
  const cleanTo = cleanPhone(to);

  if (!token) {
    throw new Error(
      "Missing WhatsApp access token. Add WHATSAPP_ACCESS_TOKEN to environment variables or business_phone_numbers.access_token."
    );
  }

  if (!phoneNumberId) {
    throw new Error("Missing WhatsApp phone number ID.");
  }

  if (!cleanTo) {
    throw new Error("Missing customer WhatsApp number.");
  }

  if (!message.trim()) {
    throw new Error("Message cannot be empty.");
  }

  const response = await fetch(
    `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "text",
        text: {
          preview_url: false,
          body: message,
        },
      }),
    }
  );

  const result = await parseWhatsAppResponse(response);

  if (!response.ok) {
    throw new Error(
      typeof result === "string" ? result : JSON.stringify(result, null, 2)
    );
  }

  return result as {
    messaging_product?: string;
    contacts?: Array<{
      input?: string;
      wa_id?: string;
    }>;
    messages?: Array<{
      id?: string;
    }>;
  };
}

export async function sendWhatsAppImage({
  to,
  imageUrl,
  phoneNumberId,
  caption,
  accessToken,
}: SendWhatsAppImagePayload) {
  const token = getWhatsAppAccessToken(accessToken);
  const cleanTo = cleanPhone(to);

  if (!token) {
    throw new Error(
      "Missing WhatsApp access token. Add WHATSAPP_ACCESS_TOKEN to environment variables or business_phone_numbers.access_token."
    );
  }

  if (!phoneNumberId) {
    throw new Error("Missing WhatsApp phone number ID.");
  }

  if (!cleanTo) {
    throw new Error("Missing customer WhatsApp number.");
  }

  if (!imageUrl.trim()) {
    throw new Error("Image URL cannot be empty.");
  }

  const response = await fetch(
    `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "image",
        image: {
          link: imageUrl,
          caption: caption || "",
        },
      }),
    }
  );

  const result = await parseWhatsAppResponse(response);

  if (!response.ok) {
    throw new Error(
      typeof result === "string" ? result : JSON.stringify(result, null, 2)
    );
  }

  return result as {
    messaging_product?: string;
    contacts?: Array<{
      input?: string;
      wa_id?: string;
    }>;
    messages?: Array<{
      id?: string;
    }>;
  };
}
