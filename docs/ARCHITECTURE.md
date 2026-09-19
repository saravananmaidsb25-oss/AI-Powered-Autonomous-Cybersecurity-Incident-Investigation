# SENTINEL-X Architecture

## System context

```mermaid
flowchart LR
  subgraph Sources
    DEMO[Demo scenarios]
    WAZUH[Wazuh API]
    PUSH[Push ingest API]
  end
  subgraph Platform
    API[HTTP API + SSE]
    ENG[Detection engine]
    INV[Investigation services]
    POL[Policy engine]
    DB[(SQLite WAL)]
  end
  subgraph UI
    SPA[Vanilla ES modules SPA]
  end
  DEMO --> API
  WAZUH --> API
  PUSH --> API
  API --> ENG --> DB
  ENG --> INV
  ENG --> POL
  API --> SPA
```

## Request flow

```mermaid
sequenceDiagram
  participant Analyst
  participant UI
  participant API
  participant Engine
  participant DB
  Analyst->>UI: Start simulation
  UI->>API: POST /api/ingest (events)
  API->>DB: Persist event + entities
  API->>Engine: analyze(step)
  Engine-->>UI: risk, story, graph
  Analyst->>UI: Approve containment
  UI->>API: POST /api/actions
  API->>DB: audit + response_actions
```

## Layer responsibilities

| Layer | Path | Responsibility |
|-------|------|----------------|
| Presentation | `src/ui/`, `src/app/` | SOC workspace, graph, governance UI |
| API / middleware | `server.js`, `server/api.js`, `server/operations.js` | Auth, rate limit, CSP, routing |
| Domain | `src/engine.js` | Normalize, detect, correlate, risk, policy |
| Services | `services/*` | ML, LLM guardrails, PDF, Wazuh, agents |
| Persistence | `server/db.js` | 20+ tables, migrations, retention |
| Integrations | `services/telemetry.js`, `services/wazuh.js` | External telemetry |

## AI architecture rule (per spec)

| Mechanism | Use |
|-----------|-----|
| Isolation Forest + MAD | Anomaly detection |
| Rules / temporal correlation | Event relationships |
| Graph | Entity relationships |
| LLM (optional) | Natural language — **verified against evidence** |
| Deterministic engine | Risk + policy |
| Feedback | Threshold + retrainable model |
