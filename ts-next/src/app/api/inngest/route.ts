import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import * as functions from "@/inngest/fns";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: Object.values(functions) as Parameters<typeof serve>[0]["functions"],
});
