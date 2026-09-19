# Security — SENTINEL-X

## Authentication modes

| Mode | Env | Behavior |
|------|-----|----------|
| `demo` | default | Auto-admin for local jury demo |
| `local` | `SENTINEL_X_AUTH_MODE=local` | scrypt passwords + rotating sessions |
| `proxy` | `SENTINEL_X_AUTH_MODE=proxy` | Header-based RBAC (viewer/analyst/manager/admin) |

Create local user: `node scripts/create-user.js email password role`

## Authorization

- Role hierarchy enforced in `server/auth.js`
- Policy changes require manager+
- Response actions require analyst+
- Metrics endpoint requires authentication

## Transport & headers

- CSP, X-Frame-Options, Referrer-Policy (`server/operations.js`)
- Optional TLS via `SENTINEL_X_TLS_CERT` / `SENTINEL_X_TLS_KEY`
- HSTS when HTTPS enabled
- Loopback bind by default; network requires `SENTINEL_X_ALLOW_NETWORK=1`

## Application security

- CSRF boundary: `X-Sentinel-Demo-Token` on mutations
- Rate limiting on write endpoints
- Path traversal protection on static files
- Secret redaction in events and LLM payloads
- Prompt-injection guard in `services/llmInvestigation.js`
- Tenant-scoped queries (tested in `test/live-platform.test.js`)

## Response safety

- **All containment is simulated** unless explicitly configured otherwise
- Policy allowlist + mandatory approval for high-impact actions
- Every action records actor, policy, evidence IDs, timestamp

## Data

- SQLite file at `data/sentinel-x.db`
- Backup: `npm run backup`
- Retention pruning: `SENTINEL_X_RETENTION_DAYS`
