# SENTINEL-X implementation progress

## Phase 1 — repository audit (2026-09-19)

Baseline: 20 unit/API/security tests pass. The preceding delivery also passed 10 browser tests. No Git repository is present in this workspace.

Architecture: Node.js modular monolith (`server.js`, `server/api.js`), SQLite WAL persistence (`server/db.js`), browser ES modules (`src/app`, `src/ui`), seeded JavaScript Isolation Forest, deterministic correlation/risk/policy, optional evidence-grounded HTTP LLM, and SSE. No runtime package dependency is needed. Playwright is a development dependency.

Working features: three deterministic simulations, normalization/redaction, MAD and Isolation Forest scoring, evidence-linked correlation, graph, attack sequence, weighted risk, blast radius, counterfactual recomputation, historical replay, evidence assistant, five-step local investigation, claim verification, policy approvals, simulated controls, lifecycle/notes, JSON/CSV/PDF, analyst feedback, intelligence, topology, health/metrics, backups, containers, and trusted-proxy RBAC.

Initial audit findings (resolved items are recorded below):

- Vendor connector entries are configuration labels; none fetch external telemetry.
- `/api/ingest` accepts simulated events only. Job retries are manual; there is no background worker.
- The investigation workflow never queries an external source.
- Model promotion updates metadata while inference uses a module-level demo forest. Model metrics can currently be supplied by clients.
- The optional LLM speaks an OpenAI-compatible protocol; there is no native Gemini adapter.
- Auth defaults to a local demo principal. Proxy auth rejects all tenants except default. There is no application password/session identity provider.
- SQLite, SSE, and plain browser modules are working equivalents for this single-process build, but do not constitute the requested PostgreSQL/Redis/React/FastAPI deployment.
- Global simulated-source labels would misrepresent genuine telemetry if live ingestion were simply enabled.
- Normalization needs stricter validation before accepting externally sourced records; source severity must not become a trusted risk score.
- Persistent topology can show information newer than a historical incident snapshot.
- Production credentials, representative training data, managed infrastructure, TLS/SSO configuration, penetration testing, and deployment verification are unavailable.

Architecture decision: preserve the tested modular monolith and existing UI while adding independently testable services and versioned ingestion. A wholesale framework/database rewrite would discard working behavior without demonstrating parity. SQLite is retained for the local single-process implementation; it is not described as equivalent to managed PostgreSQL for multi-instance production. Redis, PostgreSQL migration, identity-provider setup, and hosting stay explicit production work until implemented and verified.

## Phase plan and acceptance gates

1. Audit + architecture — complete; baseline tests pass.
2. Telemetry + database — implemented locally: authenticated real ingestion, Wazuh read-only queries, deduplication, persisted checkpoints/jobs, atomic processing, background retry/backoff, source provenance, migration tracking and indexes. Gate: 23 tests passed.
3. Detection — implemented: bounded training worker, reproducible artifacts/digests, learned normal baselines, held-out evaluation gate, actual inference deployment/rollback, persisted model versions. Gate: 25 tests passed.
4–6. Correlation/graph/story/evidence/risk — existing pipeline preserved; added evidence-linked graph traversal, stage entities/risk contributions/interpretation labels, and historical topology filtering. Unit/API regression gates pass.
7. Investigation — implemented: entity-driven external read-only query planning, new-entity exploration, query/time/evidence budgets, persisted traces and optional detection-triggered execution. Native Gemini structured output is verified against evidence with deterministic fallback. Gate: 27 tests passed with fixture HTTP servers.
8–10. Response/incidents/reports/learning — regression-tested existing controls, corrected real-telemetry versus simulated-response labels and reports, added deployment audit records. Training is explicit, distinct from feedback threshold changes. Real containment remains simulated.
11. Authentication/RBAC/multi-tenancy — added local scrypt passwords, hashed expiring sessions, refresh rotation/reuse revocation, login/logout UI, manager role, configured organization isolation and tenant-aware SSE. Tests exercise cross-organization event/report/policy/model isolation and role enforcement. Gate: 29 tests passed.
12. Testing/security — 32 unit/API/security tests pass. Dependency audit completed outside network sandbox: npm reports 0 vulnerabilities. Added stricter normalization, secret-file ignores, protected metrics, authenticated stream checks and injection escaping. Regression tests cover model-cache isolation when organizations use the same version name and historical comparisons excluding future evidence.
13. Deployment/observability — added ingestion/detection/AI/external-query counters plus CPU and memory metrics. Existing Docker, readiness, retention and backup controls retained. Managed production deployment is not verified.
14. UX/jury demonstration — Integrations & models UI now collects Wazuh alerts, uploads reviewed training data, shows held-out metrics, deploys and rolls back models; investigation exposes external queries. Thirteen browser tests pass, including the full model lifecycle, real telemetry labeling, and local login/logout.

## Changes and test results

- Audit completed before implementation changes in this phase. `npm test`: 20/20 passing.
- Mandatory product description remains in README and Project requirements view.
- Final unit/API/security suite: 32/32 passing. Browser suite: 13/13 passing; the Windows test server required explicit cleanup after assertions completed. Dependency audit: zero reported vulnerabilities.
- External investigation results are included in reports. Recurring-pattern intelligence includes first/last observation, assets and incident references. Historical evidence boundaries and tenant model-cache separation have dedicated regression coverage.
- Optional direct TLS support requires certificate/key configuration. Certificate handshake and container deployment have not been validated; Docker, PostgreSQL and Redis command-line tools were unavailable in this environment.

## Completion rule

This document distinguishes implemented code, locally verified behavior, configuration-dependent features, and remaining work. Do not claim production readiness or live vendor validation based only on mock integration tests.

## Remaining production work

- PostgreSQL/Redis migration, independent background workers and horizontal concurrency testing. Runtime remains Node/SQLite/browser ES modules/SSE; React/TypeScript/FastAPI and WebSocket migration were not performed.
- Unlimited, lossless telemetry ingestion and incident partitioning. Real-source workspaces are deliberately capped at 300 events; Wazuh uses bounded windows with five-minute overlap. The current source workspace is not a replacement for a full SIEM's incident grouping and retention model.
- Live Wazuh/Gemini credentials and validation, independent organizational training/evaluation data, and credentials per tenant for additional source adapters.
- Organizational HTTPS/SSO/MFA configuration, local account recovery/admin lifecycle, secrets rotation, encryption-at-rest infrastructure, off-host restore drills, load/chaos testing, and independent penetration/security review.
- Reviewed real containment adapters, execution verification and recovery playbooks. All current response execution is simulated.
- Complete versioned pagination/filter coverage for every resource. Versioned aliases, paginated events, graph/risk, telemetry and auth exist; some legacy resource APIs remain unpaginated.
- Direct VirusTotal/AbuseIPDB/GeoIP enrichment is not implemented. External investigation currently queries the configured Wazuh indexer only.

## Verification detail

Tests verify actual HTTP request/response handling using local vendor fixtures, deterministic model artifact reproducibility, inference changes after promotion and restoration after rollback, tenant/RBAC controls, session refresh reuse protection, and the original detection/response/report/learning flows. Synthetic data and fixture services are explicitly identified. No test result establishes production detection accuracy or live provider connectivity.
