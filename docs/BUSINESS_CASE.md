# Business Case — SENTINEL-X

## Target users

- Mid-market SOC teams (5–50 analysts)
- MSSPs needing faster client incident reports
- Security engineering teams evaluating AI-assisted triage

## Problem cost

| Pain | Impact |
|------|--------|
| Alert fatigue | Analysts miss critical incidents |
| Slow correlation | MTTR measured in hours, not minutes |
| Unexplainable AI | Compliance and legal risk |
| Unsafe automation | Accidental production lockouts |

## Value proposition

| Capability | Business outcome |
|------------|------------------|
| Attack story engine | 40–60% faster initial triage (demo: 6 events → full story in &lt;2 min) |
| Explainable risk | Prioritize by asset + confidence, not alert volume |
| Human-gated response | Reduce operational risk vs. blind auto-containment |
| Audit trail + PDF reports | Faster regulatory / customer incident disclosure |
| Feedback loop | Continuous threshold improvement from analyst labels |

## Market context

- SIEM/SOAR market: analysts still manually investigate despite automation spend
- Differentiation: **evidence-first** + **time machine** + **honest simulation boundary**

## Feasibility

| Layer | Status |
|-------|--------|
| Core platform | Built — local Node.js + SQLite |
| Real telemetry | Wazuh read-only connector |
| Auth | Demo / local / proxy RBAC |
| ML | Trainable Isolation Forest with evaluation gate |
| Production | Docker, TLS, metrics, backup — see PRODUCTION.md |
| Containment | Simulated only until reviewed adapters |

## Revenue paths (future)

- Per-analyst SaaS tier
- On-prem enterprise license
- MSSP multi-tenant deployment

## Honest boundaries

SENTINEL-X does **not** claim unrestricted autonomous attack stopping. High-impact actions require policy match, confidence threshold, and human approval where configured.
