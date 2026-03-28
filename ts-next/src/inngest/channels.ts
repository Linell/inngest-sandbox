import { realtime } from "inngest";
import { z } from "zod";

export const myChannel = realtime.channel({
  name: ({ runId }: { runId: string }) => `run:${runId}`,
  topics: {
    status: {
      schema: z.object({ message: z.string() }),
    },
    result: {
      schema: z.object({ value: z.string() }),
    },
  },
});
