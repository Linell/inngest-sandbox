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
  async ({ step }) => {
    const foo = await step.run("fetch-thing", async () => {
      const result = await fetch("https://thelinell.com");
      return result.text();
    });

    return foo;
  }
);

export const fn2 = inngest.createFunction(
  {
    id: "fn-2",
    checkpointing: {
      maxInterval: '4s'
    }
  },
  { event: "event-2" },
  async ({ step }) => {
    const foo = await step.run("fetch-thing", async () => {
      const result = await fetch("https://thelinell.com");
      return result.text();
    });

    return foo;
  }
);


