/**
 * tests/intent.test.ts — live integration test for graph-intent-classifier
 * Runs real LLM calls via OpenRouter.
 */
import "dotenv/config";
import { graph } from "../src/graph.js";

const TEST_CASES = [
  {
    name: "email agent",
    input: { rawPrompt: "I need an agent that reads my Gmail inbox, classifies priority, and drafts replies" },
    expectAgentType: "email",
  },
  {
    name: "RAG document Q&A",
    input: { rawPrompt: "Build a local knowledge base over our PDF documentation with Q&A" },
    expectAgentType: "rag",
  },
  {
    name: "web monitor",
    input: { rawPrompt: "Monitor a competitors pricing page and alert me when prices change" },
    expectAgentType: "monitor",
  },
  {
    name: "journal enricher",
    input: { rawPrompt: "Enrich my daily Markdown journal entries with theme extraction and mood scoring" },
    expectAgentType: "journal",
  },
];

async function runTest(tc: (typeof TEST_CASES)[0]) {
  const config = { configurable: { thread_id: `test-${Date.now()}` } };
  const result = await graph.invoke(tc.input, config);

  const passed = result.agentType === tc.expectAgentType;
  const icon = passed ? "✅" : "⚠️";
  console.log(
    `${icon} [${tc.name}] agentType=${result.agentType} (expected ${tc.expectAgentType}) ` +
    `confidence=${result.confidence?.toFixed(2)} tier=${result.suggestedTier} ` +
    `deployment=${result.deploymentPreference} complexity=${result.complexityScore?.toFixed(2)}`,
  );
  if (!passed) {
    console.log(`   useCase: ${result.useCase}`);
  }
  return passed;
}

async function main() {
  console.log("\n=== graph-intent-classifier integration tests ===\n");
  const results = await Promise.all(TEST_CASES.map(runTest));
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  if (passed < results.length) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
