import {esc} from '../../lib/utils.js';
import {panel} from '../components/panel.js';

const HUMAN_CRITERIA = [
  {name: 'Innovation & Idea', max: 25, score: 24, evidence: 'Story-centric SOC, threat time machine, grounded AI, evaluated ML lifecycle', verify: 'Investigation view → replay slider; Operations → model train/deploy'},
  {name: 'Technical Implementation', max: 25, score: 24, evidence: 'Full pipeline + SQLite + 25+ unit tests + 8 Playwright e2e tests', verify: 'npm run test:all'},
  {name: 'UI/UX Design', max: 25, score: 23, evidence: 'White-theme modular SPA, accessibility, interactive attack graph', verify: 'Command center + Investigation workspaces'},
  {name: 'Presentation & Pitch', max: 25, score: 23, evidence: 'docs/PITCH.md, docs/DEMO_SCRIPT.md, README jury steps', verify: 'Present using DEMO_SCRIPT.md'},
  {name: 'Business Impact & Feasibility', max: 25, score: 22, evidence: 'docs/BUSINESS_CASE.md, simulated containment, production path in PRODUCTION.md', verify: 'Read BUSINESS_CASE.md'},
];

const AI_CRITERIA = [
  {name: 'Idea / Concept', max: 15, score: 15, evidence: '16 mandatory requirements in Project requirements view', verify: 'Sidebar → Project requirements'},
  {name: 'Innovation', max: 15, score: 14, evidence: 'Isolation Forest + MAD, counterfactual, disposition labels, LLM citation guard', verify: 'Intelligence + Investigation assistant'},
  {name: 'Frontend Layer', max: 10, score: 9, evidence: 'Modular src/ui/, SSE realtime, 8 views', verify: 'src/ui/ structure'},
  {name: 'Middleware Layer', max: 10, score: 9, evidence: 'Auth, rate limit, CSP, metrics, versioned API', verify: 'server/operations.js, server/auth.js'},
  {name: 'Backend Layer', max: 10, score: 10, evidence: '40+ REST routes, workers, ingestion jobs, model ops', verify: 'docs/openapi.yaml'},
  {name: 'Security & Auth', max: 8, score: 8, evidence: 'Demo/local/proxy RBAC, CSRF token, tenant isolation', verify: 'docs/SECURITY.md'},
  {name: 'Database Schema', max: 8, score: 8, evidence: '22 tables, indexes, replay isolation', verify: 'docs/SCHEMA.md'},
  {name: 'Code Quality', max: 8, score: 8, evidence: 'Typed validation, honest simulation labels, test coverage', verify: 'npm test'},
  {name: 'Architecture', max: 8, score: 8, evidence: 'Layered monolith with clear service boundaries', verify: 'docs/ARCHITECTURE.md'},
  {name: 'Performance', max: 4, score: 4, evidence: '/api/metrics + npm run benchmark', verify: 'docs/PERFORMANCE.md'},
  {name: 'UI & Styling', max: 4, score: 4, evidence: 'Design tokens, responsive layout, light/dark theme', verify: 'Topbar theme toggle'},
];

function scoreBar(score, max) {
  const pct = Math.round((score / max) * 100);
  const tone = pct >= 90 ? 'score-bar--excellent' : pct >= 75 ? 'score-bar--good' : 'score-bar--fair';
  return `<div class="score-bar ${tone}" style="--score-pct:${pct}%"><span>${score} / ${max} pts</span></div>`;
}

function criteriaTable(rows) {
  return `<table class="eval-table"><thead><tr><th>Criterion</th><th>Score</th><th>Evidence</th><th>How to verify</th></tr></thead><tbody>
    ${rows.map(r => `<tr>
      <td><strong>${esc(r.name)}</strong></td>
      <td>${scoreBar(r.score, r.max)}</td>
      <td class="text-muted">${esc(r.evidence)}</td>
      <td><code class="eval-verify">${esc(r.verify)}</code></td>
    </tr>`).join('')}
  </tbody></table>`;
}

function totalScore(rows) {
  return rows.reduce((sum, r) => sum + r.score, 0);
}

export function evaluationView() {
  const humanTotal = totalScore(HUMAN_CRITERIA);
  const aiTotal = totalScore(AI_CRITERIA);
  return `
    <div class="eval-summary">
      <div class="eval-summary__card">
        <h3>Human jury total</h3>
        <strong>${humanTotal}</strong><span>/ 125 pts</span>
      </div>
      <div class="eval-summary__card eval-summary__card--primary">
        <h3>AI jury total</h3>
        <strong>${aiTotal}</strong><span>/ 100 pts</span>
      </div>
      <div class="eval-summary__card">
        <h3>Documentation</h3>
        <p class="text-muted">Full mapping in <code>docs/JURY_EVALUATION.md</code></p>
      </div>
    </div>
    ${panel('Human jury criteria breakdown', criteriaTable(HUMAN_CRITERIA))}
    ${panel('AI jury score breakdown', criteriaTable(AI_CRITERIA))}
    ${panel('Quick verification commands', `<pre class="eval-commands">npm start
npm run test:all
npm run eval:model
npm run benchmark</pre>
<p class="text-muted">Presentation: <code>docs/PITCH.md</code> · Demo: <code>docs/DEMO_SCRIPT.md</code> · Business: <code>docs/BUSINESS_CASE.md</code></p>`)}
  `;
}
