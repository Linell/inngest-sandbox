import { inngest } from "./client";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// export const fn1 = inngest.createFunction(
//   {
//     id: "fn-1",
//   },
//   { event: "event-1" },
//   async ({ step }) => {
//     const resultOne = await step.run("step-one", async () => {
//       await sleep(Math.random() * 1000);
//       return 1;
//     });
//
//     await sleep(60 * 100);
//
//     const waitForCancelOrInstantSendResult = await Promise.race([
//       step.waitForEvent("wait-for-cancel", {
//         event: "cancel",
//         timeout: "60s"
//       }),
//       step.waitForEvent("wait-for-instant-send", {
//         event: "send-instant",
//         timeout: "60s"
//       }),
//     ]);
//
//     return waitForCancelOrInstantSendResult?.name;
//   }
// );

export const fn1 = inngest.createFunction(
  {
    id: "fn-1",
    triggers: { event: "event-1" },
  },
  async ({ step, group }) => {
    const resultOne = await step.run("step-one", async () => {
      await sleep(Math.random() * 1000);
      return 1;
    });

    await sleep(60 * 100);

    const waitForCancelOrInstantSendResult = await group.parallel(async () => {
      return Promise.race([
        // step.run("slow", async () => {
        //   await sleep(6000);
        //   return "slow";
        // }),
        // step.run("fast", async () => {
        //   await sleep(600);
        //   return "fast";
        // }),
        step.waitForEvent("wait-for-cancel", {
          event: "cancel",
          timeout: "60s"
        }),
        step.waitForEvent("wait-for-instant-send", {
          event: "send-instant",
          timeout: "60s"
        }),
      ]);
    })

    return waitForCancelOrInstantSendResult?.name;
  }
);
