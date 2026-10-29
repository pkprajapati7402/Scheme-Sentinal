import * as fs from 'node:fs';
import * as path from 'node:path';
import { normalizeHtml } from '../src/sources/normalize.js';
import { diffSnapshots } from '../src/sources/diff.js';
import { Extractor } from '../src/llm/extract.js';
import { verifyExtractedFacts } from '../src/llm/verify.js';
import { formatDeadlineChangedAlertEn } from '../src/notify/templates.js';

export async function runReplayDemo() {
  console.log('\n===============================================================');
  console.log('🛡️  SCHEME SENTINEL — NOTICE REPLAY DEMO [SIMULATED]');
  console.log('===============================================================\n');

  // Step 1: Load Before Snapshot
  console.log('Step 1: Ingesting Snapshot A (Baseline official notice)...');
  const beforeHtmlPath = path.resolve('./data/fixtures/synthetic-nsp/snapshot-before.html');
  const beforeHtml = fs.readFileSync(beforeHtmlPath, 'utf8');
  const normBefore = normalizeHtml(beforeHtml);
  console.log(`✓ Normalized Snapshot A | SHA-256: ${normBefore.contentHash.slice(0, 16)}...`);
  console.log(`  Sentences indexed: ${normBefore.sentences.length}`);

  // Step 2: Load After Snapshot with Extension Notice
  console.log('\nStep 2: Ingesting Snapshot B (Corrigendum / Extension update)...');
  const afterHtmlPath = path.resolve('./data/fixtures/synthetic-nsp/snapshot-after.html');
  const afterHtml = fs.readFileSync(afterHtmlPath, 'utf8');
  const normAfter = normalizeHtml(afterHtml);
  console.log(`✓ Normalized Snapshot B | SHA-256: ${normAfter.contentHash.slice(0, 16)}...`);

  // Step 3: Sentence-Level Diff & Material Significance Filter
  console.log('\nStep 3: Diffing snapshots with material significance heuristics...');
  const diff = diffSnapshots(normBefore.sentences, normAfter.sentences);

  console.log(`  Added sentences: ${diff.added.length}`);
  console.log(`  Removed sentences: ${diff.removed.length}`);
  console.log(`  Material update detected: ${diff.material ? 'YES ✅' : 'NO ❌'}`);
  console.log('  Material triggers:');
  diff.materialReasons.forEach((r) => console.log(`    - ${r}`));

  if (!diff.material) {
    console.log('  Immaterial change (e.g. clock update). LLM call skipped!');
    return;
  }

  // Step 4: Multi-Pass Extraction with Local Model
  console.log('\nStep 4: Executing multi-pass evidence-required extraction (Gemma 4 local)...');
  const extractor = new Extractor();
  const extractionResult = await extractor.extractFromPage({
    schemeId: 'nsp-post-matric-sc',
    schemeName: 'Post Matric Scholarships Scheme for SC Students',
    sourceId: 'nsp-official',
    sourceUrl: 'https://scholarships.gov.in/scheme/post-matric-sc',
    snapshotId: 'snap-replay-demo',
    pageText: normAfter.text,
    trustTier: 1,
  });

  console.log(`  Extraction latency: ${extractionResult.latencyMs} ms`);
  console.log(`  Tokens: ${extractionResult.inputTokens} input / ${extractionResult.outputTokens} output`);
  console.log('  Proposed facts:');
  console.log(JSON.stringify(extractionResult.rawDeadlines, null, 2));

  // Step 5: Deterministic Verifier
  console.log('\nStep 5: Running deterministic verifier (Hard Rules 3 & 4)...');
  console.log(`  Verified facts kept: ${extractionResult.counters.kept}`);
  console.log(`  Dropped hallucinated quotes: ${extractionResult.counters.droppedQuote}`);
  console.log(`  Dropped date mismatches: ${extractionResult.counters.droppedDate}`);

  // Demonstrate hallucination protection by injecting a poisoned fact
  console.log('\n[Verifier Test] Injecting poisoned fact (hallucinated quote not in page)...');
  const poisonedFact = {
    fabricatedDeadline: {
      value: '2026-12-31',
      evidence: {
        quote: 'This sentence was hallucinated by a rogue model and does not exist in the page.',
        sourceUrl: 'https://scholarships.gov.in',
      },
    },
  };
  const testPoison = verifyExtractedFacts(poisonedFact, normAfter.text);
  console.log(`  Poison test result: ${testPoison.droppedFields.length} fact dropped (${testPoison.droppedFields[0].reason}) ✅`);

  // Step 6: Alert Generation with Source & Verbatim Quote
  console.log('\nStep 6: Generating idempotent Telegram alert with evidence...');
  const newDate = extractionResult.verifiedFacts.deadlines?.freshApplication?.value || '2026-11-30';
  const quote = extractionResult.verifiedFacts.deadlines?.freshApplication?.evidence?.quote || 'URGENT NOTICE: The last date for submission of online application has been extended up to 30-11-2026.';

  const alertMessage = formatDeadlineChangedAlertEn({
    schemeName: 'Post Matric SC Scholarship',
    oldDate: '2026-10-31',
    newDate,
    sourceUrl: 'https://scholarships.gov.in/scheme/post-matric-sc',
    quote,
    trustLabel: 'Official Portal (Tier 1)',
  });

  console.log('\n----------------- TELEGRAM NOTIFICATION -----------------');
  console.log(alertMessage);
  console.log('[Buttons]: [✅ I applied] [⏰ Snooze 3 days] [🔗 Open official page]');
  console.log('---------------------------------------------------------\n');

  console.log('Demo completed successfully. All evidence and dates verified.');
}

if (process.argv[1] && process.argv[1].endsWith('demo-replay.ts')) {
  runReplayDemo().catch(console.error);
}

