import { step } from "inngest";
import { inngest } from "@/inngest/client";
import { NextRequest } from "next/server";

export const POST = inngest.endpoint(async (req: NextRequest) => {
  const url = new URL(req.url);
  const name = url.searchParams.get("name") ?? "world";

  const user = await step.run("fetch-user", async () => {
    return { id: "user_123", name, plan: "pro" };
  });

  const result = await step.run("process-data", async () => {
    return {
      processed: true,
      message: `Processed for ${user.name} on ${user.plan} plan`,
    };
  });

  await step.run("send-notification", async () => {
    console.log(`Notification sent to ${user.name}: ${result.message}`);
  });

  return Response.json({ success: true, user, result });
});
