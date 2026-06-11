type SendInstagramTextPayload = {
  recipientId: string;
  message: string;
  instagramBusinessAccountId: string;
  accessToken?: string | null;
};

function getInstagramAccessToken(accessToken?: string | null) {
  return (
    accessToken ||
    process.env.INSTAGRAM_ACCESS_TOKEN ||
    process.env.META_INSTAGRAM_ACCESS_TOKEN ||
    process.env.META_ACCESS_TOKEN ||
    ""
  );
}

async function parseInstagramResponse(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function sendInstagramText({
  recipientId,
  message,
  instagramBusinessAccountId,
  accessToken,
}: SendInstagramTextPayload) {
  const token = getInstagramAccessToken(accessToken);
  const cleanRecipientId = recipientId.trim();
  const cleanMessage = message.trim();
  const cleanInstagramBusinessAccountId = instagramBusinessAccountId.trim();

  if (!token) {
    throw new Error(
      "Missing Instagram access token. Add INSTAGRAM_ACCESS_TOKEN to environment variables or business_instagram_accounts.access_token."
    );
  }

  if (!cleanInstagramBusinessAccountId) {
    throw new Error("Missing Instagram business account ID.");
  }

  if (!cleanRecipientId) {
    throw new Error("Missing Instagram recipient ID.");
  }

  if (!cleanMessage) {
    throw new Error("Message cannot be empty.");
  }

  const response = await fetch(
    `https://graph.instagram.com/v24.0/${cleanInstagramBusinessAccountId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: {
          id: cleanRecipientId,
        },
        message: {
          text: cleanMessage,
        },
      }),
    }
  );

  const result = await parseInstagramResponse(response);

  if (!response.ok) {
    throw new Error(
      typeof result === "string" ? result : JSON.stringify(result, null, 2)
    );
  }

  return result as {
    recipient_id?: string;
    message_id?: string;
  };
}
