import * as fs from 'node:fs';
import * as path from 'node:path';
import robotsParser from 'robots-parser';
import pdfParse from 'pdf-parse';
import { config } from '../config.js';
import { normalizeHtml, cleanAndHashText, NormalizedResult } from './normalize.js';

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt disallows access to ${url}`);
    this.name = 'RobotsDisallowedError';
  }
}

export interface FetchResult {
  sourceId: string;
  url: string;
  status: number;
  etag?: string | null;
  normalized: NormalizedResult;
  isFixture: boolean;
  notModified?: boolean;
}

// Host-based robots parser cache
const robotsCache: Map<string, any> = new Map();
// Host-based rate limit timestamps
const lastHostFetchTimes: Map<string, number> = new Map();

/**
 * Polite HTTP fetcher respecting robots.txt, ETag, rate limits, and Fixture Mode.
 */
export class PoliteFetcher {
  private userAgent: string;
  private fixtureMode: boolean;

  constructor(userAgent?: string, fixtureMode?: boolean) {
    this.userAgent = userAgent || config.USER_AGENT;
    this.fixtureMode = fixtureMode !== undefined ? fixtureMode : config.FIXTURE_MODE;
  }

  async fetchSource(
    sourceId: string,
    url: string,
    kind: 'html' | 'pdf' | 'rss' = 'html',
    lastEtag?: string | null
  ): Promise<FetchResult> {
    // 1. Check Fixture Mode first
    if (this.fixtureMode) {
      return this.fetchFromFixture(sourceId, url, kind);
    }

    const parsedUrl = new URL(url);

    // 2. Robots.txt check
    await this.checkRobotsTxt(parsedUrl);

    // 3. Polite Rate Limiting (min 1 second between requests to the same host)
    await this.applyRateLimit(parsedUrl.host);

    // 4. Perform HTTP fetch with timeout and ETag
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      Accept: kind === 'pdf' ? 'application/pdf' : 'text/html,application/xhtml+xml,text/plain',
    };

    if (lastEtag) {
      headers['If-None-Match'] = lastEtag;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
      res = await fetch(url, {
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });
    } finally {
      clearTimeout(timeout);
    }

    if (res.status === 304) {
      return {
        sourceId,
        url,
        status: 304,
        etag: lastEtag,
        normalized: { text: '', sentences: [], contentHash: '' },
        isFixture: false,
        notModified: true,
      };
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }

    const etag = res.headers.get('etag');
    let normalized: NormalizedResult;

    if (kind === 'pdf') {
      const buffer = Buffer.from(await res.arrayBuffer());
      const pdfData = await pdfParse(buffer);
      normalized = cleanAndHashText(pdfData.text);
    } else {
      const html = await res.text();
      normalized = normalizeHtml(html);
    }

    return {
      sourceId,
      url,
      status: res.status,
      etag,
      normalized,
      isFixture: false,
      notModified: false,
    };
  }

  private async fetchFromFixture(
    sourceId: string,
    url: string,
    kind: 'html' | 'pdf' | 'rss'
  ): Promise<FetchResult> {
    const fixtureDir = path.resolve('./data/fixtures', sourceId);
    let filePath = path.join(fixtureDir, 'snapshot.html');

    if (!fs.existsSync(filePath)) {
      filePath = path.join(fixtureDir, 'snapshot.txt');
    }

    // Try finding any html or txt file in the fixture folder
    if (!fs.existsSync(filePath) && fs.existsSync(fixtureDir)) {
      const files = fs.readdirSync(fixtureDir).filter((f) => f.endsWith('.html') || f.endsWith('.txt'));
      if (files.length > 0) {
        filePath = path.join(fixtureDir, files[0]);
      }
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Fixture file not found for source "${sourceId}" at ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const normalized = filePath.endsWith('.html') ? normalizeHtml(content) : cleanAndHashText(content);

    return {
      sourceId,
      url,
      status: 200,
      etag: 'fixture-etag',
      normalized,
      isFixture: true,
      notModified: false,
    };
  }

  private async checkRobotsTxt(url: URL): Promise<void> {
    const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
    let parser = robotsCache.get(url.host);

    if (!parser) {
      try {
        const res = await fetch(robotsUrl, {
          headers: { 'User-Agent': this.userAgent },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const txt = await res.text();
          parser = (robotsParser as any)(robotsUrl, txt);
          robotsCache.set(url.host, parser);
        }
      } catch {
        // If robots.txt fails or 404s, allow crawling politely
        return;
      }
    }

    if (parser && !parser.isAllowed(url.toString(), this.userAgent)) {
      throw new RobotsDisallowedError(url.toString());
    }
  }

  private async applyRateLimit(host: string): Promise<void> {
    const now = Date.now();
    const last = lastHostFetchTimes.get(host) || 0;
    const elapsed = now - last;
    const minDelayMs = 1000;

    if (elapsed < minDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, minDelayMs - elapsed));
    }
    lastHostFetchTimes.set(host, Date.now());
  }
}
