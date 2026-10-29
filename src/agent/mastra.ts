import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import {
  getProfileSummaryTool,
  listSchemesTool,
  getSchemeStateTool,
  getChecklistTool,
  getUpcomingDeadlinesTool,
} from './tools/index.js';
import { config } from '../config.js';

export const qaAgent = new Agent({
  id: 'qa-agent',
  name: 'SchemeSentinelQA',
  model: { id: 'ollama/gemma4:e4b', url: config.OLLAMA_HOST },
  instructions: `
You are Scheme Sentinel's student assistant.
Answer questions about scholarships, upcoming deadlines, required documents, and application stages.
Rules:
1. ONLY use information returned by your tools. Never fabricate deadlines or eligibility criteria.
2. If a deadline or scheme is unknown or not returned by a tool, honestly say that it is not yet verified.
3. Always include the official portal link and encourage the student to verify directly before applying.
`,
  tools: {
    getProfileSummary: getProfileSummaryTool,
    listSchemes: listSchemesTool,
    getSchemeState: getSchemeStateTool,
    getChecklist: getChecklistTool,
    getUpcomingDeadlines: getUpcomingDeadlinesTool,
  },
});

export const mastra = new Mastra({
  agents: {
    qaAgent,
  },
});
