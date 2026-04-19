/**
 * graph-intent-classifier
 *
 * Pipeline: parseInput → classifyIntent → resolveAgentType → scoreConfidence
 *
 * Input:  IntentClassifierInput  (rawPrompt, sessionId?)
 * Output: IntentClassifierOutput (agentType, useCase, deploymentPreference, complexityScore, suggestedTier, confidence)
 *
 * TODO: implement nodes under src/nodes/ per PRD.md
 * TODO: import contracts from @kabuswe/graph-contracts once published
 */

import { StateGraph, START, END, MemorySaver, StateSchema, UntrackedValue } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import pg from 'pg';
import { z } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lastValue<T>(schema: z.ZodType<T, any, any>): UntrackedValue<T> {
  return schema as unknown as UntrackedValue<T>;
}

const IntentState = new StateSchema({
  rawPrompt:             lastValue(z.string().default('')),
  sessionId:             lastValue(z.string().optional()),
  normalizedPrompt:      lastValue(z.string().default('')),
  explicitSignals:       lastValue(z.array(z.string()).default(() => [])),
  agentType:             lastValue(z.string().default('')),
  useCase:               lastValue(z.string().default('')),
  deploymentPreference:  lastValue(z.enum(['local', 'cloud', 'hybrid']).default('hybrid')),
  graphPattern:          lastValue(z.string().default('')),
  connectorRefs:         lastValue(z.array(z.string()).default(() => [])),
  dataSensitivity:       lastValue(z.enum(['low', 'medium', 'high']).default('low')),
  confidence:            lastValue(z.number().default(0)),
  requiresClarification: lastValue(z.boolean().default(false)),
  clarifyingQuestion:    lastValue(z.string().optional()),
  complexityScore:       lastValue(z.number().default(0)),
  suggestedTier:         lastValue(z.enum(['starter', 'pro', 'mission-critical']).default('starter')),
  error:                 lastValue(z.string().optional()),
  phase:                 lastValue(z.string().default('')),
});

const standardRetry = { maxAttempts: 3, initialInterval: 1000, backoffFactor: 2 };

// TODO: replace stubs with real node imports
const parseInputNode      = async (state: any) => ({ phase: 'parse-input', normalizedPrompt: state.rawPrompt, explicitSignals: [] });
const classifyIntentNode  = async (state: any) => ({ phase: 'classify-intent', agentType: 'unknown', useCase: '', deploymentPreference: 'hybrid' as const });
const resolveAgentTypeNode = async (state: any) => ({ phase: 'resolve-agent-type', graphPattern: 'ReAct', connectorRefs: [], dataSensitivity: 'low' as const });
const scoreConfidenceNode  = async (state: any) => ({ phase: 'score-confidence', confidence: 0, requiresClarification: true, complexityScore: 0, suggestedTier: 'starter' as const });

function assembleGraph(checkpointer?: MemorySaver) {
  const builder = new StateGraph(IntentState)
    .addNode('parseInput',       parseInputNode,       { retryPolicy: standardRetry })
    .addNode('classifyIntent',   classifyIntentNode,   { retryPolicy: standardRetry })
    .addNode('resolveAgentType', resolveAgentTypeNode, { retryPolicy: standardRetry })
    .addNode('scoreConfidence',  scoreConfidenceNode,  { retryPolicy: standardRetry })
    .addEdge(START, 'parseInput')
    .addEdge('parseInput', 'classifyIntent')
    .addEdge('classifyIntent', 'resolveAgentType')
    .addEdge('resolveAgentType', 'scoreConfidence')
    .addEdge('scoreConfidence', END);

  return checkpointer ? builder.compile({ checkpointer }) : builder.compile();
}

export const graph: any = assembleGraph(new MemorySaver());

export async function buildGraph(): Promise<any> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const checkpointer = new PostgresSaver(pool);
  await checkpointer.setup();
  return assembleGraph(checkpointer as unknown as MemorySaver);
}
