/**
 * classifyIntent — LLM-based intent classification into structured agent type + use case.
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { fastModel } from "../models.js";

const ClassificationSchema = z.object({
  agentType: z.enum([
    "rag", "monitor", "briefing", "page-scanner", "connector",
    "builder", "doc-processor", "journal", "email", "custom",
  ]),
  useCase: z.string().describe("One sentence describing what the user wants to build"),
  deploymentPreference: z.enum(["local", "cloud", "hybrid"]),
  reasoning: z.string().describe("Why this agent type was chosen"),
});

const structuredModel = fastModel.withStructuredOutput(ClassificationSchema, {
  method: "jsonSchema",
  strict: true,
});

const AGENT_DESCRIPTIONS = `
Agent types and when to use them:
- rag: retrieval-augmented generation from a knowledge base or document corpus
- monitor: web page/feed monitoring and change detection with alerts
- briefing: daily summary or briefing aggregation (news, data, updates)
- page-scanner: extracting entities and insights from web pages on demand
- connector: integration with external services (email, Slack, GitHub, Notion, CRMs)
- builder: generates new AI agent configurations or code from user requirements
- doc-processor: intelligent document understanding (PDFs, text, tables) — summarize, Q&A
- journal: personal journal enrichment, mood tracking, insight extraction
- email: email classification, priority scoring, action extraction, draft replies
- custom: multi-purpose or unclear — does not fit the above categories

Deployment inference:
- local: mentions privacy, local machine, offline, self-hosted, on-device, no cloud
- cloud: mentions API, server, webhook, SaaS, hosted, cloud, deployment URL
- hybrid: default when unclear or both are acceptable
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const classifyIntentNode = async (state: any) => {
  const { normalizedPrompt, explicitSignals } = state;

  const signalContext = explicitSignals.length > 0
    ? `\nDetected keyword signals: ${explicitSignals.join(", ")}`
    : "";

  const result = await structuredModel.invoke([
    new SystemMessage(AGENT_DESCRIPTIONS),
    new HumanMessage(
      `Classify this prompt into the most appropriate agent type.\n\nPrompt: "${normalizedPrompt}"${signalContext}`,
    ),
  ]);

  return {
    phase: "classify-intent",
    agentType: result.agentType,
    useCase: result.useCase,
    deploymentPreference: result.deploymentPreference,
  };
};
