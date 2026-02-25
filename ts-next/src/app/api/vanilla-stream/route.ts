import OpenAI from "openai";
import { NextRequest } from "next/server";

const openai = new OpenAI();

export const POST = async (req: NextRequest) => {
  const url = new URL(req.url);
  const prompt = url.searchParams.get("prompt") ?? "Tell me about durable endpoints";

  const stream = openai.responses.stream({
    model: "gpt-4o-mini",
    input: prompt,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      stream.on("response.created", (event) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      });

      stream.on("response.output_text.delta", (event) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      });

      stream.on("response.completed", (event) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      });

      stream.on("error", (error) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: String(error) })}\n\n`)
        );
        controller.close();
      });
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
