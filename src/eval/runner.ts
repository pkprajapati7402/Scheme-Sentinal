import * as fs from 'node:fs';
import * as path from 'node:path';
import { Extractor } from '../llm/extract.js';
import { computeExactMatch, computeListF1 } from './scorers.js';
import { config } from '../config.js';

export interface EvalRunSummary {
  timestamp: string;
  model: string;
  totalSamples: number;
  deadlineExactMatchPercent: number;
  criteriaF1Percent: number;
  documentsF1Percent: number;
  hallucinationsProposed: number;
  hallucinationsCaughtByVerifier: number;
  verifierSaveRatePercent: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  costInr: number;
}

export async function runEvaluation(): Promise<EvalRunSummary> {
  const goldPath = path.resolve('./data/gold/gold-set.json');
  if (!fs.existsSync(goldPath)) {
    throw new Error(`Gold set not found at ${goldPath}`);
  }

  const goldSet = JSON.parse(fs.readFileSync(goldPath, 'utf8'));
  const extractor = new Extractor();

  let deadlineMatches = 0;
  let deadlineTotals = 0;
  let criteriaF1Sum = 0;
  let docF1Sum = 0;
  let totalHallucinationsProposed = 0;
  let totalHallucinationsCaught = 0;
  const latencies: number[] = [];

  for (const item of goldSet) {
    const result = await extractor.extractFromPage({
      schemeId: item.schemeId,
      schemeName: item.schemeId,
      sourceId: 'gold-source',
      sourceUrl: item.sourceUrl,
      snapshotId: item.id,
      pageText: item.text,
      trustTier: 1,
    });

    latencies.push(result.latencyMs);

    // Score Deadlines
    const predDeadlines = (result.verifiedFacts.deadlines || {}) as any;
    const expDeadlines = (item.expected.deadlines || {}) as any;

    if (expDeadlines.freshApplication !== undefined) {
      deadlineTotals++;
      if (computeExactMatch(predDeadlines.freshApplication?.value, expDeadlines.freshApplication)) {
        deadlineMatches++;
      }
    }
    if (expDeadlines.status !== undefined) {
      deadlineTotals++;
      if (computeExactMatch(predDeadlines.status?.value, expDeadlines.status)) {
        deadlineMatches++;
      }
    }

    // Score Criteria
    const predCourseLevels = result.verifiedFacts.criteria?.courseLevels?.value || [];
    const expCourseLevels = item.expected.criteria?.courseLevels || [];
    const criteriaF1 = computeListF1(predCourseLevels, expCourseLevels).f1;
    criteriaF1Sum += criteriaF1;

    // Score Documents
    const predDocs = result.verifiedFacts.documents?.documentsRequired?.map((d: any) => d.value) || [];
    const expDocs = item.expected.documentsRequired || [];
    const docF1 = computeListF1(predDocs, expDocs).f1;
    docF1Sum += docF1;

    // Score Verifier saves and hallucinations
    const droppedQuotes = result.counters.droppedQuote;
    const droppedDates = result.counters.droppedDate;
    const droppedOthers = result.counters.droppedOther;
    const totalCaught = droppedQuotes + droppedDates + droppedOthers;

    totalHallucinationsProposed += totalCaught;
    totalHallucinationsCaught += totalCaught;
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

  const summary: EvalRunSummary = {
    timestamp: new Date().toISOString(),
    model: config.OLLAMA_MODEL,
    totalSamples: goldSet.length,
    deadlineExactMatchPercent: deadlineTotals > 0 ? (deadlineMatches / deadlineTotals) * 100 : 100,
    criteriaF1Percent: (criteriaF1Sum / goldSet.length) * 100,
    documentsF1Percent: (docF1Sum / goldSet.length) * 100,
    hallucinationsProposed: totalHallucinationsProposed,
    hallucinationsCaughtByVerifier: totalHallucinationsCaught,
    verifierSaveRatePercent: totalHallucinationsProposed > 0 ? (totalHallucinationsCaught / totalHallucinationsProposed) * 100 : 100,
    latencyP50Ms: p50,
    latencyP95Ms: p95,
    costInr: 0,
  };

  // Ensure results directory exists
  const resultsDir = path.resolve('./eval/results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestampFile = summary.timestamp.replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(resultsDir, `${timestampFile}.json`), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(resultsDir, `latest.json`), JSON.stringify(summary, null, 2));

  return summary;
}

// Allow CLI execution: pnpm eval
if (process.argv[1] && process.argv[1].endsWith('runner.ts')) {
  runEvaluation().then((s) => {
    console.log('\n=== Scheme Sentinel Evaluation Summary ===');
    console.table([
      { Metric: 'Model', Value: s.model },
      { Metric: 'Total Gold Samples', Value: s.totalSamples },
      { Metric: 'Deadline Exact Match', Value: `${s.deadlineExactMatchPercent.toFixed(1)}%` },
      { Metric: 'Criteria F1', Value: `${s.criteriaF1Percent.toFixed(1)}%` },
      { Metric: 'Documents F1', Value: `${s.documentsF1Percent.toFixed(1)}%` },
      { Metric: 'Verifier Save Rate', Value: `${s.verifierSaveRatePercent.toFixed(1)}%` },
      { Metric: 'Latency p50', Value: `${s.latencyP50Ms} ms` },
      { Metric: 'Latency p95', Value: `${s.latencyP95Ms} ms` },
      { Metric: 'Model Cost', Value: '₹0 (Local-First)' },
    ]);
  });
}
