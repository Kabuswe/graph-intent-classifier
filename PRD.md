# graph-intent-classifier — Product Requirements Document

## Purpose
Single-purpose remote subgraph that receives a raw natural-language prompt from a user (e.g. from the portfolio homepage *"I'd like an agent that can..."* input) and classifies it into a structured output describing the agent type required, deployment preference, complexity, and appropriate subscription tier. This is the **entry point** for all customer discovery flows and is called as the first node in `graph-supervisor` and `graph-agent-builder`.

## Deployment
- Deployed on LangSmith Deployment as `intentClassifier`
- Registered in `langgraph.json` as `{ "graphs": { "intentClassifier": "./src/graph.ts:graph" } }`
- Also exposed as an MCP tool so the portfolio Next.js server action can call it directly without a full SDK integration

## Pipeline
```
START → parseInput → classifyIntent → resolveAgentType → scoreConfidence → END
```

### Node Responsibilities

**`parseInput`** (fastModel)
- Sanitize and normalize the raw prompt
- Strip PII if present
- Extract explicit signals: verbs (remind, monitor, summarize, scan, connect, process), named apps, data types
- Output: `normalizedPrompt`, `explicitSignals[]`

**`classifyIntent`** (fastModel, structured output)
- Map signals to one of: `rag | monitor | briefing | page-scanner | connector | builder | unknown`
- Identify primary use case description in plain English
- Detect deployment preference signals: mentions of "local", "private", "my computer" → `local`; "cloud", "anywhere", "team" → `cloud`; default → `hybrid`
- Output: `agentType`, `useCase`, `deploymentPreference`

**`resolveAgentType`** (fastModel)
- Map `agentType` to the correct LangGraph pattern: `ReAct | Plan-Execute | Supervisor | Monitor`
- Map to relevant connector requirements: which MCP servers will be needed
- Map to data sensitivity profile: `low | medium | high`
- Output: `graphPattern`, `connectorRefs[]`, `dataSensitivity`

**`scoreConfidence`** (fastModel)
- Score classification confidence 0–1
- If confidence < 0.6, set `requiresClarification: true` and generate one targeted clarifying question
- Estimate complexity score 0–1 based on connector count, data sensitivity, and agent type
- Derive `suggestedTier`: complexity < 0.3 → `starter`; < 0.7 → `pro`; ≥ 0.7 → `mission-critical`
- Output: `confidence`, `requiresClarification`, `clarifyingQuestion?`, `complexityScore`, `suggestedTier`

## State Schema
```ts
{
  // Input (from IntentClassifierInputSchema)
  rawPrompt: string;
  sessionId?: string;

  // Intermediate
  normalizedPrompt: string;
  explicitSignals: string[];

  // Classification
  agentType: AgentType;
  useCase: string;
  deploymentPreference: 'local' | 'cloud' | 'hybrid';
  graphPattern: 'ReAct' | 'Plan-Execute' | 'Supervisor' | 'Monitor';
  connectorRefs: ConnectorRef[];
  dataSensitivity: 'low' | 'medium' | 'high';

  // Scoring
  confidence: number;
  requiresClarification: boolean;
  clarifyingQuestion?: string;
  complexityScore: number;
  suggestedTier: 'starter' | 'pro' | 'mission-critical';

  // Standard
  error?: string;
  phase: string;
}
```

## Models
- All nodes: `fastModel` (openai/gpt-5-mini via OpenRouter, temperature 0)
- No reasoning model needed — this graph must be sub-200ms end-to-end

## Contracts
Import from `@kabuswe/graph-contracts`:
```ts
import { IntentClassifierInputSchema, IntentClassifierOutputSchema } from '@kabuswe/graph-contracts';
```

## Retry Policy
```ts
const standardRetry = { maxAttempts: 3, initialInterval: 1000, backoffFactor: 2 };
```
Applied to all nodes.

## Checkpointing
- Dev: `MemorySaver`
- Prod: `PostgresSaver` (same `DATABASE_URL` env var pattern as graph-ux-research)

## MCP Tool Exposure
Once deployed, register as an MCP tool server:
```ts
// Called from portfolio Next.js server action
const result = await remoteGraph.invoke({ rawPrompt: userInput }, { configurable: { thread_id: sessionId } });
```
The portfolio homepage POSTs to `/api/classify-intent` which calls this graph and returns the output to drive the discovery UI.

## Environment Variables
```
OPENROUTER_API_KEY=
LANGSMITH_API_KEY=
LANGSMITH_TRACING_V2=true
DATABASE_URL=
```

## Agent Instructions
When implementing this graph:
1. Follow the exact structural pattern from `graph-ux-research`: `StateSchema` with `lastValue()`, `standardRetry` on every node, dual `graph`/`buildGraph()` export
2. Import all types from `@kabuswe/graph-contracts` — do not define local types
3. Each node should be in its own file under `src/nodes/`
4. Use structured output (`withStructuredOutput`) on `classifyIntent` and `resolveAgentType` nodes
5. The `parseInput` node must strip any email addresses, phone numbers, or full names from `rawPrompt` before processing
6. Add a `phase` state update at the start of each node: e.g. `phase: 'classifying-intent'`
7. The graph must complete in < 3 LLM calls total
8. Write a `src/graph.test.ts` with at least 5 prompt scenarios covering each `agentType` variant

## Acceptance Criteria
- Classifies *"I'd like an agent that can remind me of things across my notes and email"* as `agentType: 'rag'`, `deploymentPreference: 'hybrid'`, `suggestedTier: 'starter'`
- Classifies *"Monitor my competitors and alert me when they publish something new"* as `agentType: 'monitor'`, `dataSensitivity: 'low'`, `suggestedTier: 'pro'`
- Classifies *"Process all my patient records and answer clinical questions locally"* as `dataSensitivity: 'high'`, `deploymentPreference: 'local'`, `suggestedTier: 'mission-critical'`
- Sub-200ms average latency on `fastModel`
- LangSmith traces show all 4 node steps
