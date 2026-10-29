export interface ReminderTemplateParams {
  schemeName: string;
  deadline: string;
  daysLeft: number;
  eligibilityLabel: string;
  eligibilityLabelHi?: string;
  docsReady: number;
  docsTotal: number;
  sourceUrl: string;
  quote: string;
  trustLabel: string;
  trustLabelHi?: string;
  conflictNote?: string;
}

export interface DeadlineChangeTemplateParams {
  schemeName: string;
  oldDate: string;
  newDate: string;
  sourceUrl: string;
  quote: string;
  trustLabel: string;
  conflictNote?: string;
}

export function formatReminderAlertEn(params: ReminderTemplateParams): string {
  validateAlertEvidence(params.sourceUrl, params.quote, params.trustLabel);

  let msg = `⏰ ${params.schemeName}: last date ${params.deadline} (${params.daysLeft} days left)
Status: ${params.eligibilityLabel} · Docs: ${params.docsReady}/${params.docsTotal} ready
Source (${params.trustLabel}): ${params.sourceUrl}
"${params.quote}"
Dates change. Please verify on the official portal before acting.`;

  if (params.conflictNote) {
    msg += `\n⚠️ Note: ${params.conflictNote}`;
  }

  return msg;
}

export function formatReminderAlertHi(params: ReminderTemplateParams): string {
  validateAlertEvidence(params.sourceUrl, params.quote, params.trustLabel);

  const trustHi = params.trustLabelHi || 'आधिकारिक';
  const eligHi = params.eligibilityLabelHi || 'पात्रता जाँची जा रही है';

  let msg = `⏰ ${params.schemeName}: अंतिम तिथि ${params.deadline} (अब ${params.daysLeft} दिन बचे)
स्थिति: ${eligHi} · दस्तावेज़: ${params.docsTotal} में से ${params.docsReady} तैयार
स्रोत (${trustHi}): ${params.sourceUrl}
"${params.quote}"
कृपया कार्रवाई से पहले आधिकारिक पोर्टल पर तारीख़ ज़रूर जाँच लें।`;

  if (params.conflictNote) {
    msg += `\n⚠️ ध्यान दें: ${params.conflictNote}`;
  }

  return msg;
}

export function formatDeadlineChangedAlertEn(params: DeadlineChangeTemplateParams): string {
  validateAlertEvidence(params.sourceUrl, params.quote, params.trustLabel);

  let msg = `🔔 Update for ${params.schemeName}: last date changed ${params.oldDate} → ${params.newDate}
Source (${params.trustLabel}): ${params.sourceUrl}
"${params.quote}"
Dates change. Please verify on the official portal before acting.`;

  if (params.conflictNote) {
    msg += `\n⚠️ Note: ${params.conflictNote}`;
  }

  return msg;
}

export function validateAlertEvidence(sourceUrl: string, quote: string, trustLabel: string): void {
  if (!sourceUrl || typeof sourceUrl !== 'string' || !sourceUrl.startsWith('http')) {
    throw new Error('Hard Rule 4 Violation: Alert must contain a valid sourceUrl.');
  }
  if (!quote || typeof quote !== 'string' || quote.trim().length < 8) {
    throw new Error('Hard Rule 4 Violation: Alert must carry an exact quote (min 8 chars).');
  }
  if (!trustLabel || typeof trustLabel !== 'string') {
    throw new Error('Hard Rule 4 Violation: Alert must include a verified trustLabel.');
  }
}

