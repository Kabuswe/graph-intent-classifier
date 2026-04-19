/**
 * resolveAgentType — maps agentType to graphPattern, connectorRefs, and dataSensitivity.
 */

type GraphPattern = "ReAct" | "Plan-and-Execute" | "Supervisor" | "Multi-Agent-Swarm" | "Remote-Subgraph";

interface AgentTypeProfile {
  graphPattern: GraphPattern;
  defaultConnectorRefs: string[];
  dataSensitivity: "low" | "medium" | "high";
}

const AGENT_PROFILES: Record<string, AgentTypeProfile> = {
  rag: {
    graphPattern: "ReAct",
    defaultConnectorRefs: ["doc-ingestion", "rag-retriever"],
    dataSensitivity: "medium",
  },
  monitor: {
    graphPattern: "Plan-and-Execute",
    defaultConnectorRefs: ["page-scanner", "web-researcher"],
    dataSensitivity: "low",
  },
  briefing: {
    graphPattern: "Supervisor",
    defaultConnectorRefs: ["web-researcher", "rag-retriever"],
    dataSensitivity: "low",
  },
  "page-scanner": {
    graphPattern: "ReAct",
    defaultConnectorRefs: ["page-scanner"],
    dataSensitivity: "low",
  },
  connector: {
    graphPattern: "Remote-Subgraph",
    defaultConnectorRefs: ["connector-orchestrator"],
    dataSensitivity: "medium",
  },
  builder: {
    graphPattern: "Plan-and-Execute",
    defaultConnectorRefs: ["intent-classifier", "ux-research"],
    dataSensitivity: "low",
  },
  "doc-processor": {
    graphPattern: "ReAct",
    defaultConnectorRefs: ["doc-processor", "doc-ingestion"],
    dataSensitivity: "medium",
  },
  journal: {
    graphPattern: "ReAct",
    defaultConnectorRefs: ["journal-enricher"],
    dataSensitivity: "high",
  },
  email: {
    graphPattern: "Remote-Subgraph",
    defaultConnectorRefs: ["email-processor", "connector-orchestrator"],
    dataSensitivity: "high",
  },
  custom: {
    graphPattern: "Multi-Agent-Swarm",
    defaultConnectorRefs: [],
    dataSensitivity: "medium",
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolveAgentTypeNode = async (state: any) => {
  const { agentType, deploymentPreference, explicitSignals } = state;

  const profile = AGENT_PROFILES[agentType] ?? AGENT_PROFILES["custom"];

  // If deployment is local, elevate data sensitivity
  let dataSensitivity = profile.dataSensitivity;
  if (deploymentPreference === "local" && dataSensitivity === "low") {
    dataSensitivity = "medium";
  }

  // Check explicit signals for additional connector refs
  const extraConnectors: string[] = [];
  for (const signal of (explicitSignals ?? []) as string[]) {
    if (signal.includes("slack")) extraConnectors.push("slack-connector");
    if (signal.includes("github")) extraConnectors.push("github-connector");
    if (signal.includes("notion")) extraConnectors.push("notion-connector");
  }

  const connectorRefs = [...new Set([...profile.defaultConnectorRefs, ...extraConnectors])];

  return {
    phase: "resolve-agent-type",
    graphPattern: profile.graphPattern,
    connectorRefs,
    dataSensitivity,
  };
};
