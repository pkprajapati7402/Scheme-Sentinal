import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getDatabase } from '../../store/db.js';
import {
  SchemeStateRepository,
  DocumentRepository,
  SourceRepository,
} from '../../store/repositories.js';
import { getDaysLeft } from '../../rules/deadlines.js';

export const getProfileSummaryTool = createTool({
  id: 'getProfileSummary',
  description: 'Returns safe student profile summary without sensitive identifiers',
  inputSchema: z.object({}),
  execute: async () => {
    return {
      displayName: 'Student',
      courseLevel: 'ug',
      courseName: 'B.Tech Computer Science',
      homeState: 'Uttar Pradesh',
      studyState: 'Delhi',
      yearOfStudy: 2,
    };
  },
});

export const listSchemesTool = createTool({
  id: 'listSchemes',
  description: 'Lists all watched scholarship schemes and their current status',
  inputSchema: z.object({}),
  execute: async () => {
    const db = getDatabase();
    const repo = new SchemeStateRepository(db);
    const schemes = repo.listAll();
    return schemes.map((s) => ({
      schemeId: s.schemeId,
      stage: s.stage,
      eligibility: s.eligibility,
      deadlines: JSON.parse(s.deadlinesJson || '{}'),
    }));
  },
});

export const getSchemeStateTool = createTool({
  id: 'getSchemeState',
  description: 'Gets current stage, eligibility reasons, and verified deadlines for a scheme',
  inputSchema: z.object({
    schemeId: z.string(),
  }),
  execute: async (input: { schemeId: string }) => {
    const db = getDatabase();
    const repo = new SchemeStateRepository(db);
    const state = repo.findById(input.schemeId);
    if (!state) {
      return { error: `Scheme "${input.schemeId}" not found` };
    }
    return {
      schemeId: state.schemeId,
      stage: state.stage,
      eligibility: state.eligibility,
      reasons: state.eligibilityReasons,
      deadlines: JSON.parse(state.deadlinesJson || '{}'),
      conflicts: JSON.parse(state.conflictsJson || '[]'),
    };
  },
});

export const getChecklistTool = createTool({
  id: 'getChecklist',
  description: 'Returns the document readiness checklist',
  inputSchema: z.object({}),
  execute: async () => {
    const db = getDatabase();
    const repo = new DocumentRepository(db);
    const docs = repo.listAll();
    return docs.map((d) => ({
      docType: d.doc_type,
      status: d.status,
      issuedOn: d.issued_on,
      validUntil: d.valid_until,
    }));
  },
});

export const getUpcomingDeadlinesTool = createTool({
  id: 'getUpcomingDeadlines',
  description: 'Returns deadlines approaching within the specified number of days',
  inputSchema: z.object({
    withinDays: z.number().default(30),
  }),
  execute: async (input: { withinDays: number }) => {
    const db = getDatabase();
    const repo = new SchemeStateRepository(db);
    const schemes = repo.listAll();

    const upcoming: any[] = [];
    for (const s of schemes) {
      try {
        const d = JSON.parse(s.deadlinesJson || '{}');
        const deadline = d.freshApplication;
        if (deadline) {
          const daysLeft = getDaysLeft(deadline);
          if (daysLeft >= 0 && daysLeft <= input.withinDays) {
            upcoming.push({
              schemeId: s.schemeId,
              deadline,
              daysLeft,
              stage: s.stage,
            });
          }
        }
      } catch {}
    }

    return upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
  },
});
