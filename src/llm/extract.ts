import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OllamaClient } from './ollama.js';
import { verifyExtractedFacts, VerificationResult, DroppedField, VerificationCounters } from './verify.js';
import { VerifiedFacts } from '../domain/facts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON Schemas for Ollama structured format
const DEADLINES_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: ['object', 'null'],
      properties: {
        value: { type: 'string', enum: ['upcoming', 'open', 'closed', 'extended', 'unknown'] },
        evidence: {
          type: 'object',
          properties: { quote: { type: 'string' }, sourceUrl: { type: 'string' }, snapshotId: { type: 'string' } },
          required: ['quote', 'sourceUrl'],
        },
      },
      required: ['value', 'evidence'],
    },
    freshApplication: {
      type: ['object', 'null'],
      properties: {
        value: { type: 'string' },
        evidence: {
          type: 'object',
          properties: { quote: { type: 'string' }, sourceUrl: { type: 'string' }, snapshotId: { type: 'string' } },
          required: ['quote', 'sourceUrl'],
        },
      },
      required: ['value', 'evidence'],
    },
    renewal: { type: ['object', 'null'] },
    instituteVerification: {
      type: ['object', 'null'],
      properties: {
        value: { type: 'string' },
        evidence: {
          type: 'object',
          properties: { quote: { type: 'string' }, sourceUrl: { type: 'string' }, snapshotId: { type: 'string' } },
          required: ['quote', 'sourceUrl'],
        },
      },
      required: ['value', 'evidence'],
    },
    stateVerification: { type: ['object', 'null'] },
    noticeType: {
      type: ['object', 'null'],
      properties: {
        value: { type: 'string', enum: ['extension', 'revision', 'new_scheme', 'corrigendum', 'none'] },
        evidence: {
          type: 'object',
          properties: { quote: { type: 'string' }, sourceUrl: { type: 'string' }, snapshotId: { type: 'string' } },
          required: ['quote', 'sourceUrl'],
        },
      },
      required: ['value', 'evidence'],
    },
  },
};

const CRITERIA_SCHEMA = {
  type: 'object',
  properties: {
    courseLevels: {
      type: ['object', 'null'],
      properties: {
        value: { type: 'array', items: { type: 'string' } },
        evidence: {
          type: 'object',
          properties: { quote: { type: 'string' }, sourceUrl: { type: 'string' } },
          required: ['quote', 'sourceUrl'],
        },
      },
    },
    categories: {
      type: ['object', 'null'],
      properties: {
        value: { type: 'array', items: { type: 'string' } },
        evidence: {
          type: 'object',
          properties: { quote: { type: 'string' }, sourceUrl: { type: 'string' } },
          required: ['quote', 'sourceUrl'],
        },
      },
    },
    states: { type: ['object', 'null'] },
    maxFamilyIncomeInr: {
      type: ['object', 'null'],
      properties: {
        value: { type: 'number' },
        evidence: {
          type: 'object',
          properties: { quote: { type: 'string' }, sourceUrl: { type: 'string' } },
          required: ['quote', 'sourceUrl'],
        },
      },
    },
    minPercent: { type: ['object', 'null'] },
    genderRestriction: { type: ['object', 'null'] },
    disabilityRequired: { type: ['object', 'null'] },
    otherConditions: { type: 'array', items: { type: 'string' } },
  },
};

const DOCUMENTS_SCHEMA = {
  type: 'object',
  properties: {
    documentsRequired: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: 'string' },
          evidence: {
            type: 'object',
            properties: { quote: { type: 'string' }, sourceUrl: { type: 'string' } },
            required: ['quote', 'sourceUrl'],
          },
        },
        required: ['value', 'evidence'],
      },
    },
  },
};

export interface ExtractionRunResult {
  verifiedFacts: VerifiedFacts;
  rawDeadlines: Record<string, any>;
  rawCriteria: Record<string, any>;
  rawDocuments: Record<string, any>;
  droppedFields: DroppedField[];
  counters: VerificationCounters;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  promptVersion: string;
}

export class Extractor {
  private client: OllamaClient;
  private promptTemplate: string;

  constructor(client?: OllamaClient) {
    this.client = client || new OllamaClient();
    const promptPath = path.join(__dirname, 'prompts', 'extract.v1.md');
    this.promptTemplate = fs.existsSync(promptPath)
      ? fs.readFileSync(promptPath, 'utf8')
      : 'SYSTEM\nExtract facts.\nUSER\n<page>{{chunkText}}</page>';
  }

