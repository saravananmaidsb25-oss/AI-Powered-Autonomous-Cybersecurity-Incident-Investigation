# Jury Demo Script (10 minutes)

## Setup (before judges arrive)

```sh
npm start
# Optional: local auth
set SENTINEL_X_AUTH_MODE=local
node scripts/create-user.js judge@sentinel.local judge123 admin
```

## Minute 0–1: Problem & positioning

Open **Command center**. Say:

> "SENTINEL-X moves security from alert-centric to story-centric investigation."

Point to the **pipeline stepper** (Monitor → Prevent).

## Minute 1–3: Account compromise simulation

1. Select **Account compromise** (SX-2401)
2. Click **Start simulation**
3. Narrate each event as it appears
4. Highlight risk gauge climbing to Critical

## Minute 3–5: Investigation depth

Open **Investigation**:

- Attack story with CONFIRMED / PROBABLE / SUSPECTED labels
- Attack graph highlights on replay
- Move **time machine** slider — show earlier step hides future evidence
- Ask assistant: *"Why was this detected?"*

## Minute 5–7: Governance

Open **Governance**:

- Show policy decision (human approval required)
- Enter reason → **Approve action**
- Show audit trail entry

## Minute 6–7: Export

Export **PDF report** — walk through evidence, risk, uncertainty sections.

## Minute 7–8: Intelligence & learning

Open **Intelligence**:

- Submit analyst feedback (after replay completes)
- Show threshold impact note
- Brief on recurring patterns / briefing

## Minute 8–9: Innovation extras (optional)

- **Integrations & models** — Wazuh connector, model train/evaluate/promote
- **Project requirements** — 16 mandatory items
- **Jury evaluation** — criteria mapping

## Minute 9–10: Business & honesty

> "Containment is simulated. Production path: auth, connectors, Docker, metrics — documented in PRODUCTION.md."

Q&A — refer to `docs/JURY_EVALUATION.md`.
