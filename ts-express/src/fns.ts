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

    return(rawData)
  }
)

export const recipeInference = inngest.createFunction(
  {
    id: "recipe-inference",
    retries: 0,
  },
  { event: "demo/recipe-inference" },
  async ({ event, step }) => {
    // Step 1: Get ingredient from event or pick a random one
    const ingredientName = event.data?.ingredient || (await step.ai.infer("pick-ingredient", {
      model: step.ai.models.openai({ model: "gpt-4o" }),
      body: {
        messages: [{
          role: "user",
          content: "Name one random ingredient (just the ingredient name, nothing else)",
        }],
      },
    })).choices[0].message.content;

    // Step 2: Create a recipe using that ingredient
    const recipe = await step.ai.infer("create-recipe", {
      model: step.ai.models.openai({ model: "gpt-4o" }),
      body: {
        messages: [{
          role: "user",
          content: `Create a simple recipe that uses ${ingredientName}. Keep it brief (3-4 sentences).`,
        }],
      },
    });

    // Step 3: Suggest a wine pairing for the recipe
    const winePairing = await step.ai.infer("suggest-wine", {
      model: step.ai.models.openai({ model: "gpt-4o" }),
      body: {
        messages: [{
          role: "user",
          content: `Suggest a wine that would pair well with this dish: ${recipe.choices[0].message.content}. Keep it brief (1-2 sentences).`,
        }],
      },
    });

    // Step 4: Review the recipe and wine pairing using direct OpenAI call
    const nonInngestInferenceStep = await step.run("review-recipe", async () => {
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
