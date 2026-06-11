import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

type ChatMessage = {
  role: "customer" | "assistant" | "human" | string;
  content: string;
};

type LeadData = {
  customer_name: string | null;
  service_requested: string | null;
  budget: string | null;
  date_needed: string | null;
  location: string | null;
  notes: string | null;
  status:
    | "new"
    | "collecting_details"
    | "qualified"
    | "needs_human_follow_up"
    | "closed"
    | string
    | null;
};

function createFallbackLead(messages: ChatMessage[]): LeadData {
  const conversationText = messages
    .map((message) => {
      const label =
        message.role === "customer"
          ? "Customer"
          : message.role === "assistant"
          ? "Assistant"
          : message.role === "human"
          ? "Human"
          : message.role;

      return `${label}: ${message.content}`;
    })
    .join("\n");

  return {
    customer_name: null,
    service_requested: null,
    budget: null,
    date_needed: null,
    location: null,
    notes: conversationText || "Conversation captured.",
    status: "collecting_details",
  };
}

function cleanGeminiJson(rawText: string) {
  return rawText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

function normalizeLead(parsedLead: Partial<LeadData>, fallbackLead: LeadData) {
  const allowedStatuses = [
    "new",
    "collecting_details",
    "qualified",
    "needs_human_follow_up",
    "closed",
  ];

  const status =
    parsedLead.status && allowedStatuses.includes(parsedLead.status)
      ? parsedLead.status
      : fallbackLead.status;

  return {
    customer_name: parsedLead.customer_name || fallbackLead.customer_name,
    service_requested: parsedLead.service_requested || null,
    budget: parsedLead.budget || null,
    date_needed: parsedLead.date_needed || null,
    location: parsedLead.location || null,
    notes: parsedLead.notes || fallbackLead.notes,
    status,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const messages = Array.isArray(body.messages)
      ? (body.messages as ChatMessage[])
      : [];

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "Messages are required." },
        { status: 400 }
      );
    }

    const fallbackLead = createFallbackLead(messages);

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        lead: fallbackLead,
        fallback: true,
        reason: "Missing GEMINI_API_KEY.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const conversationText = messages
      .map((message) => {
        const label =
          message.role === "customer"
            ? "Customer"
            : message.role === "assistant"
            ? "Assistant"
            : message.role === "human"
            ? "Human"
            : message.role;

        return `${label}: ${message.content}`;
      })
      .join("\n");

    const prompt = `
You are extracting lead details from a WhatsApp-style business conversation.

Conversation:
${conversationText}

Extract the lead information as JSON only.

Rules:
- Return valid JSON only.
- Do not wrap the JSON in markdown.
- If a field is unknown, use null.
- Do not invent details.
- "status" should be one of: new, collecting_details, qualified, needs_human_follow_up, closed.
- If the customer has shown clear buying interest, use "qualified".
- If important details are still missing, use "collecting_details".
- If the customer asks for a human, final confirmation, payment issue, complaint, or something sensitive, use "needs_human_follow_up".
- If the conversation is completed or clearly resolved, use "closed".

JSON shape:
{
  "customer_name": string | null,
  "service_requested": string | null,
  "budget": string | null,
  "date_needed": string | null,
  "location": string | null,
  "notes": string | null,
  "status": "new" | "collecting_details" | "qualified" | "needs_human_follow_up" | "closed"
}
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

        const rawText = response.text || "";
        const cleanedText = cleanGeminiJson(rawText);

        const parsedLead = JSON.parse(cleanedText) as Partial<LeadData>;
        const lead = normalizeLead(parsedLead, fallbackLead);

        return NextResponse.json({
          lead,
          model,
          fallback: false,
        });
      } catch (error) {
        console.error("Lead extraction model failed:", {
          model,
          error,
        });
      }
    }

    return NextResponse.json({
      lead: fallbackLead,
      fallback: true,
      reason: "Gemini did not return valid JSON.",
    });
  } catch (error) {
    console.error("Gemini lead extraction error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while extracting the lead.",
      },
      { status: 500 }
    );
  }
}