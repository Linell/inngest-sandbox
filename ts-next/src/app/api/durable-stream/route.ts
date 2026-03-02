import { step, stream } from "inngest";
import { inngest } from "@/inngest/client";
import OpenAI from "openai";
import { NextRequest } from "next/server";

const openai = new OpenAI();

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// if we had a stream object we could tack things on to it as we're going,
// to allow progress updates. can go through the same path as automatically
// returning a stream
// maybe we always return a stream response? Like it's always under the hood
export const POST = inngest.endpoint(async (req: NextRequest) => {
  const url = new URL(req.url);
  const prompt =
    url.searchParams.get("prompt") ??
    "Tell me about durable endpoints from Inngest";

  const validated = await step.run("validate-request", async () => {
    return { prompt, model: "gpt-4o-mini", timestamp: Date.now() };
  });

  stream.push({ type: "prompt", message: prompt })

  const outline = await step.run("generate-outline", async () => {
    stream.push({ type: "info", message: "prepping to generate outline" })
    const response = await openai.responses.create({
      model: validated.model,
      input: `Create a brief 3-point outline for: ${validated.prompt}`,
      stream: true
    });
    const foo = stream.pipe(response.toReadableStream())
    return foo;
  });

  sleep(1000);

  stream.push({ type: "info", message: "finished outline check" })

  const expandedOutline = await openai.responses.create({
    model: validated.model,
    input: `Expand on this outline in detail:\n\n${outline}`,
    stream: true
  });

  // need to mock this dying mid-stream
  return new Response(expandedOutline.toReadableStream());
});


// durable endpoitns for long running tasks, be sure re-entry works
//  - streaming updates of processing a large CSV row-by-row with progress updates
//  - it should go async and resume
