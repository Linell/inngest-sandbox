import { inngest } from "./client";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const fn1 = inngest.createFunction(
  {
    id: "fn-1"
  },
  { event: "event-1" },
  async () => {
    await sleep(60 * 100);
    return "Hello, World!";
  }
);
