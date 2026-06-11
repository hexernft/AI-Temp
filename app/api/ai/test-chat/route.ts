import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

type Business = {
  id: string;
  business_name?: string | null;
  business_type?: string | null;
  category?: string | null;
  location?: string | null;
  opening_hours?: string | null;
  tone_instructions?: string | null;

  // Old-field fallback, just in case any old page still sends it
  name?: string | null;
  tone?: string | null;
};

type KnowledgeItem = {
  id?: string;
  title?: string | null;
  category?: string | null;
  content?: string | null;
};

type ChatMessage = {
  role: "customer" | "assistant" | string;
  content: string;
};

function getBusinessName(business: Business | null) {
  if (!business) return "Business";

  return (
    business.business_name ||
    business.name ||
    business.business_type ||
    business.category ||
    "Business"
  );
}

function createSafeFallbackReply(customerMessage: string) {
  const message = customerMessage.toLowerCase();

  if (
    message.includes("price") ||
    message.includes("cost") ||
    message.includes("budget") ||
    message.includes("how much")
  ) {
    return "Thanks for reaching out. I can help collect the details so the team can confirm the right price. Please share what you need, your preferred date, your location, and your budget range.";
  }

  if (
    message.includes("book") ||
    message.includes("order") ||
    message.includes("delivery") ||
    message.includes("schedule")
  ) {
    return "Sure, I can help with that. Please share your name, what you would like to order, quantity, delivery date, and location so the team can follow up.";
  }

  if (
    message.includes("location") ||
    message.includes("address") ||
    message.includes("where")
  ) {
    return "I can help with that. Please share what service or product you need, and I’ll collect the right details for the team to assist you.";
  }

  return "Thanks for your message. I’ll help collect the details so the team can assist you properly. Please share your name, what you need, quantity, delivery date, location, and budget if available.";
}

function buildKnowledgeText(knowledgeItems: KnowledgeItem[]) {
  if (!knowledgeItems.length) {
    return "No extra knowledge has been added yet.";
  }

  return knowledgeItems
    .map((item) => {
      return `Category: ${item.category || "general"}\nTitle: ${
        item.title || "Untitled"
      }\nContent: ${item.content || ""}`;
    })
    .join("\n\n---\n\n");
}

function buildConversationText(messages: ChatMessage[]) {
  if (!messages.length) {
    return "No previous messages.";
  }

  return messages
    .map((message) => {
      const label =
        message.role === "customer"
          ? "Customer"
          : message.role === "assistant"
          ? "Assistant"
          : message.role;

      return `${label}: ${message.content}`;
    })
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const business = (body.business || null) as Business | null;
    const knowledgeItems = Array.isArray(body.knowledgeItems)
      ? (body.knowledgeItems as KnowledgeItem[])
      : [];

    const messages = Array.isArray(body.messages)
      ? (body.messages as ChatMessage[])
      : [];

    const customerMessage =
      typeof body.customerMessage === "string"
        ? body.customerMessage.trim()
        : "";

    if (!business) {
      return NextResponse.json(
        { error: "Business data is required." },
        { status: 400 }
      );
    }

    if (!customerMessage) {
      return NextResponse.json(
        { error: "Customer message is required." },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        reply: createSafeFallbackReply(customerMessage),
        fallback: true,
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const knowledgeText = buildKnowledgeText(knowledgeItems);
    const conversationText = buildConversationText(messages);

    const prompt = `
You are the WhatsApp AI assistant for this business.

Business name: ${getBusinessName(business)}
Business type: ${business.business_type || business.category || "Not specified"}
Location: ${business.location || "Not specified"}
Opening hours: ${business.opening_hours || "Not specified"}

Brand tone and rules:
${
  business.tone_instructions ||
  business.tone ||
  "Professional, friendly, helpful, clear, and sales-focused."
}

Business knowledge base:
${knowledgeText}

Conversation so far:
${conversationText}

Latest customer message:
${customerMessage}

Your job:
- Reply as a helpful WhatsApp assistant for the business.
- Keep replies clear, natural, short, and suitable for WhatsApp.
- Use the business knowledge base when relevant.
- Ask follow-up questions when needed.
- Collect useful lead details such as name, service needed, date, budget, location, and special request.
- Do not invent prices, policies, availability, or promises.
- If the customer asks for a human, final confirmation, payment issue, complaint, or something sensitive, say you will connect them with a team member.
- If the knowledge base does not contain the answer, say you can help collect the details for the team.

Return only the assistant reply. Do not include labels like "Assistant:".
`;

    const models = [
      "gemini-2.5-flash",
      
      "gemini-2.0-flash",
    ];

    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        if (response.text) {
          return NextResponse.json({
            reply: response.text,
            model,
            fallback: false,
          });
        }
      } catch (error) {
        console.error("test-chat model failed:", {
          model,
          error,
        });
      }
    }

    return NextResponse.json({
      reply: createSafeFallbackReply(customerMessage),
      fallback: true,
    });
  } catch (error) {
    console.error("test-chat route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate AI test reply.",
      },
      { status: 500 }
    );
  }
}