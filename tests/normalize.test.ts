import { describe, it, expect } from 'vitest';
import { normalizeHtml } from '../src/sources/normalize.js';

describe('HTML Normalization & Hash Stability', () => {
  it('strips volatile clocks, visitor counters, and nav elements to produce identical hash', () => {
    const html1 = `
      <html>
        <header>
          <div class="last-updated-clock">Clock: 29-10-2026 10:00:00</div>
          <div class="visitor-counter">Hits: 1000</div>
          <nav><a href="/a">A</a></nav>
        </header>
        <main>
          <h1>Post Matric SC Scholarship</h1>
          <p>Deadline is 31-10-2026.</p>
        </main>
        <footer><p>NIC</p></footer>
      </html>
    `;

    const html2 = `
      <html>
        <header>
          <div class="last-updated-clock">Clock: 29-10-2026 22:45:12</div>
          <div class="visitor-counter">Hits: 9999</div>
          <nav><a href="/b">B</a></nav>
        </header>
        <main>
          <h1>Post Matric SC Scholarship</h1>
          <p>Deadline is 31-10-2026.</p>
        </main>
        <footer><p>NIC updated</p></footer>
      </html>
    `;

    const norm1 = normalizeHtml(html1);
    const norm2 = normalizeHtml(html2);

    expect(norm1.contentHash).toBe(norm2.contentHash);
    expect(norm1.text).toBe(norm2.text);
  });

  it('detects changes when main content changes', () => {
    const html1 = `<div><p>Deadline is 31-10-2026.</p></div>`;
    const html2 = `<div><p>Deadline is 30-11-2026.</p></div>`;

    const norm1 = normalizeHtml(html1);
    const norm2 = normalizeHtml(html2);

    expect(norm1.contentHash).not.toBe(norm2.contentHash);
  });
});

