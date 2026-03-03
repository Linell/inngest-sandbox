import { Inngest } from "inngest";
import { extendedTracesMiddleware } from "inngest/experimental";

export const inngest = new Inngest({
  id: "sandbox-ts-express",
  middleware: [extendedTracesMiddleware()],
});
