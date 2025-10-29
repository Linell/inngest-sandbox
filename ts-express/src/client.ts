import { otelMiddleware } from "inngest/experimental";
const otel = otelMiddleware();

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "sandbox-ts-express",
  middleware: [otel],
});
