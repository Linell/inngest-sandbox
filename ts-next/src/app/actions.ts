"use server";

import { getClientSubscriptionToken } from "inngest/react";
import { inngest } from "@/inngest/client";
import { myChannel } from "@/inngest/channels";

export async function getRealtimeToken(runId: string) {
  return getClientSubscriptionToken(inngest, {
    channel: myChannel({ runId }),
    topics: ["status", "result"],
  });
}

export async function startRun() {
  const runId = crypto.randomUUID();
  await inngest.send({ name: "app/run", data: { runId } });
  return { runId };
}

// inngest.realtime.publish() from outside a function run
export async function publishFromClient(runId: string, message: string) {
  const ch = myChannel({ runId });
  await inngest.realtime.publish(ch.status, { message });
}
