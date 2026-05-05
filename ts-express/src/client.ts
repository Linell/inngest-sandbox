import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "sandbox-ts-express",
  checkpointing: { maxRuntime: 0 },
});
