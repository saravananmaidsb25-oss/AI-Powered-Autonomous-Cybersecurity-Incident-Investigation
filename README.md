# SENTINEL-X

SENTINEL-X is an **evidence-first security investigation and controlled-response platform**. It supports deterministic demos, authenticated real telemetry, a read-only Wazuh connector, bounded external investigations, and evaluated model deployment. All containment remains simulated. This single-process local build is not yet a verified production deployment.

## Run and verify

Requires Node.js 22 or newer. No npm packages or credentials are required.

```sh
npm start
npm test
npm run test:e2e    # Playwright browser inspection
npm run test:all    # unit + e2e
```

Open `http://127.0.0.1:4173`. Sign in with the demo credentials shown on the login page, or click **Enter demo workspace**. The server binds to loopback only.

**Demo login:** organization `default` · username `demo.analyst` · password `SentinelDemo1!`

Browser tests start an isolated server on port 4174 with a temporary SQLite database. Set `SENTINEL_X_E2E_PORT` to another free port if needed. Install Playwright Chromium with `npm run playwright:install`, or set `SENTINEL_X_E2E_CHANNEL=chrome` to use installed Chrome (`msedge` for Edge).

Operational endpoints are available at `/api/health`, `/api/ready`, and `/api/metrics`. Create a consistent SQLite backup with `npm run backup -- backups/sentinel-x.db`. Deployment hardening, container usage, environment controls, and remaining organization-specific work are documented in [PRODUCTION.md](PRODUCTION.md).

**Playwright MCP (Cursor):** config in `.cursor/mcp.json` — restart Cursor and enable the `playwright` MCP server, or run `npm run playwright:mcp`.

## Jury evaluation package

For **Human** and **AI** jury scoring, open the in-app **Jury evaluation** view or read `docs/JURY_EVALUATION.md`. Supporting materials:

| Document | Purpose |
| --- | --- |
| `docs/PITCH.md` | 3-minute pitch |
| `docs/DEMO_SCRIPT.md` | 10-minute live demo |
| `docs/BUSINESS_CASE.md` | ROI and feasibility |
| `docs/ARCHITECTURE.md` | System diagrams |
| `docs/SCHEMA.md` | Database ER overview |
| `docs/SECURITY.md` | Auth and safety controls |
| `docs/PERFORMANCE.md` | Benchmarks and metrics |
| `docs/openapi.yaml` | API contract |

Verify: `npm run test:all`, `npm run eval:model`, `npm run benchmark`.

## Jury demonstration

1. Open **Command center** and select **Account compromise**.
2. Click **Start simulation**. Six events appear in order: 27 failed logins, unknown-device login, privilege change, sensitive files, internal server, outbound transfer.
3. Watch the event stream, risk, and evidence update. The final outbound stage remains **SUSPECTED**.
4. Open **Investigation**. Review the attack story, graph, event links, evidence chain, uncertainty map, blast radius, turning point, and recomputed counterfactual.
5. Use **Replay attack** or the historical slider. The slider unlocks only processed events. Earlier steps exclude later evidence, affected assets, actions, feedback, and report content.
6. Ask the evidence-grounded assistant what happened, why it was detected, what actions were taken, or what to investigate next.
7. Open **Governance**. The policy requires analyst approval for endpoint isolation. Review expected simulated result and consequence, enter a reason, then approve or reject. The action records policy, risk, confidence, evidence IDs, target, actor, timestamp, and result.
8. Export JSON, CSV, or a real PDF report.
9. Open **Intelligence**. Record analyst feedback with a reason; the scenario detection threshold changes and feedback is persisted. Inspect event-derived patterns, trends, watchlist, and administrator briefing.
10. Replay **Lateral movement** and **Suspicious transfer**. The latter is detected and reaches High risk. All three scenarios remain clearly labelled as simulation.

## Architecture

