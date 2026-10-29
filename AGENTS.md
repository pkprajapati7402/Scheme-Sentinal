# AGENTS.md — Hard Rules for Scheme Sentinel

These rules are non-negotiable and strictly enforced across the codebase:

1. **Do not invent API signatures.** For Mastra, Temporal, Sentry, Ollama, and SerpApi, read the installed package types or current docs. If unsure, write a minimal spike and run it.
2. **Temporal workflow code must be deterministic.** No network, no filesystem, no LLM calls, no randomness, no direct clock reads. Use Temporal's `sleep`, `condition`, and `workflowInfo()`. Workflows import activities through `proxyActivities` with `import type` only.
3. **The LLM never decides eligibility or deadlines on its own.** It extracts facts with evidence. Deterministic code verifies the evidence, parses dates, and applies rules.
4. **No source, no alert.** Every alert must carry `sourceUrl`, an exact `quote`, and a `trustTier`. Otherwise it is not sent.
5. **Never automate login, OTP, face-authentication, or form submission** on any government portal. The agent observes public pages and reminds. A human applies.
6. **No secrets or personal data in git.** `.env` and `data/profile.yaml` are gitignored. Tests, fixtures, screenshots, and traces for publication use a **synthetic** profile.
7. **Tests before wiring** for pure modules (eligibility, deadline parsing, reminder planning, diffing, evidence verification).
8. **Stay in scope.** Finish P0 (section 5) before touching P1 or P2.
9. **Time and dates:** timezone `Asia/Kolkata`; store dates as ISO `YYYY-MM-DD`; parse Indian `DD-MM-YYYY` and `DD/MM/YYYY` as day-first, never month-first.
10. **Small commits with meaningful messages.** Never rewrite history after sessions are recorded.

