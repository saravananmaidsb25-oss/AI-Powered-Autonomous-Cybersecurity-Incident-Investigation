# Real telemetry, investigation and trained models

## Runtime and boundaries

The existing modular Node application now has executable integrations. All containment remains simulated. Real-source events retain `simulation:false`; reports and the UI distinguish real evidence from simulated response. This is a single-process deployment with SQLite, a bounded source workspace (300 events per real source), and SSE, not a horizontally scalable SOC service.

No live customer/vendor credentials were available during development. HTTP integration tests use local fixtures; no live Wazuh or Gemini account has been validated. The synthetic training example is explicitly labeled synthetic and is not a production-accuracy benchmark.

## Configuration

Copy `.env.example` to a protected local file and run `node --env-file=.env server.js` with Node 22+. `npm start` also accepts environment variables inherited from the shell. Do not commit `.env`, passwords, tokens, TLS keys, raw telemetry or production databases. Restart the server after changing environment configuration.

Docker Compose reads `.env` through `env_file`; create it from `.env.example` before starting Compose. Container deployment has not been verified in this environment.

For direct HTTPS, set both `SENTINEL_X_TLS_CERT` and `SENTINEL_X_TLS_KEY` to readable PEM file paths and set `SENTINEL_X_PUBLIC_ORIGIN` to the exact HTTPS origin. Direct TLS enables Secure session cookies and HSTS and requires TLS 1.2 or newer. For reverse-proxy termination, leave those paths empty and set `SENTINEL_X_SECURE_COOKIES=1`. A real certificate handshake remains deployment validation work. Container paths must refer to separately mounted certificate files.

### Wazuh

Set `SENTINEL_X_WAZUH_URL` to the indexer origin, `SENTINEL_X_WAZUH_USER` and `SENTINEL_X_WAZUH_PASSWORD` to a read-only service account, and optionally `SENTINEL_X_WAZUH_INDEX` (default `wazuh-alerts-*`). HTTPS is required except for loopback fixture servers. Configure a trusted CA through `NODE_EXTRA_CA_CERTS` for private certificates; TLS validation is never disabled. Destinations come only from server configuration and redirects are rejected.

