import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/agent";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Mensajes inválidos" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages,
    });

    const content = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Error en API de chat:", error);
    return NextResponse.json(
      { error: "Error al conectar con el agente. Verifica tu ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }
}
