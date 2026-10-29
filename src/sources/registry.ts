import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';

export const SourceConfigSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  kind: z.enum(['html', 'pdf', 'rss']),
  trustTier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  pollMinutes: z.number().int().positive().default(360),
});

export type SourceConfig = z.infer<typeof SourceConfigSchema>;

export function loadSourcesConfig(yamlPath: string = './data/sources.yaml'): SourceConfig[] {
  const fullPath = path.resolve(yamlPath);
  if (!fs.existsSync(fullPath)) {
    return [];
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  const parsed = YAML.parse(content);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array of sources in ${yamlPath}`);
  }
  return parsed.map((item) => SourceConfigSchema.parse(item));
}

