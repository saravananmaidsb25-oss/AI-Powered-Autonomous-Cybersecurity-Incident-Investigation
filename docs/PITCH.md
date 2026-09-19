# SENTINEL-X — 3-Minute Pitch

## Problem (30s)

Security teams drown in alerts. SIEMs show *what* happened, not *why it matters* or *what to do next*. Analysts waste hours correlating logs, and AI tools often hallucinate conclusions without evidence.

## Solution (45s)

**SENTINEL-X** turns fragmented security events into an **explainable attack story**:

> MONITOR → DETECT → CORRELATE → INVESTIGATE → EXPLAIN → PRIORITIZE → RESPOND → LEARN → PREVENT

We separate **observed evidence** from **inference**, preserve **uncertainty**, and require **human approval** before high-impact actions.

## Innovation (45s)

1. **Threat time machine** — replay investigations without leaking future evidence  
2. **Evidence-grounded AI** — every claim cites event IDs; unsupported LLM output is rejected  
3. **Evaluated ML** — Isolation Forest trained on held-out data; promotion requires precision/recall gates  
4. **Controlled response** — policy engine with simulation-only containment and full audit trail  

## Demo hook (30s)

*27 failed logins → unknown device → privilege escalation → sensitive files → lateral movement → suspected exfiltration.*

Watch risk climb, see the attack graph light up, approve simulated endpoint isolation, export a PDF incident report.

## Business impact (20s)

- Faster triage (story vs. raw alerts)  
- Fewer false-positive escalations (disposition + legitimacy reasoning)  
- Audit-ready decisions (policy, actor, evidence IDs, timestamp)  
- Path to production: auth, Wazuh connector, Docker, metrics — containment stays governed  

## Close (10s)

SENTINEL-X is not another dashboard. It is an **AI security investigator** that helps teams respond with evidence, not guesswork.
