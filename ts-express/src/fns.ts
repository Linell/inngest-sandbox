import { createScorer } from "inngest/experimental";
import { inngest } from "./client";

// Runs after the parent run completes.
export const ticketScorer = createScorer(
  inngest,
  { id: "ticket-scorer" },
  async ({ parents }) => {
    // STEP scope (late, via API) — visible in dashboard
    await inngest.score({
      runId: parents[0].runId,
      stepId: "generate-response",
      name: "deferred-step-helpfulness",
      value: Math.random(),
    });

    // RUN scope (late, via API) — invisible
    return {
      name: "deferred-csat",
      value: Math.round(1 + Math.random() * 4),
    };
  },
);

export const handleSupportTicket = inngest.createFunction(
  {
    id: "handle-support-ticket",
    retries: 0,
    triggers: { event: "support/ticket.created" },
  },
  async ({ defer, event, step }) => {
    const response = await step.run("generate-response", async () => {
      // STEP scope (inferred current step) — visible
      await inngest.score({
        name: "tokens-used",
        value: Math.round(200 + Math.random() * 800),
      });
      return `Hello! Got your ticket: "${event.data.content}"`;
    });

    // RUN scope (no stepId) — invisible
    await step.score("score-quality", {
      name: "quality",
      value: Math.random(),
    });
    await step.score("score-handed-off", {
      name: "was-handed-off",
      value: Math.random() < 0.3,
    });

    // STEP scope (explicit stepId, via API) — visible
    await step.score("score-latency", {
      name: "latency-ms",
      stepId: "generate-response",
      value: Math.round(100 + Math.random() * 1900),
    });
    await step.score("score-sentiment", {
      name: "sentiment",
      stepId: "generate-response",
      value: Math.random(),
    });

    // RUN scope (inferred, via API, non-durable) — invisible
    await inngest.score({
      name: "resolved",
      value: Math.random() < 0.8,
    });

    await step.run("schedule-scorer", () => {
      defer("score-ticket", {
        data: { content: event.data.content },
        function: ticketScorer,
      });
    });

    return { response };
  },
);
