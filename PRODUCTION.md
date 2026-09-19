# Production readiness

The repository now includes a **single-process investigation service with real-source ingestion and simulated containment**. It supports Wazuh, trained model artifacts, bounded external queries, Gemini, local sessions and organization-scoped storage. It has not been validated as a scalable production deployment. Setup and limitations are in [INTEGRATIONS.md](INTEGRATIONS.md).

## Implemented

- Loopback binding by default and an explicit network-exposure gate.
- Content Security Policy, frame protection, permissions policy, referrer protection, and MIME sniffing protection.
- Request IDs, optional structured JSON request logs, request/header/keep-alive timeouts, and mutation rate limiting.
- `/api/health`, dependency-aware `/api/ready`, and Prometheus `/api/metrics` endpoints.
- Graceful SIGINT/SIGTERM shutdown with database closure.
- Configurable retention cleanup using `SENTINEL_X_RETENTION_DAYS`.
- Consistent SQLite backups using `npm run backup -- backups/name.db`.
- Non-root container, dropped capabilities, read-only filesystem, persistent data volume, and container health check.
- Optional trusted reverse-proxy authentication with viewer, analyst, manager, and admin roles; authenticated identities are used in audit records.
- Optional grounded LLM investigation with evidence retrieval, redaction, prompt-injection rejection, citation validation, timeout, and deterministic fallback.
- Persistent model versions, offline evaluation, drift records, explicit promotion, and rollback.
- Persistent environment topology and relationship history with incident overlays.
- Durable ingestion job records, retries, dead-letter status, queue health, and connector contracts.
- Automated tests for headers, tracing, readiness, metrics, rate limiting, persistence, policy safety, and historical evidence isolation.

## Deploy safely

1. Copy `.env.example` to a protected environment configuration and review every value.
2. Keep the service bound to loopback, or use `compose.yaml`, which publishes only to `127.0.0.1` on the host.
3. Put an identity-aware reverse proxy in front of the service. Require TLS, SSO/MFA, role mapping, request size limits, and an allowlist for administrator routes. Set `SENTINEL_X_AUTH_MODE=proxy` and a long random `SENTINEL_X_PROXY_SECRET`. The proxy must remove all client-supplied `X-Sentinel-*` headers, then inject `X-Sentinel-Proxy-Secret`, `X-Sentinel-User`, `X-Sentinel-Role` (`viewer`, `analyst`, `manager`, or `admin`), and `X-Sentinel-Tenant=default` after authentication. Never expose the application port directly in this mode.
4. Scrape `/api/metrics`, monitor `/api/ready`, forward structured logs, and alert on 5xx responses, rate limits, readiness failure, and restart loops.
5. Run scheduled backups, copy them to encrypted off-host storage, and test restoration regularly.
6. Keep all response adapters in simulation until each target integration has a reviewed runbook, scoped service identity, rollback procedure, and approval control.

## External work still required

These items require organization-specific systems and cannot be safely invented in this repository:

- OIDC/SAML provider configuration, organization role mapping, MFA policy and user lifecycle. Local scrypt passwords and rotating sessions exist; local MFA enrollment and account recovery do not. A trusted identity proxy is supported for SSO/MFA.
- Independent review and load testing of the implemented organization isolation. Configured tenants have separate request context, events, incidents, policies, reports and models; Wazuh and push-source credentials currently belong only to the default organization.
- Wazuh and Gemini credentials and live acceptance testing; additional SIEM, EDR, firewall, identity and cloud adapters.
- Representative historical evaluation/training data and organization-approved model acceptance thresholds.
- A managed database or validated SQLite high-availability and restore strategy.
- A durable external event bus for multi-instance processing.
- Real containment adapters with least-privilege credentials, idempotency, rollback, and change approval.
- Organization-specific retention, legal hold, privacy, data residency, and incident-response policies.
- Threat-model review, penetration testing, dependency scanning, image signing, SBOM publication, and an operational security review.
