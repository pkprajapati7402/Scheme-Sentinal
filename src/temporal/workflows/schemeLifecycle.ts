import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  workflowInfo,
  continueAsNew,
} from '@temporalio/workflow';
import type { Activities } from '../activities/index.js';
import type { SchemeStage, EligibilityVerdict } from '../../domain/scheme.js';

const {
  evaluateEligibility,
  loadProfile,
  saveSchemeState,
  sendAlert,
} = proxyActivities<Activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '2s',
    maximumAttempts: 5,
  },
});

export interface SchemeLifecycleInput {
  profileId: string;
  schemeId: string;
  initialStage?: SchemeStage;
  initialDeadline?: string | null;
}

export interface SchemeLifecycleState {
  schemeId: string;
  profileId: string;
  stage: SchemeStage;
  eligibility: EligibilityVerdict;
  eligibilityReasons: string[];
  deadlines: Record<string, any>;
  conflicts: any[];
  snoozedUntil?: string | null;
  lastUpdated: string;
}

// Signals
export const factsUpdatedSignal = defineSignal<[any]>('factsUpdated');
export const profileUpdatedSignal = defineSignal<[any]>('profileUpdated');
export const docsStatusChangedSignal = defineSignal<[any]>('docsStatusChanged');
export const userConfirmedAppliedSignal = defineSignal<[{ appliedOn: string }]>('userConfirmedApplied');
export const stageAdvancedSignal = defineSignal<[{ stage: SchemeStage; evidence?: any }]>('stageAdvanced');
export const snoozeSignal = defineSignal<[{ untilIso: string }]>('snooze');

// Queries
export const getStateQuery = defineQuery<SchemeLifecycleState, []>('getState');

