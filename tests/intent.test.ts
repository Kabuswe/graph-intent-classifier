/**
 * tests/intent.test.ts — vitest integration tests for graph-intent-classifier.
 * Makes real LLM calls via OpenRouter — requires OPENROUTER_API_KEY in .env.
 */
import "dotenv/config";
import { describe, test, expect } from "vitest";
import { graph } from "../src/graph.js";

describe("graph-intent-classifier", () => {
  test("classifies email agent prompt", async () => {
    const result = await graph.invoke(
      { rawPrompt: "I need an agent that reads my Gmail inbox, classifies priority, and drafts replies" },
      { configurable: { thread_id: `test-${Date.now()}` } },
    );
    expect(result.agentType).toBe("email");
    expect(typeof result.confidence).toBe("number");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.suggestedTier).toMatch(/starter|pro|mission-critical/);
  }, 45000);

  test("classifies RAG document Q&A prompt", async () => {
    const result = await graph.invoke(
      { rawPrompt: "Build a local knowledge base over our PDF documentation with Q&A" },
      { configurable: { thread_id: `test-${Date.now()}` } },
    );
    expect(result.agentType).toBe("rag");
    expect(result.deploymentPreference).toBe("local");
  }, 45000);

  test("classifies web monitor prompt", async () => {
    const result = await graph.invoke(
      { rawPrompt: "Monitor a competitors pricing page and alert me when prices change" },
      { configurable: { thread_id: `test-${Date.now()}` } },
    );
    expect(result.agentType).toBe("monitor");
  }, 45000);

  test("classifies journal enricher prompt", async () => {
    const result = await graph.invoke(
      { rawPrompt: "Enrich my daily Markdown journal entries with theme extraction and mood scoring" },
      { configurable: { thread_id: `test-${Date.now()}` } },
    );
    expect(result.agentType).toBe("journal");
    expect(result.dataSensitivity).toBe("high");
  }, 45000);
});
