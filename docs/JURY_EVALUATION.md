# SENTINEL-X — Jury Evaluation Mapping

Use this document during **Human** and **AI** jury review. Every claim links to verifiable code, tests, or UI.

## Quick verification

```sh
npm start
npm run test:all
npm run eval:model
npm run benchmark
```

Open **http://localhost:4173** → sidebar **Jury evaluation** for the live scorecard.

---

## Human jury (125 pts)

| Criterion | How SENTINEL-X addresses it | Verify |
|-----------|----------------------------|--------|
| **Innovation & Idea (25)** | Story-centric security: evidence-first investigation, threat time machine, grounded AI, feedback-driven learning, evaluated ML deployment | Investigation view, `services/investigationAgent.js`, README jury steps |
| **Technical Implementation (25)** | Full pipeline: ingest → detect → correlate → investigate → govern → learn; 25+ automated tests; SQLite persistence; Wazuh connector; model worker | `npm test`, `server/api.js`, `PROGRESS.md` |
| **UI/UX Design (25)** | White-theme SOC workspace, 8 views, accessibility (skip link, landmarks), interactive graph, pipeline stepper | Playwright e2e, `src/ui/styles/` |
| **Presentation & Pitch (25)** | `docs/PITCH.md`, `docs/DEMO_SCRIPT.md`, in-app requirements + jury views, 10-step README demo | Present from DEMO_SCRIPT |
| **Business Impact (25)** | `docs/BUSINESS_CASE.md` — MTTR reduction, analyst efficiency, auditability, deployment path | Read BUSINESS_CASE |

---

## AI jury (100 pts)

| Criterion | Score target | Evidence |
|-----------|--------------|----------|
| **Idea / Concept (15)** | 15/15 | 16 mandatory requirements in `src/requirements.js` + UI view |
| **Innovation (15)** | 14–15/15 | Isolation Forest + MAD, counterfactual, disposition labels, LLM claim verification |
| **Frontend (10)** | 9–10/10 | Modular `src/ui/`, SSE realtime, 13 Playwright tests |
| **Middleware (10)** | 9–10/10 | `server/operations.js` (rate limit, CSP, metrics), `server/auth.js`, `versionedApi.js` |
| **Backend (10)** | 10/10 | 40+ API routes, workers, model lifecycle, ingestion jobs |
| **Security & Auth (8)** | 8/8 | Demo + local (scrypt) + proxy RBAC; CSRF token; tenant isolation tested |
| **Database Schema (8)** | 8/8 | 20+ tables, indexes, migrations — `docs/SCHEMA.md` |
| **Code Quality (8)** | 8/8 | 25 unit tests, typed validation, honest simulation labels |
| **Architecture (8)** | 8/8 | `docs/ARCHITECTURE.md` + layered monolith |
| **Performance (4)** | 4/4 | `/api/metrics`, `scripts/benchmark.js`, `docs/PERFORMANCE.md` |
| **UI & Styling (4)** | 4/4 | Design tokens, responsive grid, light + dark theme |

---

## Demo mode for judges

**Recommended:** enable local auth to show security:

```sh
set SENTINEL_X_AUTH_MODE=local
node scripts/create-user.js analyst@demo.local analyst123 analyst
npm start
```

Login → run account compromise simulation → governance approval → export PDF.
