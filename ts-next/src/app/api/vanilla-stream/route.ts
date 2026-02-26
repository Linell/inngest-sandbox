import OpenAI from "openai";
import { NextRequest } from "next/server";

const openai = new OpenAI();

export const POST = async (req: NextRequest) => {
  const url = new URL(req.url);
  const prompt =
    url.searchParams.get("prompt") ?? "Tell me about durable endpoints";

  // Step 1: Generate an outline
  const outline = await openai.responses.create({
    model: "gpt-4o-mini",
    input: `Create a brief 3-point outline for: ${prompt}`,
  });

  console.log("INFO: finished outline check");

  // Step 2: Stream a full response based on the outline
  const stream = await openai.responses.create({
    model: "gpt-4o-mini",
    input: `Expand on this outline in detail:\n\n${outline.output_text}`,
    stream: true,
  });

  return new Response(stream.toReadableStream());
};
