import { ApplicationFailure } from '@temporalio/activity';
import { PoliteFetcher, RobotsDisallowedError } from '../../sources/fetcher.js';
import { diffSnapshots } from '../../sources/diff.js';
import { Extractor } from '../../llm/extract.js';
import { reconcileFacts } from '../../sources/reconcile.js';
import { evaluateEligibility } from '../../rules/eligibility.js';
import { getDatabase } from '../../store/db.js';
import {
  SourceRepository,
  SnapshotRepository,
  ChangeRepository,
  ExtractionRepository,
  SchemeStateRepository,
  AlertRepository,
  MetricRepository,
} from '../../store/repositories.js';
import { Alert } from '../../domain/alert.js';
import { StudentProfile } from '../../domain/profile.js';
import { VerifiedFacts } from '../../domain/facts.js';
import { config } from '../../config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';

export interface WatchInput {
  sourceId: string;
}

export interface FetchActivityOutput {
  snapshotId: string;
  sourceId: string;
  sourceUrl: string;
  trustTier: number;
  contentHash: string;
  prevSnapshotId?: string | null;
  unchanged: boolean;
  pageText: string;
  sentences: string[];
}

export interface DiffActivityOutput {
  material: boolean;
  materialReasons: string[];
  added: string[];
  removed: string[];
}

export interface Activities {
  fetchAndSnapshot(sourceId: string): Promise<FetchActivityOutput>;
  diffSnapshots(prevSnapshotId: string, currentSnapshotId: string): Promise<DiffActivityOutput>;
  extractFacts(input: {
    schemeId: string;
    schemeName: string;
    sourceId: string;
    sourceUrl: string;
    snapshotId: string;
    pageText: string;
    trustTier: number;
  }): Promise<VerifiedFacts>;
  reconcileFacts(input: {
    schemeId: string;
    factSets: VerifiedFacts[];
    baselineDeadlines?: Record<string, any>;
  }): Promise<any>;
  evaluateEligibility(input: {
    profile: StudentProfile;
    criteria: Record<string, any>;
  }): Promise<any>;
  loadProfile(profileId: string): Promise<StudentProfile>;
  saveSchemeState(state: any): Promise<void>;
  sendAlert(alert: Alert): Promise<boolean>;
  recordMetrics(metric: any): Promise<void>;
}

