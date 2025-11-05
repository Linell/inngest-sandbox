import { inngest } from "./client";
import OpenAI from "openai";

const getOpenAI = () => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

export const fetchGist = inngest.createFunction(
  { id: "gist-fetcher" },
  { event: "demo/fetch-gist" },
  async ({ event, step }) => {
    const gistUrl = event.data?.gistUrl || 'https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b'
    let rawGistUrl = gistUrl
    if (!gistUrl.match('\/raw')) {
      rawGistUrl = `${gistUrl}/raw`
    }

    const rawData = await step.run("fetch-gist", async () => {
      const response = await fetch(rawGistUrl).then(resp => {
        return resp.text()
      })

      return response
    })

    const recipePost = await step.run("http-post-recipe", async () => {
      const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `Recipe: some recipe`,
          body: rawData,
          userId: 1,
        }),
      }).then(resp => {
        return resp.text()
      })
      return response
    })

    return({
      recipePost,
      rawData,
    })
  }
)

export const recipeInference = inngest.createFunction(
  {
    id: "recipe-inference",
    retries: 2
  },
  { event: "demo/recipe-inference" },
  async ({ event, step }) => {
    await step.sleep("wait-a-second", 13)

    const ingredientName = event.data?.ingredient || (await step.ai.infer("pick-ingredient", {
      model: step.ai.models.openai({ model: "gpt-4o" }),
      body: {
        messages: [{
          role: "user",
          content: "Name one random ingredient (just the ingredient name, nothing else)",
        }],
      },
    })).choices[0].message.content;

    const theStatus = await step.run("foobar", async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const foo = await fetch("https://thelinell.com")
      return foo.status
    })

    const recipe = await step.ai.infer("create-recipe", {
      model: step.ai.models.openai({ model: "gpt-4o" }),
      body: {
        messages: [{
          role: "user",
          content: `Create a simple recipe that uses ${ingredientName}. Keep it brief (3-4 sentences).`,
        }],
      },
    });

    const winePairing = await step.ai.infer("suggest-wine", {
      model: step.ai.models.openai({ model: "gpt-4o" }),
      body: {
        messages: [{
          role: "user",
          content: `Suggest a wine that would pair well with this dish: ${recipe.choices[0].message.content}. Keep it brief (1-2 sentences).`,
        }],
      },
    });

    const nonInngestInferenceStep = await step.run("review-recipe", async () => {
      const foo = await fetch("https://www.inngest.com?otm=foo")
      if (Math.random() < 0.2) {
        throw new Error("Random failure occured")
      }
      const fooAgain = await fetch("https://www.inngest.com?otm=foo")
      const openai = getOpenAI();
      const persona = event.data.persona || "an eager foodie";
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{
          role: "user",
          content: `As ${persona}, review this recipe and wine pairing:\n\nRecipe: ${recipe.choices[0].message.content}\n\nWine: ${winePairing.choices[0].message.content}\n\nProvide a brief review (2-3 sentences).`
        }]
      });
      return response.choices[0].message.content;
    });

    return {
      ingredient: ingredientName,
      recipe: recipe.choices[0].message.content,
      winePairing: winePairing.choices[0].message.content,
      review: nonInngestInferenceStep,
    };
  }
);