| Layer | Implementation |
| --- | --- |
| Demo sources | `src/scenarios.js`, plus simulated event ingestion through `/api/ingest` |
| Normalization and detection | `src/engine.js`, robust median/MAD deviation, per-user demo history, seeded Isolation Forest |
| Correlation and attack graph | Time and entity links in `src/engine.js`, SVG view in `src/graph.js` |
| Investigation | Evidence-bound deterministic templates in `services/investigation.js` |
| Risk and policy | Explainable weighted risk plus contextual factors, deterministic allowlisted simulation policy |
| Simulated response | `server/api.js`, SQLite action/control state and audit trail |
| Persistence | SQLite events, entities, event-entity links, incidents, snapshots, actions, feedback, policy, weights, audit |
| Frontend | `src/main.js`, `src/app/`, `src/ui/` |
| Reporting | Structured JSON/CSV and `services/reportPdf.js` PDF export |
| Realtime | Server-Sent Events for ingested demo events, response actions, and feedback |

## Requirement coverage

- **Autonomous detection:** normalized authentication, network, endpoint, server, cloud, application, firewall, and identity events are evaluated with robust baseline deviation, a seeded Isolation Forest, temporal correlation, and entity context.
- **Threat versus legitimate activity:** every historical point now has an explicit disposition: `Likely threat`, `Needs investigation`, `Likely legitimate`, `Monitoring`, or `No finding`, with evidence and confidence reasons.
- **Nature-based response:** the policy chooses endpoint isolation, source blocking, account restriction, session revocation, or administrator notification from the observed event types, affected entities, risk, and confidence. High-impact controls require human approval; safe incident creation can run automatically.
- **Investigation:** attack sequence, event/entity graph, evidence chain, uncertainty, blast radius, turning point, counterfactual, comparison, gaps, and an evidence-bound assistant are available in the investigation workspace.
- **Incident management:** priority, lifecycle, notes, replay-run history, actions, controls, feedback, audit records, and JSON/CSV/PDF reports are persisted in SQLite.
- **Continuous intelligence:** recurring event patterns and entities, chronological trends, a risk watchlist, evidence-based suggestions, administrator briefings, and the applied analyst-feedback threshold are visible in the Intelligence workspace.

The simulation remains reproducible. Real telemetry, Wazuh collection, model training/deployment, Gemini, local sign-in and configured organization isolation are described in [INTEGRATIONS.md](INTEGRATIONS.md). Read [PROGRESS.md](PROGRESS.md) for verified changes and remaining production work.

Risk is calculated from configurable event weights and documented contextual factors (unusual time/device/location, abnormal transfer, critical asset, progression, entity spread, source severity, model deviation, confidence, and analyst history). Positive raw factors are transformed to a 0–100 score with `100 × (1 − e^(−raw/75))`; displayed contributions are allocated to sum to the reported score. The policy uses the current detection, risk, and confidence. Mandatory approval for high-impact simulated actions cannot be removed by an older saved policy.

The Isolation Forest is seeded and trained on deterministic synthetic normal baseline features. It demonstrates novelty scoring; it is not presented as a model trained on a real organization's history. Feedback adjusts a per-scenario threshold on later replay runs. Model operations now train reproducible forest artifacts from reviewed normal events, compute held-out metrics, gate promotion, and load the promoted artifact into inference. Rollback restores the prior forest. `npm run eval:model` evaluates the included offline dataset. The dataset is deliberately small and does not substitute for organization telemetry.

The investigation assistant always has an evidence-only deterministic path. When `SENTINEL_X_LLM_ENDPOINT` and `SENTINEL_X_LLM_MODEL` are configured, it retrieves incident evidence, redacts secret-like values, rejects common prompt-injection patterns, requests strict structured output, validates every citation against available event IDs, and falls back deterministically on timeout, provider error, invalid shape, or unsupported citations.

Persistent topology stores entities, asset criticality, ownership fields, relationship history, timestamps, and supporting event IDs independently from incident replay state. The investigation graph overlays current incident relationships on this environment context with search, zoom, keyboard focus, and evidence metadata.

The dashboard and analysis API derive current posture from ingested events. Replay runs have separate current actions, audit entries, and snapshots; prior run records remain queryable with `?all=1` on the actions, audit, and snapshots endpoints.

## Simulation ingestion API

`GET /api/session` provides a per-process local demo token. Mutating requests require the token in `X-Sentinel-Demo-Token`. This is a local CSRF boundary, not production identity authentication. The server also rejects cross-origin mutations, non-simulated ingestion, production mode, and static access to database/server files.

