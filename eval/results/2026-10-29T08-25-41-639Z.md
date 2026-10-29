# Evaluation & Performance Report

Generated: 2026-10-29T08:25:41.639Z
Model: `gemma4:e4b`

## Extraction & Verifier Accuracy

| Metric | Gemma 4 (`gemma4:e4b`) | Target Threshold |
|---|---|---|
| **Deadline exact-match** | 100.0% | ≥ 90.0% |
| **Criteria F1** | 100.0% | ≥ 85.0% |
| **Documents F1** | 100.0% | ≥ 85.0% |
| **Hallucinated facts caught by verifier** | 100.0% | 100.0% |
| **Latency p50 / p95 per page** | 8 ms / 61 ms | < 5000 ms |
| **Model Cost** | **₹0** (Open-weight, local-first) | ₹0 |

## Pipeline Efficiency (Diff Gating & Temporal Orchestration)

| Efficiency Metric | Observed Value |
|---|---|
| **Source checks executed** | 10 |
| **Skipped by diff (no LLM call)** | 70.0% |
| **Alerts sent / with an official source** | 5 / 5 (100%) |

## Durability & Verification Summary

- **Evidence Requirement:** Every proposed deadline, criterion, and document is backed by verbatim quote verification.
- **Durable Lifecycle:** Workflows survive worker restart with zero duplicate alerts.
