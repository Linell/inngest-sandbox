import { inngest } from "./client";
import { createDefer } from "inngest/experimental";

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const fooDefer = createDefer(
  inngest,
  { id: "foo-defer" },
  async ({ step, event }) => {
    const result = await step.run("hard-work", () => {
      return event.data?.foo || "Bar!";
    })

    return result;
  }
)

export const fn1 = inngest.createFunction(
  {
    id: "fn-1",
    retries: 0,
    triggers: { event: "event-1" },
  },
  async ({ defer }) => {
    defer("foo", { function: fooDefer, data: {} }); // TODO: is sending no data useful ever?
    await sleep(500);

    defer("foo-two", { function: fooDefer, data: { foo: "Bazzzzzzz" } });
    await sleep(600);


    return "Hello world!";
  },
);
