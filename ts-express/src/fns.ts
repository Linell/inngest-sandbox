import { inngest } from "./client";

export const fn1 = inngest.createFunction(
	{
		id: "fn-1",
		triggers: { event: "event-1" },
	},
	async ({ step }) => {
		for (let i = 0; i < 10; i++) {
			await step.run(`step-${i}`, async () => {
				console.log(`step-${i} started`);
				await new Promise((resolve) => setTimeout(resolve, 10_000));
			});
		}
	},
);
