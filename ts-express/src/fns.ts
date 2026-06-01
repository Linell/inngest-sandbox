import { inngest } from "./client";
import { createDefer } from "inngest/experimental";

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const fooDefer = createDefer(
  inngest,
  { id: "foo-defer", name: "Enterprise Grade Deferred Function w/Long AF Name" },
  async ({ step, event }) => {
    await sleep(5000);
    const result = await step.run("hard-work", async () => {
      await sleep(Math.random() * 5_000);
      return event.data?.foo || "Bar!";
    })

    console.log("the result is ", result)

    if (result === "Bar!") {
      console.log("Sending teh invocation!")
      const invoked = await step.invoke("foo-invoke", {
        function: fooInvoke,
        data: { foo: "Invoked by Bar!!" },
      });
    } else if (result === "Bazzzzzzz") {
      console.log("well....")
    } else {
      console.log("Fuck?")
    }

    return result;
  }
)

export const fooInvoke = inngest.createFunction(
  {
    id: "foo-invoke",
    name: "Enterprise Friendly Invocation",
    retries: 0,
  },
  async ({ step, event }) => {
    const result = await step.run("hard-work", async () => {
      await sleep(Math.random() * 8_000);
      return event.data?.foo || "Bar!";
    })

    return result;
  }
)

export const fn1 = inngest.createFunction(
  {
    id: "fn-1_ENTERPRISE_SYNC_EVENT",
    name: "Enterprise Sync Event", // TODO: does this name show in old UI?
    retries: 0,
    triggers: { event: "event-1" },
  },
  async ({ defer, step }) => {
    defer("foo", { function: fooDefer, data: {} }); // TODO: is sending no data useful ever?
    defer("foo-two", { function: fooDefer, data: { foo: "Bazzzzzzz" } });
    await sleep(5000);

    const invoked = await step.invoke("foo-invoke", {
      function: fooInvoke,
      data: { foo: "Invoked!" },
    });

    defer("devils-reject", { function: fooDefer, data: [] });

    return invoked;
  },
);
