/**
 * scoreConfidence — computes confidence, complexity, and recommended tier.
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { reasoningModel } from "../models.js";

const ScoringSchema = z.object({
  confidence: z.number().min(0).max(1).describe("How confident the classification is, 0-1"),
  complexityScore: z.number().min(0).max(1).describe("How complex the requested agent is, 0-1"),
  requiresClarification: z.boolean().describe("Whether the prompt is ambiguous and needs clarification"),
  clarifyingQuestion: z.string().describe("Question to ask user if requiresClarification is true, else empty string").describe("Question to ask user if clarification needed"),
  tierReason: z.string().describe("Brief reason for tier selection"),
});

const structuredModel = reasoningModel.withStructuredOutput(ScoringSchema, {
  method: "jsonSchema",
  strict: true,
});

type Tier = "starter" | "pro" | "mission-critical";

function determineTier(complexityScore: number, dataSensitivity: string, connectorCount: number): Tier {
  if (complexityScore >= 0.75 || dataSensitivity === "high" || connectorCount >= 3) {
    return "mission-critical";
  }
  if (complexityScore >= 0.4 || dataSensitivity === "medium" || connectorCount >= 2) {
    return "pro";
  }
  return "starter";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const scoreConfidenceNode = async (state: any) => {
  const {
    normalizedPrompt, agentType, useCase, deploymentPreference,
    graphPattern, connectorRefs, dataSensitivity,
  } = state;

  const scoring = await structuredModel.invoke([
    new SystemMessage(
      "You are scoring the quality and complexity of an AI agent classification result.\n" +
      "Confidence = how clearly the prompt maps to the chosen agent type (1.0 = unambiguous, 0.3 = multiple valid interpretations).\n" +
      "Complexity = how many moving parts the agent needs (LLM calls, integrations, data stores, concurrency).\n" +
      "RequiresClarification = true only if key information is missing (e.g., no data source mentioned for RAG).",
    ),
    new HumanMessage(
      `Original prompt: "${normalizedPrompt}"\n` +
      `Classified as: ${agentType}\n` +
      `Use case: ${useCase}\n` +
      `Deployment: ${deploymentPreference}\n` +
      `Graph pattern: ${graphPattern}\n` +
      `Required connectors: ${(connectorRefs as string[]).join(", ") || "none"}\n` +
      `Data sensitivity: ${dataSensitivity}`,
    ),
  ]);

  const suggestedTier = determineTier(
    scoring.complexityScore,
    dataSensitivity as string,
    (connectorRefs as string[]).length,
  );

  return {
    phase: "score-confidence",
    confidence: scoring.confidence,
    complexityScore: scoring.complexityScore,
    requiresClarification: scoring.requiresClarification,
    clarifyingQuestion: scoring.clarifyingQuestion,
    suggestedTier,
  };
};
