import * as cheerio from 'cheerio';
import * as crypto from 'node:crypto';

export interface NormalizedResult {
  text: string;
  sentences: string[];
  contentHash: string;
}

const STRIP_SELECTORS = [
  'script',
  'style',
  'noscript',
  'nav',
  'header',
  'footer',
  'aside',
  'form',
  'iframe',
  '.cookie-banner',
  '#cookie-consent',
  '.visitor-counter',
  '#visitorCounter',
  '.clock',
  '.last-updated-clock',
  '.advertisement',
  '.sidebar',
];

/**
 * Normalizes HTML or plain text into stable, reproducible text for hashing and diffing.
 */
export function normalizeHtml(rawHtml: string): NormalizedResult {
  const $ = cheerio.load(rawHtml);

  // Strip transient and navigation elements
  for (const selector of STRIP_SELECTORS) {
    $(selector).remove();
  }

  // Format table rows nicely: "col1 | col2 | col3"
  $('tr').each((_, el) => {
    const cells = $(el)
      .find('th, td')
      .map((_, cell) => $(cell).text().trim())
      .get()
      .filter((txt) => txt.length > 0);
    if (cells.length > 0) {
      $(el).text(`\n${cells.join(' | ')}\n`);
    }
  });

  // Convert headings and list items to lines
  $('h1, h2, h3, h4, h5, h6, li, p').each((_, el) => {
    $(el).append('\n');
  });

  const rawText = $('body').length ? $('body').text() : $.text();

  return cleanAndHashText(rawText);
}

/**
 * Normalizes unicode, collapses whitespace, splits into stable sentences, and hashes with SHA-256.
 */
export function cleanAndHashText(raw: string): NormalizedResult {
  // 1. Unicode normalization (NFKC) & remove zero-width characters
  let clean = raw
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 2. Normalize whitespace line by line
  const lines = clean
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);

  // 3. Sentence segmentation
  const sentences: string[] = [];
  for (const line of lines) {
    // If it's a table row or list, keep as a single sentence/entry
    if (line.includes(' | ')) {
      sentences.push(line);
      continue;
    }
    // Otherwise break on period/exclamation/question mark followed by space or end
    const parts = line
      .split(/(?<=[.?!।])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    sentences.push(...parts);
  }

  const normalizedText = sentences.join('\n');
  const contentHash = crypto.createHash('sha256').update(normalizedText, 'utf8').digest('hex');

  return {
    text: normalizedText,
    sentences,
    contentHash,
  };
}

