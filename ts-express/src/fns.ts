import { inngest } from "./client";

sleep = (duration = 1) => { return new Promise(resolve => setTimeout(resolve, duration))}

maybeThrowError = (chance = 0.5) => {
  if (Math.random() < chance) {
    throw new Error("Random Failure!");
  }
}

export const metadataExampleOne = inngest.createFunction(
  { id: "metadata-inside-step-context-target-undefined" },
  { event: "metadata/inside/undefined-target" },
  async ({ event, step }) => {
    const result = await step.run("example-step", async () => {
      await inngest.metadata.update({ key: "metadata/inside/undefined-target" });

      return { success: true };
    });

    return result;
  },
);

export const metadataExampleTwo = inngest.createFunction(
  { id: "metadata-outside-step-context-target-undefined" },
  { event: "metadata/outside/undefined-target" },
  async ({ event, step }) => {
    const result = await step.run("example-step", async () => {
      return { success: true };
    });

    await step.metadata("step_id").update({
      ding: `dong-${Date.now()}`,
    });
    await inngest.metadata.update({ new: `hotness-${Date.now()}` });

    return result;
  },
);

export const metadataExampleThree = inngest.createFunction(
  { id: "metadata-inside-step-context-target-defined" },
  { event: "metadata/inside/defined-target" },
  async ({ event, step }) => {
    const result = await step.run("example-step", async () => {
      await inngest.metadata.run("01KC20BH6TG3M93K9Z89CH1YDJ").update({ key: `inside/defined-target/timestamp-${Date.now()}` });

      return { success: true };
    });

    return result;
  },
);

export const metadataExampleFour = inngest.createFunction(
  { id: "metadata-outside-step-context-target-defined" },
  { event: "metadata/outside/defined-target" },
  async ({ event, step }) => {
    result = { nice: 'test' }

    await inngest.metadata.run("01KC20BH6NQHAXGEVKG5BX7N68").update({ key: `outside/defined-target/timestamp-${Date.now()}` });

    return result;
  },
);

// TODO:
//  Test Cases to Add
//  2. A large metadata payload being sent via Opcode should automagically detect that it's too big and send itself via HTTP instead.
//  3. A test case that fails and then only tags the *retry* with metadata
//  4. A test case where I attach many different pieces of metadata
//  5. A test case where I update a specific step within a previous run.
//  7. A test case that showcases rolling up data.

// =============================================================================
// Knowledge Base Query Example - Demonstrates practical metadata usage
// =============================================================================

const fetchUser = async (userId: number) => {
  await sleep(10);
  return { userId: 1, email: 'foo@bar.com', company: 'Acme, Inc' };
};

const queryUserKnowledgeBase = async (user: { userId: number; email: string; company: string }) => {
  await sleep(20);
  return {
    query: 'How do I reset my password?',
    answer: 'You can reset your password by clicking "Forgot Password" on the login page.',
    relevantDocs: ['password-reset.md', 'account-security.md'],
  };
};

export const queryKnowledgeBase = inngest.createFunction(
  { id: "query-knowledge-base" },
  { event: "query-knowledge-base" },
  async ({ event, step }) => {
    const user = await step.run("fetch-user-from-db", async () => {
      const user = await fetchUser(event.data.userId);
      await inngest.metadata.update(user); // only visible on the step
      await inngest.metadata.run().update({ company: user.company, importantCustomer: false }); // only visible on the run
      return user;
    });

    if (user.company === "Acme, Inc") {
      // overwrites the false value set above
      await inngest.metadata.update({ importantCustomer: true })
    }

    const result = await step.run("query-knowledge-base", async () => {
      return await queryUserKnowledgeBase(user);
    });

    return result;
  },
);

export const invalidMetadataUpdate = inngest.createFunction(
  { id: "invalid-metadata-update" },
  { event: "invalid-metadata-update" },
  async ({ event, step }) => {
    await inngest.metadata.step().update({ foo: 'bar' });

    return { success: true };
  }
);

export const metadataKindExample = inngest.createFunction(
  { id: "metadata-kind-example" },
  { event: "metadata-kind-example" },
  async ({ event, step }) => {
    if (event.data?.variant === "a") {
      await inngest.metadata.update({ bar: "baz" }, 'variant-a');
    } else {
      await inngest.metadata.update({ bar: "baz" }, 'variant-default');
    }
    return { success: true };
  }
);

export const durableExecutionExample = inngest.createFunction(
  { id: "durable-execution-example" },
  { event: "durable-execution-example" },
  async ({ event, step }) => {
    // This metadata update could run multiple times, so the timestamp will reflect
    // the last time that this was updated instead of the *first* time.
    // console.log("entering function") // uncommenting this during execution makes it clearer what's happening
    await inngest.metadata.run().update({ update_ts: Date.now() })

    // This metadata update will only run once, when the associated step is run.
    await step.run("set-metadata", async () => {
      await inngest.metadata.run().update({ original_update_ts: Date.now() })
    });

    // You can also call `step.metadata(<your_step_identifier>)`, which is just syntax sugar
    // for the code block above.
    await step.metadata("set-metadata").update({ other_update_ts: Date.now() });

    return { success: true };
  }
);

export const operationExample = inngest.createFunction(
  { id: "operation-example" },
  { event: "operation-example" },
  async ({ event, step }) => {
    let dog = { name: 'Josie', breed: 'Golden Retriever', status: 'asleep' }

    // Most things are just updates.
    await step.metadata("set-metadata").update({ ...dog });

    dog.breed = 'Goofball'
    dog.status = 'goofin'
    await step.metadata("set-metadata").update({ status: 'goofin' });

    // You can use set to explicitly overwrite a value.
    await step.metadata("set-metadata").set({ ... dog });

    // You can use delete to delete a value.
    await step.metadata("set-metadata").delete(["name", "breed", "status"]);

    return { success: true };
  }
);
