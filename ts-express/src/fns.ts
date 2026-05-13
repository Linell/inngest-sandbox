import { inngest } from "./client";
import { createDefer } from "inngest/experimental";

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const fooDefer = createDefer(
  inngest,
  { id: "foo-defer" },
  async ({ step, event }) => {
    sleep(3000);
    const result = await step.run("hard-work", () => {
      sleep(Math.random() * 1000);
      return event.data?.foo || "Bar!";
    })

    return result;
  }
)

export const fooInvoke = inngest.createFunction(
  {
    id: "foo-invoke",
    retries: 0,
  },
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
  async ({ defer, step }) => {
    defer("foo", { function: fooDefer, data: {} }); // TODO: is sending no data useful ever?
    await sleep(500);

    defer("foo-two", { function: fooDefer, data: { foo: "Bazzzzzzz" } });
    await sleep(600);

    const invoked = await step.invoke("foo-invoke", {
      function: fooInvoke,
      data: { foo: "Invoked!" },
    });

    return invoked;
  },
);