Example event for `POST /api/ingest`:

```json
{
  "event": {
    "id": "DEMO-001",
    "timestamp": "2026-09-19T10:00:00Z",
    "type": "auth_failure",
    "action": "Failed login",
    "sourceType": "authentication",
    "source": "Demo identity source",
    "account": "example",
    "normalized": {"failures": 8},
    "metadata": {"simulation": true, "scenario": "live"}
  }
}
```

The API normalizes and redacts secret-like raw fields, stores the event and entity links, analyzes the ingested demo sequence, saves a snapshot, audits the decision, and broadcasts it. The **Ingested demo events** scenario appears in the UI after an event arrives.

Every ingestion request also creates a durable job record with attempt count, error state, retry support, and dead-letter transition after three failed attempts. `/api/connectors` reports queue health and the configuration contract for the eight supported telemetry families. The Wazuh adapter can read alerts once its endpoint and read-only credentials are configured. It supports background polling with retry/backoff and persisted checkpoints; other vendor-specific adapters remain unimplemented.

## Deployment boundary

Response policy remains simulation-only. Local sessions or a trusted SSO proxy can authenticate users; explicitly configured organizations have separate data and models. Production still needs managed storage/queue scalability, real credential validation, organizational acceptance data, HTTPS/SSO operations, restore/load/security reviews and authorized response adapters. Keep demo authentication on loopback.

The repository now supplies the locally implementable foundation: security headers, request tracing, rate limiting, timeouts, readiness, Prometheus metrics, retention cleanup, graceful shutdown, consistent backups, and a non-root container. Identity-provider configuration, vendor credentials, real response adapters, and organization approvals remain external deployment dependencies; see [PRODUCTION.md](PRODUCTION.md).

## Mandatory project description

AI Powered Autonomous Cybersecurity & Incident Investigation

Details and requirements for AI Powered Autonomous Cybersecurity & Incident Investigation

AI X CYBERSECURITY

Description

### AI-Powered Autonomous Cybersecurity

- Detect previously unseen anomalous network behavior and potential cyber threats in real time.
- Distinguish genuine security threats from legitimate network activity and reduce false positives.
- Automatically trigger appropriate defensive actions based on the severity and nature of detected threats.
- Monitor network events, system activities, authentication logs, and security alerts continuously.

### AI Investigation & Threat Analysis

- Correlate multiple security events to identify relationships between suspicious activities.
- Reconstruct probable attack sequences, identify affected systems, and analyze potential impact.
- Explain detected threats using understandable AI-generated reasoning and evidence.
- Provide an AI investigation assistant to support security administrators during incident analysis.

### Autonomous Response & Incident Management

- Automatically respond to detected threats through actions such as blocking, isolating, or restricting suspicious activity.
- Prioritize incidents based on threat severity, affected assets, and potential impact.
- Maintain incident history and track investigation, response, and resolution activities.
- Generate structured incident reports containing threat details, attack sequence, impact, evidence, and response actions.

### Continuous Learning & Security Intelligence

- Learn from confirmed security incidents, investigation results, and security-team feedback.
- Improve future anomaly detection and threat classification using historical incident data.
- Identify recurring attack patterns and emerging behavioral trends.
- Provide security administrators with continuous AI-driven insights for proactive threat prevention.

## Bounded investigation and evidence verification

The Investigation workspace runs a deterministic, read-only workflow over the selected historical snapshot. It shows up to five steps, tool results, competing explanations, affected systems, evidence gaps, and the stopping condition. It makes no external queries or provider calls. `GET /api/investigation-agent/:scenarioId?step=2&maxSteps=3` exposes the same workflow over ingested evidence only.

Factual claims pass only when every cited event has the exact stated observation. Unknown citations, unrelated citations, and unsupported conclusions fail verification. The optional LLM must return extractive claims; unsupported responses fall back to the deterministic assistant. This conservative check verifies correspondence to supplied telemetry, not telemetry truth, malicious intent, or semantic entailment. Model promotion now requires a trained artifact that passes held-out evaluation, and changes actual inference. Wazuh is an executable read-only connector; configuration labels for other vendors are not integrations.
