import { inngest } from "./client";
import { myChannel } from "./channels";

export const myFunction = inngest.createFunction(
  {
    id: "my-function",
    triggers: [{ event: "app/run" }],
  },
  async ({ event, step }) => {
    const ch = myChannel({ runId: event.data.runId });

    // Non-durable publish (will re-fire on retry)
    await inngest.realtime.publish(ch.status, {
      message: "Starting...",
    });

    const stepOneResult = await step.run("step-one", async () => {
      await new Promise((r) => setTimeout(r, 2000));
      return "step-one done";
    });

    // Durable publish (memoized, won't re-fire on retry)
    await step.realtime.publish("step-one-done", ch.status, {
      message: stepOneResult,
    });

    // Trigger a re-entry
    await step.sleep("wait-a-while", "10s");

    const stepTwoResult = await step.run("step-two", async () => {
      await new Promise((r) => setTimeout(r, 2000));
      return "step-two done";
    });

    await step.realtime.publish("step-two-done", ch.status, {
      message: stepTwoResult,
    });

    // Durable publish to a different topic
    await step.realtime.publish("final-result", ch.result, {
      value: `Finished: ${stepOneResult}, ${stepTwoResult}`,
    });

    return { ok: true };
  }
);
