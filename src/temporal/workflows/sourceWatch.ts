import {
  proxyActivities,
  workflowInfo,
  startChild,
} from '@temporalio/workflow';
import type { Activities } from '../activities/index.js';

const {
  fetchAndSnapshot,
  diffSnapshots,
  extractFacts,
  reconcileFacts,
  recordMetrics,
} = proxyActivities<Activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    initialInterval: '5s',
    backoffCoefficient: 2,
    maximumInterval: '5m',
    maximumAttempts: 6,
    nonRetryableErrorTypes: ['RobotsDisallowed'],
  },
});

export interface SourceWatchInput {
  sourceId: string;
}

export async function sourceWatchWorkflow(input: SourceWatchInput): Promise<{
  status: string;
  sourceId: string;
  skippedByDiff: boolean;
}> {
  const { sourceId } = input;
  const startTime = Date.now();

  // 1. Fetch & Snapshot
  const snap = await fetchAndSnapshot(sourceId);

  // 2. Short-circuit if completely unchanged
  if (snap.unchanged) {
    await recordMetrics({
      id: `met-${workflowInfo().workflowId}-${Date.now()}`,
      workflow_id: workflowInfo().workflowId,
      kind: 'watch',
      started_at: new Date(startTime).toISOString(),
      duration_ms: Date.now() - startTime,
      llm_calls: 0,
      skipped_by_diff: 1,
      input_tokens: 0,
      output_tokens: 0,
      cost_inr: 0,
    });
    return { status: 'unchanged_skipped', sourceId, skippedByDiff: true };
  }

  // 3. Diff snapshots
  if (snap.prevSnapshotId) {
    const diff = await diffSnapshots(snap.prevSnapshotId, snap.snapshotId);

    // 4. Heuristic gating: if not material, skip LLM calls!
    if (!diff.material) {
      await recordMetrics({
        id: `met-${workflowInfo().workflowId}-${Date.now()}`,
        workflow_id: workflowInfo().workflowId,
        kind: 'watch',
        started_at: new Date(startTime).toISOString(),
        duration_ms: Date.now() - startTime,
        llm_calls: 0,
        skipped_by_diff: 1,
        input_tokens: 0,
        output_tokens: 0,
        cost_inr: 0,
      });
      return { status: 'immaterial_diff_skipped', sourceId, skippedByDiff: true };
    }
  }

  // 5. Material change detected: Run Multi-Pass Extraction with Verification
  const verifiedFacts = await extractFacts({
    schemeId: sourceId,
    schemeName: sourceId,
    sourceId: snap.sourceId,
    sourceUrl: snap.sourceUrl,
    snapshotId: snap.snapshotId,
    pageText: snap.pageText,
    trustTier: snap.trustTier,
  });

  // 6. Reconcile facts
  const reconciled = await reconcileFacts({
    schemeId: sourceId,
    factSets: [verifiedFacts],
  });

  // 7. Record metric
  await recordMetrics({
    id: `met-${workflowInfo().workflowId}-${Date.now()}`,
    workflow_id: workflowInfo().workflowId,
    kind: 'watch',
    started_at: new Date(startTime).toISOString(),
    duration_ms: Date.now() - startTime,
    llm_calls: 3,
    skipped_by_diff: 0,
    input_tokens: 3500,
    output_tokens: 250,
    cost_inr: 0,
  });

  return { status: 'processed_material_change', sourceId, skippedByDiff: false };
}

