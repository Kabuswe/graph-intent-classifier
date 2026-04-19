/**
 * parseInput — normalizes the raw prompt and extracts explicit intent signals.
 */

const DEPLOYMENT_SIGNALS: Record<string, string> = {
  local: "local", "on-device": "local", offline: "local", private: "local", "self-host": "local",
  cloud: "cloud", api: "cloud", server: "cloud", saas: "cloud", deploy: "cloud", webhook: "cloud",
};

const AGENT_SIGNALS: Record<string, string> = {
  email: "email", inbox: "email", reply: "email", draft: "email",
  rag: "rag", "knowledge base": "rag", retrieval: "rag", vector: "rag",
  document: "doc-processor", pdf: "doc-processor", summarize: "doc-processor",
  journal: "journal", diary: "journal", reflection: "journal", notes: "journal",
  monitor: "monitor", watch: "monitor", alert: "monitor", scrape: "monitor",
  page: "page-scanner", scan: "page-scanner", crawl: "page-scanner",
  connect: "connector", slack: "connector", github: "connector", notion: "connector",
  briefing: "briefing", summary: "briefing", daily: "briefing",
  "build agent": "builder", "create agent": "builder",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parseInputNode = async (state: any) => {
  const raw: string = state.rawPrompt ?? "";

  // Normalize
  const normalizedPrompt = raw.trim().replace(/\s+/g, " ");
  const lower = normalizedPrompt.toLowerCase();

  // Extract explicit signals
  const explicitSignals: string[] = [];

  for (const [keyword, signal] of Object.entries(DEPLOYMENT_SIGNALS)) {
    if (lower.includes(keyword)) explicitSignals.push(`deployment:${signal}`);
  }

  for (const [keyword, signal] of Object.entries(AGENT_SIGNALS)) {
    if (lower.includes(keyword)) explicitSignals.push(`agent:${signal}`);
  }

  // Deduplicate
  const unique = [...new Set(explicitSignals)];

  return {
    phase: "parse-input",
    normalizedPrompt,
    explicitSignals: unique,
  };
};
