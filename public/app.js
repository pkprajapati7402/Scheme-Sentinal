// Scheme Sentinel Frontend Controller

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  loadOverview();
});

function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = `tab-${tab.dataset.tab}`;
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }

      // Lazy load tab data
      if (tab.dataset.tab === 'overview') loadOverview();
      if (tab.dataset.tab === 'changes') loadChanges();
      if (tab.dataset.tab === 'docs') loadDocs();
      if (tab.dataset.tab === 'alerts') loadAlerts();
      if (tab.dataset.tab === 'metrics') loadMetrics();
    });
  });
}

async function loadOverview() {
  const container = document.getElementById('schemes-list');
  try {
    const res = await fetch('/api/overview');
    const data = await res.json();

    if (!data.success || data.schemes.length === 0) {
      container.innerHTML = '<p class="hint-text">No schemes tracked yet. Please seed the registry.</p>';
      return;
    }

    // Update Summary Cards
    const schemes = data.schemes;
    document.getElementById('metric-watched-count').textContent = schemes.length;
    const eligibleCount = schemes.filter((s) => s.eligibility === 'ELIGIBLE').length;
    const unknownCount = schemes.filter((s) => s.eligibility === 'UNKNOWN').length;
    document.getElementById('metric-eligible-count').textContent = eligibleCount;
    document.getElementById('metric-unknown-count').textContent = unknownCount;

    // Find closest deadline
    const sortedByDate = schemes
      .filter((s) => s.daysLeft !== null && s.daysLeft >= 0)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    if (sortedByDate.length > 0) {
      document.getElementById('metric-closest-deadline').textContent = sortedByDate[0].freshDeadline;
      document.getElementById('metric-days-left').textContent = `${sortedByDate[0].daysLeft} days remaining`;
    }

    // Render Cards
    container.innerHTML = schemes
      .map((s) => {
        const badgeClass =
          s.eligibility === 'ELIGIBLE'
            ? 'badge-eligible'
            : s.eligibility === 'UNKNOWN'
            ? 'badge-unknown'
            : 'badge-not-eligible';

        const daysText =
          s.daysLeft !== null
            ? s.daysLeft === 0
              ? 'Today!'
              : s.daysLeft > 0
              ? `${s.daysLeft} days left`
              : 'Closed'
            : 'Pending verification';

        return `
          <div class="scheme-card" onclick="openSchemeDetail('${s.schemeId}')">
            <div class="scheme-top">
              <span class="scheme-title">${escapeHtml(s.schemeId)}</span>
              <span class="badge ${badgeClass}">${s.eligibility}</span>
            </div>
            <div class="scheme-info">
              <span>Stage: <strong>${s.stage}</strong></span>
              ${s.hasConflicts ? '<span style="color:#f87171; display:block; margin-top:4px;">⚠️ Conflicting source reported</span>' : ''}
            </div>
            <div class="deadline-row">
              <span>Deadline: ${s.freshDeadline || 'TBD'}</span>
              <span class="days-tag">${daysText}</span>
            </div>
            <div class="scheme-actions">
              ${s.stage !== 'applied' ? `<button class="btn-action" onclick="event.stopPropagation(); markApplied('${s.schemeId}')">✅ I applied</button>` : '<span style="color:#34d399; font-size:12px;">✓ Applied</span>'}
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    container.innerHTML = `<p class="hint-text text-red">Failed to load overview: ${escapeHtml(err.message)}</p>`;
  }
}

async function openSchemeDetail(schemeId) {
  // Switch to schemes tab
  const schemeTabBtn = document.querySelector('[data-tab="schemes"]');
  if (schemeTabBtn) schemeTabBtn.click();

  const container = document.getElementById('scheme-detail-container');
  container.innerHTML = '<div class="loader">Loading scheme evidence...</div>';

  try {
    const res = await fetch(`/api/schemes/${encodeURIComponent(schemeId)}`);
    const data = await res.json();
    if (!data.success) {
      container.innerHTML = `<p class="hint-text text-red">${escapeHtml(data.error)}</p>`;
      return;
    }

    const { scheme, alerts } = data;
    const deadlines = scheme.deadlines || {};
    const conflicts = scheme.conflicts || [];

    let conflictsHtml = '';
    if (conflicts.length > 0) {
      conflictsHtml = `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 12px; border-radius: 6px; margin: 16px 0;">
          <h4 style="color:#f87171; margin-bottom:6px;">⚠️ Source Conflict Detected</h4>
          ${conflicts.map((c) => `<p style="font-size:13px; margin-bottom:4px;">${escapeHtml(c.message)}</p>`).join('')}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="metric-card" style="margin-bottom: 20px;">
        <div class="scheme-top">
          <h2>${escapeHtml(scheme.schemeId)}</h2>
          <span class="badge ${scheme.eligibility === 'ELIGIBLE' ? 'badge-eligible' : 'badge-unknown'}">${scheme.eligibility}</span>
        </div>
        <p style="color:var(--text-muted); font-size:14px; margin-bottom:12px;">Stage: <strong>${scheme.stage}</strong> • Last Updated: ${new Date(scheme.updatedAt).toLocaleString()}</p>
        ${conflictsHtml}
      </div>

      <div class="metric-card" style="margin-bottom: 20px;">
        <h3>Verified Deadlines with Verbatim Evidence</h3>
        <p style="font-size:13px; color:var(--text-muted); margin-bottom:10px;">Hard Rule 4: Every alert and deadline is backed by verbatim quotes from official pages.</p>
        <ul style="list-style:none; padding:0;">
          <li style="margin-bottom:12px;">
            <strong>Fresh Application Last Date:</strong> ${deadlines.freshApplication || 'Not specified'}
          </li>
          <li style="margin-bottom:12px;">
            <strong>Institute Verification Last Date:</strong> ${deadlines.instituteVerification || 'Not specified'}
          </li>
        </ul>
      </div>

      <div class="metric-card">
        <h3>Eligibility Assessment Breakdown</h3>
        <ul style="padding-left: 20px; font-size:14px; margin-top:8px;">
          ${(scheme.reasons || []).map((r) => `<li style="margin-bottom:6px;">${escapeHtml(r)}</li>`).join('') || '<li>No specific criteria evaluated yet.</li>'}
        </ul>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="hint-text text-red">Failed to load details: ${escapeHtml(err.message)}</p>`;
  }
}

async function markApplied(schemeId) {
  try {
    const res = await fetch(`/api/signal/${encodeURIComponent(schemeId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'applied' }),
    });
    const data = await res.json();
    if (data.success) {
      alert(`Success: ${data.message}`);
      loadOverview();
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function loadChanges() {
  const container = document.getElementById('changes-container');
  try {
    const res = await fetch('/api/changes');
    const data = await res.json();

    if (!data.success || data.changes.length === 0) {
      container.innerHTML = '<p class="hint-text">No snapshot changes recorded yet.</p>';
      return;
    }

    container.innerHTML = data.changes
      .map(
        (ch) => `
        <div class="metric-card" style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <strong>Source: ${escapeHtml(ch.sourceId)}</strong>
            <span class="badge ${ch.material ? 'badge-eligible' : 'badge-unknown'}">${ch.material ? 'MATERIAL UPDATE' : 'COSMETIC / SKIPPED'}</span>
          </div>
          <p style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">Recorded: ${new Date(ch.createdAt).toLocaleString()}</p>
          <ul style="font-size:13px; padding-left:20px;">
            ${(ch.reasons || []).map((r) => `<li>${escapeHtml(r)}</li>`).join('') || '<li>Cosmetic timestamp/counter change only (LLM skipped).</li>'}
          </ul>
        </div>
      `
      )
      .join('');
  } catch (err) {
    container.innerHTML = `<p class="hint-text text-red">${escapeHtml(err.message)}</p>`;
  }
}

async function loadDocs() {
  const container = document.getElementById('docs-container');
  try {
    const res = await fetch('/api/docs');
    const data = await res.json();

    if (!data.success || data.documents.length === 0) {
      container.innerHTML = '<p class="hint-text">No document records found.</p>';
      return;
    }

    container.innerHTML = `
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <thead>
          <tr style="text-align:left; border-bottom:1px solid var(--card-border); color:var(--text-muted);">
            <th style="padding:10px;">Document Type</th>
            <th style="padding:10px;">Status</th>
            <th style="padding:10px;">Issued On</th>
            <th style="padding:10px;">Valid Until</th>
          </tr>
        </thead>
        <tbody>
          ${data.documents
            .map(
              (d) => `
            <tr style="border-bottom:1px solid var(--card-border);">
              <td style="padding:10px; font-weight:500;">${escapeHtml(d.doc_type)}</td>
              <td style="padding:10px;"><span class="badge ${d.status === 'have' ? 'badge-eligible' : d.status === 'expiring' ? 'badge-unknown' : 'badge-not-eligible'}">${d.status}</span></td>
              <td style="padding:10px; color:var(--text-muted);">${d.issued_on || 'N/A'}</td>
              <td style="padding:10px; color:var(--text-muted);">${d.valid_until || 'N/A'}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<p class="hint-text text-red">${escapeHtml(err.message)}</p>`;
  }
}

async function loadAlerts() {
  const container = document.getElementById('alerts-container');
  try {
    const res = await fetch('/api/alerts');
    const data = await res.json();

    if (!data.success || data.alerts.length === 0) {
      container.innerHTML = '<p class="hint-text">No alerts sent yet.</p>';
      return;
    }

    container.innerHTML = data.alerts
      .map(
        (a) => `
        <div class="metric-card" style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <strong>${escapeHtml(a.type.toUpperCase())}: ${escapeHtml(a.schemeId || 'General')}</strong>
            <span class="badge ${a.trustTier === 1 ? 'badge-eligible' : 'badge-unknown'}">Tier ${a.trustTier} (${a.trustTier === 1 ? 'Official' : 'Aggregator'})</span>
          </div>
          <p style="font-size:14px; margin-bottom:8px;">${escapeHtml(a.textEn)}</p>
          <div class="evidence-quote">"${escapeHtml(a.quote)}"</div>
          <p style="font-size:12px; color:var(--text-muted);">Source: <a href="${escapeHtml(a.sourceUrl)}" target="_blank" style="color:var(--accent-blue);">${escapeHtml(a.sourceUrl)}</a> • Sent: ${a.sentAt ? new Date(a.sentAt).toLocaleString() : 'Pending'}</p>
        </div>
      `
      )
      .join('');
  } catch (err) {
    container.innerHTML = `<p class="hint-text text-red">${escapeHtml(err.message)}</p>`;
  }
}

async function loadMetrics() {
  const container = document.getElementById('metrics-container');
  try {
    const res = await fetch('/api/metrics');
    const data = await res.json();

    if (!data.success) return;
    const m = data.metrics;

    container.innerHTML = `
      <div class="summary-cards">
        <div class="metric-card">
          <span class="metric-label">Source Polling Checks</span>
          <span class="metric-val">${m.totalChecks}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Skipped by Diff Heuristic</span>
          <span class="metric-val text-green">${m.skippedPercent.toFixed(1)}%</span>
          <span class="metric-sub">${m.skippedByDiff} saved LLM invocations</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">LLM Extraction Calls</span>
          <span class="metric-val text-blue">${m.totalLlmCalls}</span>
          <span class="metric-sub">${m.inputTokens} in / ${m.outputTokens} out</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Compute Cost</span>
          <span class="metric-val text-green">₹0</span>
          <span class="metric-sub">100% Local-First Open Model</span>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="hint-text text-red">${escapeHtml(err.message)}</p>`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

