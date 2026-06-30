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
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20250305", name: "web_search" }] as Anthropic.Tool[],
      messages,
    });

    // web_search_20250305 es server-side: el API ejecuta la búsqueda internamente.
    // La respuesta puede incluir bloques de tipo text, web_search_tool_use y
    // web_search_tool_result. Solo necesitamos los bloques de texto final.
    const content = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as Anthropic.TextBlock).text)
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
