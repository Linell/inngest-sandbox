import { inngest } from "./client";

// This replaces the external AI worker + SQS + waitForEvent pattern.
// Instead of dispatching to SQS and waiting for a "task.end" event,
// the work happens directly in this Inngest function.
export const processColumn = inngest.createFunction(
  { id: "process-column" },
  { event: "column/process" },
  async ({ event, step }) => {
    const taskRun = await step.run("create-task-run", async () => {
      return { taskRunId: "fake-id", columnId: event.data.columnId };
    });

    const result = await step.run("do-ai-work", async () => {
      // This is where the AI work happens — replaces the SQS worker.
      // sqs.sendMessage({ taskRunId: taskRun.taskRunId, column: event.data })
      return { success: true };
    });

    return result;
  }
);

export const workflow = inngest.createFunction(
  { id: "start-workflow" },
  { event: "workflow.start" },
  async ({ event, step }) => {
    const executionPlan = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    for (const [index, columnId] of executionPlan.entries()) {
      // step.invoke replaces the original pattern of:
      //   1. step.run (dispatch to SQS)
      //   2. step.waitForEvent (wait for "task.end")
      //
      // invoke calls processColumn as its own function run (with its own
      // retries), waits for it to finish, and returns the result directly.
      // If it times out, it throws — no need to check for a falsy event.
      const result = await step.invoke(`process-column-${index}`, {
        function: processColumn,
        data: { columnId },
        timeout: "30m",
      });
    }

    return "Workflow complete";
  }
);