In **Integrations & models**, select **Collect Wazuh alerts**. The adapter queries the [Wazuh indexer search API](https://documentation.wazuh.com/current/user-manual/indexer-api/use-case.html), validates and maps alerts, persists collection state, and deduplicates source IDs. Authentication success/failure groups map to authentication events; other rules remain endpoint alerts rather than guessing attack stages from free text. Source rule severity is retained for reference but not trusted as risk.

Collection starts with a five-minute window. It reads at most three pages of 100 events per poll, retains unfinished pagination state, and re-reads five minutes on later completed windows to catch late arrivals. It stops with a visible error at workspace capacity or the upstream pagination limit. Events delayed beyond this overlap require operator backfill. Page-offset pagination can shift under concurrent upstream writes; deduplication and overlap reduce that risk but are not a lossless streaming guarantee.

Set `SENTINEL_X_WAZUH_POLL_MS=30000` for background collection, retrying with bounded exponential backoff. This connector is bound to the default organization. Additional organizations cannot use its credentials.

### Authenticated push

Set `SENTINEL_X_TELEMETRY_TOKEN` to a random secret of at least 32 characters. Send `POST /api/v1/telemetry/events` with `Authorization: Bearer ...` and JSON:

```json
{"event_id":"source-001","timestamp":"2026-09-19T10:00:00Z","event_type":"authentication_failure","source_type":"authentication","user_id":"lab-user","device_id":"host-01","source_ip":"192.0.2.10","action":"Failed authentication","normalized":{"failures":1},"raw_data":{}}
```

The source token is scoped to the default organization's telemetry workspace. The body cannot choose an organization or mark real records as simulated. Unsupported types, malformed timestamps, invalid numeric fields and unauthorized submissions are rejected. Identical source IDs are idempotent. Client severity and risk do not override detection. Source tokens must be carried over HTTPS outside the local host.

### External investigation

Open real-source telemetry in **Investigation**, then select **Investigate external evidence**. The planner seeds a queue from observed devices/accounts/IPs, executes read-only Wazuh queries, and extends the queue when related evidence introduces another entity. It enforces a 1–5 query budget, a time deadline and a 100-record evidence budget. Results outside the requested time range or entity match are discarded. The query trace, stop reason, evidence and verified extractive claims are persisted.

`POST /api/investigations/external` accepts `{ "scenarioId":"wazuh", "step":1, "maxQueries":3 }` with an analyst session and CSRF token. `GET /api/investigations/wazuh` retrieves saved runs. The same connector authorization applies. These results are newly retrieved evidence, not facts known at the original incident snapshot. They do not silently change incident risk or trigger containment.

Set `SENTINEL_X_EXTERNAL_INVESTIGATIONS=1` for automatic investigation after real-source detections. Concurrent runs for the same source are suppressed. This planner is deterministic; it does not give an LLM arbitrary URLs, commands or credentials.

### Gemini

Set `SENTINEL_X_GEMINI_API_KEY` and `SENTINEL_X_GEMINI_MODEL` to a model available in your Google account. The server uses the [Gemini generateContent API](https://ai.google.dev/api/generate-content) with structured JSON output. It sends a small retrieved evidence set without raw payloads. Validated observations are displayed alongside deterministic incident reasoning. Timeout, malformed JSON, unknown citations or unsupported claims fall back to the deterministic assistant. Detection, correlation, risk and response policy do not depend on Gemini availability. Configuring a provider authorizes sending that retrieved evidence to it; follow your organization's data-handling policy.

## Train, evaluate, deploy and roll back

1. In **Integrations & models**, download the synthetic example to inspect the JSON format. Replace it with reviewed organizational data for meaningful evaluation.
2. Provide a unique `version`, `datasetName`, 20–2000 normal `trainingEvents`, and 10–1000 distinct `evaluationEvents` of shape `{event, anomaly:true|false}`. At least five evaluation events from each class are required. Events use the internal normalized schema, including an explicit simulation label. Training and evaluation IDs must be disjoint.
3. Upload the file, review its labels, and check the approval box. Training executes in a bounded worker thread and stores the forest, learned baseline, feature schema, seed, dataset digests, checksum and server-computed evaluation metrics.
4. Promotion requires precision >= 0.8, recall >= 0.8 and false-positive rate <= 0.2 on the supplied held-out set. These are event anomaly metrics, not a claim of incident-level accuracy or independent benchmark quality.
5. **Deploy evaluated model** changes actual server and browser inference. **Roll back model** reloads the preceding version. Artifacts survive restart. Metadata-only registrations cannot be promoted.

Endpoints: `POST /api/model-ops/train`, `/promote`, `/rollback`; `GET /api/model-ops` and `/deployed`. Mutations require an administrator session. The bundled `iforest-demo-v1` remains available as a fallback. Model training is explicit and does not occur merely because an analyst submits feedback.

## Authentication and organizations

The default `demo` identity is for local demonstrations. For local user accounts, set `SENTINEL_X_AUTH_MODE=local`, then provision a user in a shell with a temporary `SENTINEL_X_NEW_USER_PASSWORD` environment variable:

```sh
node scripts/create-user.js default analyst@example.test analyst
```

Remove the temporary password variable after provisioning. Roles are `viewer`, `analyst`, `manager`, and `admin`. Passwords use scrypt with unique salts. Access sessions expire after 15 minutes; refresh tokens expire after seven days, rotate once, and revoke their family on reuse. Only hashes of session secrets are persisted. Cookies are HttpOnly/SameSite=Strict; set `SENTINEL_X_SECURE_COOKIES=1` and `SENTINEL_X_PUBLIC_ORIGIN=https://your-host` behind HTTPS. Login, refresh and logout live under `/api/v1/auth`. Local MFA enrollment and account recovery are not implemented; use the trusted identity proxy for organizational MFA/SSO.

For multiple organizations, add explicitly allowed IDs to `SENTINEL_X_TENANTS` and provision accounts or verified proxy role mappings for each. Request context, persisted telemetry, incidents, policies, reports, models, audit and SSE delivery are tenant-scoped. The default Wazuh and source-token integrations cannot be borrowed by another organization. Multi-organization live connectors and token administration remain additional work.
