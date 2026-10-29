import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Dynamically require node:sqlite to bypass bundler static resolution issues in newer Node versions
const { DatabaseSync } = require('node:sqlite');

export class Database {
  private db: any;

  constructor(dbPath: string = ':memory:') {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(path.resolve(dbPath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      this.db.exec(sql);
    }
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public prepare(sql: string) {
    return this.db.prepare(sql);
  }

  public close(): void {
    this.db.close();
  }
}

let defaultDbInstance: Database | null = null;

export function setDatabase(db: Database): void {
  defaultDbInstance = db;
}

export function getDatabase(dbPath?: string): Database {
  if (dbPath) {
    return new Database(dbPath);
  }
  if (!defaultDbInstance) {
    const targetPath = process.env.DB_PATH || './data/sentinel.db';
    defaultDbInstance = new Database(targetPath);
  }
  return defaultDbInstance;
}
