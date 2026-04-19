import { ChatOpenRouter } from "@langchain/openrouter";

/** Fast structured output: query gen, classification. */
export const fastModel = new ChatOpenRouter({
  model: "openai/gpt-5-mini",
  temperature: 0,
  maxRetries: 3,
});

/** Reasoning: confidence scoring, complex analysis. */
export const reasoningModel = new ChatOpenRouter({
  model: "x-ai/grok-4.1-fast",
  temperature: 0.1,
  maxTokens: 8000,
  maxRetries: 3,
});