export function createActivities(dbPath?: string, fixtureMode?: boolean): Activities {
  const db = getDatabase(dbPath);
  const sourceRepo = new SourceRepository(db);
  const snapRepo = new SnapshotRepository(db);
  const changeRepo = new ChangeRepository(db);
  const extractRepo = new ExtractionRepository(db);
  const stateRepo = new SchemeStateRepository(db);
  const alertRepo = new AlertRepository(db);
  const metricRepo = new MetricRepository(db);

  const fetcher = new PoliteFetcher(
    undefined,
    fixtureMode !== undefined ? fixtureMode : config.FIXTURE_MODE
  );
  const extractor = new Extractor();

  return {
    async fetchAndSnapshot(sourceId: string): Promise<FetchActivityOutput> {
      let source = sourceRepo.findById(sourceId);
      if (!source) {
        // Fallback default
        source = {
          id: sourceId,
          url: 'https://scholarships.gov.in/',
          kind: 'html',
          trust_tier: 1,
          poll_minutes: 360,
        };
        sourceRepo.upsert(source);
      }

      let fetchRes;
      try {
        fetchRes = await fetcher.fetchSource(
          source.id,
          source.url,
          source.kind,
          source.last_etag
        );
      } catch (err: any) {
        if (err instanceof RobotsDisallowedError) {
          throw ApplicationFailure.nonRetryable(err.message, 'RobotsDisallowed');
        }
        throw err;
      }

      const prevSnap = snapRepo.findLatestBySource(sourceId);
      const isUnchanged =
        fetchRes.notModified ||
        (prevSnap !== null && prevSnap.content_hash === fetchRes.normalized.contentHash);

      const snapId = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      snapRepo.insert({
        id: snapId,
        source_id: sourceId,
        fetched_at: new Date().toISOString(),
        content_hash: fetchRes.normalized.contentHash,
        normalized_text: fetchRes.normalized.text,
        http_status: fetchRes.status,
        fixture: fetchRes.isFixture ? 1 : 0,
      });

      sourceRepo.updateChecked(sourceId, new Date().toISOString(), fetchRes.etag);

      return {
        snapshotId: snapId,
        sourceId,
        sourceUrl: source.url,
        trustTier: source.trust_tier,
        contentHash: fetchRes.normalized.contentHash,
        prevSnapshotId: prevSnap?.id ?? null,
        unchanged: isUnchanged,
        pageText: fetchRes.normalized.text,
        sentences: fetchRes.normalized.sentences,
      };
    },

    async diffSnapshots(prevSnapshotId: string, currentSnapshotId: string): Promise<DiffActivityOutput> {
      const prev = snapRepo.findById(prevSnapshotId);
      const curr = snapRepo.findById(currentSnapshotId);

      if (!curr) {
        throw ApplicationFailure.nonRetryable(`Current snapshot ${currentSnapshotId} not found`);
      }

      const prevSentences = prev ? prev.normalized_text.split('\n') : [];
      const currSentences = curr.normalized_text.split('\n');

      const diff = diffSnapshots(prevSentences, currSentences);

      const changeId = `chg-${Date.now()}`;
      changeRepo.insert({
        id: changeId,
        source_id: curr.source_id,
        from_snapshot: prevSnapshotId,
        to_snapshot: currentSnapshotId,
        diff_json: diff.diffJson,
        material: diff.material ? 1 : 0,
        material_reasons: diff.materialReasons.join('; '),
        created_at: new Date().toISOString(),
      });

      return {
        material: diff.material,
        materialReasons: diff.materialReasons,
        added: diff.added,
        removed: diff.removed,
      };
    },

    async extractFacts(input): Promise<VerifiedFacts> {
      const res = await extractor.extractFromPage({
        schemeId: input.schemeId,
        schemeName: input.schemeName,
        sourceId: input.sourceId,
        sourceUrl: input.sourceUrl,
        snapshotId: input.snapshotId,
        pageText: input.pageText,
        trustTier: input.trustTier,
      });

      const extId = `ext-${Date.now()}`;
      extractRepo.insert({
        id: extId,
        snapshot_id: input.snapshotId,
        scheme_id: input.schemeId,
        model: 'gemma4:e4b',
        prompt_version: res.promptVersion,
        pass: 'all_passes',
        output_json: JSON.stringify({
          deadlines: res.rawDeadlines,
          criteria: res.rawCriteria,
          documents: res.rawDocuments,
        }),
        verified_json: JSON.stringify(res.verifiedFacts),
        dropped_fields: JSON.stringify(res.droppedFields),
        latency_ms: res.latencyMs,
        input_tokens: res.inputTokens,
        output_tokens: res.outputTokens,
        created_at: new Date().toISOString(),
      });

      return res.verifiedFacts;
    },

    async reconcileFacts(input): Promise<any> {
      return reconcileFacts(input.schemeId, input.factSets, input.baselineDeadlines);
    },

    async evaluateEligibility(input): Promise<any> {
      return evaluateEligibility(input.profile, input.criteria);
    },

    async loadProfile(profileId: string): Promise<StudentProfile> {
      // Look for data/profile.yaml or data/profile.example.yaml
      const realProfilePath = path.resolve('./data/profile.yaml');
      const exampleProfilePath = path.resolve('./data/profile.example.yaml');

      const targetPath = fs.existsSync(realProfilePath) ? realProfilePath : exampleProfilePath;

      if (!fs.existsSync(targetPath)) {
        // Return default synthetic profile
        return StudentProfile.parse({
          id: profileId,
          displayName: 'Aman Sharma',
          fullNameOnDocuments: 'Aman Sharma',
          language: 'en',
          homeState: 'Uttar Pradesh',
          studyState: 'Delhi',
          courseLevel: 'ug',
          courseName: 'B.Tech CS',
          yearOfStudy: 2,
          institutionType: 'government',
          category: 'obc',
          annualFamilyIncomeInr: 200000,
          lastExamPercent: 78.5,
          bankAccountAadhaarSeeded: true,
        });
      }

      const content = fs.readFileSync(targetPath, 'utf8');
      const parsed = YAML.parse(content);
      return StudentProfile.parse(parsed);
    },

    async saveSchemeState(state: any): Promise<void> {
      stateRepo.upsert(state);
    },

    async sendAlert(alert: Alert): Promise<boolean> {
      // Hard rule 4: No source, no alert
      if (!alert.sourceUrl || !alert.quote || !alert.trustTier) {
        throw ApplicationFailure.nonRetryable(
          `Cannot send alert without sourceUrl, quote, or trustTier. Scheme: ${alert.schemeId}`
        );
      }

      const inserted = alertRepo.insertWithDedupe(alert);
      if (!inserted) {
        // Idempotency: duplicate alert already processed
        return false;
      }

      alertRepo.markSent(alert.id);
      return true;
    },

    async recordMetrics(metric: any): Promise<void> {
      metricRepo.record(metric);
    },
  };
}