export async function schemeLifecycleWorkflow(
  input: SchemeLifecycleInput
): Promise<SchemeLifecycleState> {
  const { profileId, schemeId } = input;

  // Initial state
  let stage: SchemeStage = input.initialStage || 'discovered';
  let eligibility: EligibilityVerdict = 'UNKNOWN';
  let eligibilityReasons: string[] = [];
  let deadlines: Record<string, any> = input.initialDeadline
    ? { freshApplication: input.initialDeadline }
    : {};
  let conflicts: any[] = [];
  let snoozedUntil: string | null = null;
  let sentReminders = new Set<string>();

  const inbox: Array<{ type: string; payload: any }> = [];

  // Register signal handlers
  setHandler(factsUpdatedSignal, (payload) => {
    inbox.push({ type: 'factsUpdated', payload });
  });

  setHandler(profileUpdatedSignal, (payload) => {
    inbox.push({ type: 'profileUpdated', payload });
  });

  setHandler(docsStatusChangedSignal, (payload) => {
    inbox.push({ type: 'docsStatusChanged', payload });
  });

  setHandler(userConfirmedAppliedSignal, (payload) => {
    inbox.push({ type: 'userConfirmedApplied', payload });
  });

  setHandler(stageAdvancedSignal, (payload) => {
    inbox.push({ type: 'stageAdvanced', payload });
  });

  setHandler(snoozeSignal, (payload) => {
    inbox.push({ type: 'snooze', payload });
  });

  // Register query handler
  setHandler(getStateQuery, () => ({
    schemeId,
    profileId,
    stage,
    eligibility,
    eligibilityReasons,
    deadlines,
    conflicts,
    snoozedUntil,
    lastUpdated: new Date().toISOString(),
  }));

  // Initial eligibility evaluation
  let profile = await loadProfile(profileId);
  const initialEval = await evaluateEligibility({
    profile,
    criteria: {},
  });
  eligibility = initialEval.overall;
  eligibilityReasons = initialEval.results?.map((r: any) => r.reason) || [];

  if (eligibility === 'ELIGIBLE' && stage === 'discovered') {
    stage = 'eligible';
  }

  // Save initial state to store
  await saveSchemeState({
    schemeId,
    stage,
    eligibility,
    eligibilityReasons,
    deadlinesJson: JSON.stringify(deadlines),
    conflictsJson: JSON.stringify(conflicts),
    updatedAt: new Date().toISOString(),
  });

  // Durable lifecycle loop
  const isTerminal = () =>
    stage === 'disbursed' || stage === 'closed_missed' || stage === 'not_eligible';

  while (!isTerminal()) {
    // Process any pending inbox items
    while (inbox.length > 0) {
      const msg = inbox.shift()!;
      if (msg.type === 'userConfirmedApplied') {
        stage = 'applied';
        await saveSchemeState({
          schemeId,
          stage,
          eligibility,
          eligibilityReasons,
          deadlinesJson: JSON.stringify(deadlines),
          conflictsJson: JSON.stringify(conflicts),
          updatedAt: new Date().toISOString(),
        });
      } else if (msg.type === 'stageAdvanced') {
        stage = msg.payload.stage;
      } else if (msg.type === 'snooze') {
        snoozedUntil = msg.payload.untilIso;
      } else if (msg.type === 'factsUpdated') {
        const facts = msg.payload;
        if (facts.deadlines) {
          const oldDeadline = deadlines.freshApplication;
          const newDeadline = facts.deadlines.freshApplication;

          if (newDeadline && oldDeadline && newDeadline !== oldDeadline) {
            // Deadline changed: send deadline_changed alert
            const alertId = `alert-chg-${schemeId}-${newDeadline}-${Date.now()}`;
            await sendAlert({
              id: alertId,
              schemeId,
              type: 'deadline_changed',
              severity: 'warning',
              dedupeKey: `deadline_changed:${schemeId}:${newDeadline}`,
              sourceUrl: facts.primarySourceUrl || 'https://scholarships.gov.in',
              quote: facts.primaryQuote || `Deadline revised to ${newDeadline}`,
              trustTier: facts.highestTrustTier || 1,
              textEn: `🔔 Update for ${schemeId}: last date changed ${oldDeadline} → ${newDeadline}`,
              textHi: `🔔 ${schemeId} के लिए सूचना: अंतिम तिथि बदलकर ${newDeadline} कर दी गई है।`,
              channel: 'telegram',
              sentAt: null,
              ackedAt: null,
            });
            // Reset sent reminders so new plan can trigger
            sentReminders.clear();
          }

          deadlines = { ...deadlines, ...facts.deadlines };
        }

        if (facts.conflicts && facts.conflicts.length > 0) {
          conflicts = facts.conflicts;
        }

        if (facts.criteria) {
          const evalRes = await evaluateEligibility({
            profile,
            criteria: facts.criteria,
          });
          eligibility = evalRes.overall;
          eligibilityReasons = evalRes.results?.map((r: any) => r.reason) || [];
          if (eligibility === 'NOT_ELIGIBLE') {
            stage = 'not_eligible';
          }
        }
      }

      await saveSchemeState({
        schemeId,
        stage,
        eligibility,
        eligibilityReasons,
        deadlinesJson: JSON.stringify(deadlines),
        conflictsJson: JSON.stringify(conflicts),
        updatedAt: new Date().toISOString(),
      });
    }

    // Compute wait time for next event or signal
    const woke = await condition(() => inbox.length > 0, '1 hour');

    if (!woke) {
      // Periodic check or reminder trigger
      const deadline = deadlines.freshApplication;
      if (deadline && stage !== 'applied' && stage !== 'not_eligible') {
        const offsetLabel = 'T-7';
        const dedupeKey = `reminder:${schemeId}:${deadline}:${offsetLabel}`;

        if (!sentReminders.has(dedupeKey)) {
          const alertId = `rem-${schemeId}-${Date.now()}`;
          const sent = await sendAlert({
            id: alertId,
            schemeId,
            type: 'reminder',
            severity: 'info',
            dedupeKey,
            sourceUrl: 'https://scholarships.gov.in',
            quote: `The last date for submission of online application is ${deadline}.`,
            trustTier: 1,
            textEn: `⏰ ${schemeId}: last date ${deadline}`,
            textHi: `⏰ ${schemeId}: अंतिम तिथि ${deadline}`,
            channel: 'telegram',
            sentAt: null,
            ackedAt: null,
          });
          if (sent) {
            sentReminders.add(dedupeKey);
          }
        }
      }
    }

    if (workflowInfo().historyLength > 2000) {
      await continueAsNew<typeof schemeLifecycleWorkflow>({
        profileId,
        schemeId,
        initialStage: stage,
        initialDeadline: deadlines.freshApplication,
      });
    }
  }

  return {
    schemeId,
    profileId,
    stage,
    eligibility,
    eligibilityReasons,
    deadlines,
    conflicts,
    snoozedUntil,
    lastUpdated: new Date().toISOString(),
  };
}