  async extractFromPage(params: {
    schemeId: string;
    schemeName: string;
    sourceId: string;
    sourceUrl: string;
    snapshotId: string;
    pageText: string;
    academicYear?: string;
    trustTier?: number;
  }): Promise<ExtractionRunResult> {
    const {
      schemeId,
      schemeName,
      sourceId,
      sourceUrl,
      snapshotId,
      pageText,
      academicYear = '2026-27',
      trustTier = 1,
    } = params;

    const [sysPart, userPart] = this.promptTemplate.split('USER');
    const systemPrompt = sysPart.replace('SYSTEM', '').trim();
    const userPrompt = userPart
      .replace('{{schemeName}}', schemeName)
      .replace('{{academicYear}}', academicYear)
      .replace('{{url}}', sourceUrl)
      .replace('{{chunkText}}', pageText)
      .trim();

    let totalLatency = 0;
    let totalInTokens = 0;
    let totalOutTokens = 0;

    // Pass A: Deadlines
    const resA = await this.client.chat(systemPrompt, userPrompt, { format: DEADLINES_SCHEMA });
    totalLatency += resA.latencyMs;
    totalInTokens += resA.inputTokens;
    totalOutTokens += resA.outputTokens;
    let rawDeadlines: Record<string, any> = {};
    try {
      rawDeadlines = JSON.parse(resA.content);
    } catch {
      rawDeadlines = {};
    }

    // Pass B: Criteria
    const resB = await this.client.chat(systemPrompt, userPrompt, { format: CRITERIA_SCHEMA });
    totalLatency += resB.latencyMs;
    totalInTokens += resB.inputTokens;
    totalOutTokens += resB.outputTokens;
    let rawCriteria: Record<string, any> = {};
    try {
      rawCriteria = JSON.parse(resB.content);
    } catch {
      rawCriteria = {};
    }

    // Pass C: Documents
    const resC = await this.client.chat(systemPrompt, userPrompt, { format: DOCUMENTS_SCHEMA });
    totalLatency += resC.latencyMs;
    totalInTokens += resC.inputTokens;
    totalOutTokens += resC.outputTokens;
    let rawDocs: Record<string, any> = {};
    try {
      rawDocs = JSON.parse(resC.content);
    } catch {
      rawDocs = {};
    }

    // Verification
    const verifyDeadlines = verifyExtractedFacts(rawDeadlines, pageText, academicYear);
    const verifyCriteria = verifyExtractedFacts(rawCriteria, pageText, academicYear);
    const verifyDocuments = verifyExtractedFacts(rawDocs, pageText, academicYear);

    const allDropped = [
      ...verifyDeadlines.droppedFields,
      ...verifyCriteria.droppedFields,
      ...verifyDocuments.droppedFields,
    ];

    const totalCounters: VerificationCounters = {
      kept: verifyDeadlines.counters.kept + verifyCriteria.counters.kept + verifyDocuments.counters.kept,
      droppedQuote:
        verifyDeadlines.counters.droppedQuote +
        verifyCriteria.counters.droppedQuote +
        verifyDocuments.counters.droppedQuote,
      droppedDate:
        verifyDeadlines.counters.droppedDate +
        verifyCriteria.counters.droppedDate +
        verifyDocuments.counters.droppedDate,
      droppedNumber:
        verifyDeadlines.counters.droppedNumber +
        verifyCriteria.counters.droppedNumber +
        verifyDocuments.counters.droppedNumber,
      droppedOther:
        verifyDeadlines.counters.droppedOther +
        verifyCriteria.counters.droppedOther +
        verifyDocuments.counters.droppedOther,
    };

    const verifiedFacts: VerifiedFacts = {
      schemeId,
      deadlines: verifyDeadlines.verified as any,
      criteria: verifyCriteria.verified as any,
      documents: verifyDocuments.verified as any,
      sourceId,
      trustTier,
      sourceUrl,
      snapshotId,
      extractedAt: new Date().toISOString(),
    };

    return {
      verifiedFacts,
      rawDeadlines,
      rawCriteria,
      rawDocuments: rawDocs,
      droppedFields: allDropped,
      counters: totalCounters,
      latencyMs: totalLatency,
      inputTokens: totalInTokens,
      outputTokens: totalOutTokens,
      promptVersion: 'extract.v1',
    };
  }
}

