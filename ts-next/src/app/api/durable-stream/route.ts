import { step } from "inngest";
import { inngest } from "@/inngest/client";
import OpenAI from "openai";
import { NextRequest } from "next/server";

const openai = new OpenAI();

export const POST = inngest.endpoint(async (req: NextRequest) => {
  const url = new URL(req.url);
  const prompt =
    url.searchParams.get("prompt") ??
    "Tell me about durable endpoints from Inngest";

  const validated = await step.run("validate-request", async () => {
    return { prompt, model: "gpt-4o-mini", timestamp: Date.now() };
  });

  const outline = await step.run("generate-outline", async () => {
    const response = await openai.responses.create({
      model: validated.model,
      input: `Create a brief 3-point outline for: ${validated.prompt}`,
    });
    return response.output_text;
  });

  console.log("INFO: finished outline check");

  const stream = await openai.responses.create({
    model: validated.model,
    input: `Expand on this outline in detail:\n\n${outline}`,
    stream: true,
  });

  return new Response(stream.toReadableStream());
});
