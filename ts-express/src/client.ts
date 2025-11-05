import { extendedTracesMiddleware } from "inngest/experimental";
const otel = extendedTracesMiddleware();

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "sandbox-ts-express",
  middleware: [otel],
});
