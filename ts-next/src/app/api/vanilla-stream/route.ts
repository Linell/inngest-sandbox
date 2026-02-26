import OpenAI from "openai";
import { NextRequest } from "next/server";

const openai = new OpenAI();

export const POST = async (req: NextRequest) => {
  const url = new URL(req.url);
  const prompt =
    url.searchParams.get("prompt") ?? "Tell me about durable endpoints";

  const stream = await openai.responses.create({
    model: "gpt-4o-mini",
    input: prompt,
    stream: true,
  });

  return new Response(stream.toReadableStream());
};
