import { step } from "inngest";
import { inngest } from "@/inngest/client";
import OpenAI from "openai";
import { NextRequest } from "next/server";

const openai = new OpenAI();

export const POST = inngest.endpoint(async (req: NextRequest) => {
  const url = new URL(req.url);
  const prompt =
    url.searchParams.get("prompt") ?? "Tell me about durable endpoints";

  const validated = await step.run("validate-request", async () => {
    return { prompt, model: "gpt-4o-mini", timestamp: Date.now() };
  });

  const stream = await openai.responses.create({
    model: validated.model,
    input: validated.prompt,
    stream: true,
  });

  return new Response(stream.toReadableStream());
});
