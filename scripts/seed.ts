import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';
import { getDatabase } from '../src/store/db.js';
import {
  SourceRepository,
  SchemeStateRepository,
  DocumentRepository,
} from '../src/store/repositories.js';
import { loadSourcesConfig } from '../src/sources/registry.js';
import { StudentProfile } from '../src/domain/profile.js';
import { evaluateEligibility } from '../src/rules/eligibility.js';

export async function seedDatabase(dbPath?: string) {
  const db = getDatabase(dbPath);
  const sourceRepo = new SourceRepository(db);
  const stateRepo = new SchemeStateRepository(db);
  const docRepo = new DocumentRepository(db);

  console.log('Seeding Scheme Sentinel Database...');

  // 1. Seed Sources
  const sources = loadSourcesConfig('./data/sources.yaml');
  for (const src of sources) {
    sourceRepo.upsert({
      id: src.id,
      url: src.url,
      kind: src.kind,
      trust_tier: src.trustTier,
      poll_minutes: src.pollMinutes,
    });
  }
  console.log(`✓ Seeded ${sources.length} sources.`);

  // 2. Load Profile
  const realProfilePath = path.resolve('./data/profile.yaml');
  const exampleProfilePath = path.resolve('./data/profile.example.yaml');
  const profilePath = fs.existsSync(realProfilePath) ? realProfilePath : exampleProfilePath;

  const profileContent = fs.readFileSync(profilePath, 'utf8');
  const profile = StudentProfile.parse(YAML.parse(profileContent));
  console.log(`✓ Loaded profile: ${profile.displayName} (${profile.courseLevel}, ${profile.category || 'General'})`);

  // 3. Seed Schemes & Initial States
  const schemesSeedPath = path.resolve('./data/schemes.seed.yaml');
  const schemesSeedContent = fs.readFileSync(schemesSeedPath, 'utf8');
  const rawSchemes = YAML.parse(schemesSeedContent);

  const allRequiredDocs = new Set<string>();

  for (const scheme of rawSchemes) {
    const evalResult = evaluateEligibility(profile, scheme.criteria || {});

    let stage = 'discovered';
    if (evalResult.overall === 'ELIGIBLE') {
      stage = 'eligible';
    } else if (evalResult.overall === 'NOT_ELIGIBLE') {
      stage = 'not_eligible';
    }

    const deadlinesJson = JSON.stringify({
      freshApplication: scheme.deadlines?.freshApplication?.date || null,
      renewal: scheme.deadlines?.renewal?.date || null,
      instituteVerification: scheme.deadlines?.instituteVerification?.date || null,
      stateVerification: scheme.deadlines?.stateVerification?.date || null,
    });

    stateRepo.upsert({
      schemeId: scheme.id,
      stage: stage as any,
      eligibility: evalResult.overall,
      eligibilityReasons: evalResult.results.map((r) => r.reason),
      deadlinesJson,
      conflictsJson: '[]',
      updatedAt: new Date().toISOString(),
    });

    if (Array.isArray(scheme.documentsRequired)) {
      for (const d of scheme.documentsRequired) {
        if (d.docType) allRequiredDocs.add(d.docType);
      }
    }

    console.log(
      `  • ${scheme.id.padEnd(24)} → Verdict: ${evalResult.overall.padEnd(12)} (Stage: ${stage})`
    );
  }

  // 4. Seed Documents Checklist
  const studentHaveDocs = ['bonafide_certificate', 'marksheet_last_exam', 'bank_passbook_or_statement'];
  for (const docType of allRequiredDocs) {
    const hasIt = studentHaveDocs.includes(docType);
    docRepo.upsert({
      id: `doc-${docType}`,
      doc_type: docType,
      status: hasIt ? 'have' : 'missing',
      issued_on: hasIt ? '2026-06-01' : null,
      valid_until: hasIt ? '2027-05-31' : null,
      updated_at: new Date().toISOString(),
    });
  }
  console.log(`✓ Initialized ${allRequiredDocs.size} checklist documents.`);

  console.log('\nDatabase seeding complete! Ready for local polling and workflows.');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase().catch(console.error);
}

