import {esc} from '../../lib/utils.js';
import {DEFAULT_WEIGHTS} from '../../engine.js';

const FORMULA = 'risk = round(100 × (1 − e^(−rawRisk / 75)))';

function severityLabel(risk, critical = 75) {
  if (risk >= critical) return 'Critical';
  if (risk >= 50) return 'High';
  if (risk >= 25) return 'Medium';
  return 'Low';
}

export function riskBreakdown(analysis, weights = DEFAULT_WEIGHTS, policy = {}) {
  const rawRisk = analysis.rawRisk ?? analysis.riskFactors.reduce((n, f) => n + (f.rawPoints || f.points || 0), 0);
  const score = analysis.risk ?? 0;
  const critical = policy.criticalRisk ?? 75;
  const factors = analysis.riskFactors || [];

  const eventFactors = factors.filter(f => f.kind === 'event' || f.eventId);
  const contextFactors = factors.filter(f => f.kind === 'context' || (!f.eventId && f.kind !== 'event'));

  const rows = factors.map(f => {
    const isEvent = Boolean(f.eventId);
    const weightKey = isEvent && analysis.events?.find(e => e.id === f.eventId)?.type;
    const source = isEvent && weightKey
      ? `Event weight · ${weightKey} = ${weights[weightKey] ?? 0}`
      : 'Contextual factor';
    const share = rawRisk > 0 ? Math.round((f.rawPoints / rawRisk) * 100) : 0;
    return `<tr>
      <td>${esc(f.label)}</td>
      <td><span class="risk-tag risk-tag--${isEvent ? 'event' : 'context'}">${isEvent ? 'Event' : 'Context'}</span></td>
      <td class="risk-num">+${f.rawPoints ?? '—'}</td>
      <td class="text-muted">${esc(source)}</td>
      <td class="risk-num risk-num--strong">+${f.points}</td>
      <td class="text-muted">${share}%</td>
    </tr>`;
  }).join('');

  return `
    <div class="risk-breakdown">
      <div class="risk-breakdown__hero">
        <div class="risk-breakdown__score">
          <strong>${score}</strong>
          <span>/ 100</span>
          <small>${severityLabel(score, critical)} severity</small>
        </div>
        <div class="risk-breakdown__formula">
          <h4>How this score is calculated</h4>
          <p class="risk-formula"><code>${FORMULA}</code></p>
          <ol class="risk-steps">
            <li><strong>Sum raw points</strong> from event-type weights and contextual factors → <em>${rawRisk} raw points</em></li>
            <li><strong>Apply curve</strong> so scores compress toward 100 without unbounded growth</li>
            <li><strong>Allocate</strong> the final ${score} points proportionally across each factor (rounded; last row absorbs remainder)</li>
          </ol>
          <p class="text-muted">Configured weights live in Configuration. Critical threshold: ${critical}/100.</p>
        </div>
      </div>

      <div class="risk-breakdown__bars">
        ${factors.length ? factors.map(f => {
          const pct = score > 0 ? Math.max(4, Math.round((f.points / score) * 100)) : 0;
          return `<div class="risk-bar-row" title="${esc(f.label)}">
            <span class="risk-bar-row__label">${esc(f.label)}</span>
            <div class="risk-bar-row__track"><div class="risk-bar-row__fill" style="width:${pct}%"></div></div>
            <span class="risk-bar-row__value">+${f.points}</span>
          </div>`;
        }).join('') : '<p class="text-muted">Start a simulation to see how each event and context signal contributes.</p>'}
      </div>

      <details class="risk-details" ${factors.length ? 'open' : ''}>
        <summary>Full calculation table</summary>
        <table class="risk-table">
          <thead>
            <tr>
              <th>Factor</th>
              <th>Type</th>
              <th>Raw pts</th>
              <th>Source</th>
              <th>Allocated</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="6" class="text-muted">No factors yet.</td></tr>'}
            <tr class="risk-table__total">
              <td colspan="2"><strong>Total</strong></td>
              <td class="risk-num"><strong>${rawRisk}</strong></td>
              <td class="text-muted">→ ${FORMULA}</td>
              <td class="risk-num risk-num--strong"><strong>${score}</strong></td>
              <td>100%</td>
            </tr>
          </tbody>
        </table>
      </details>

      <div class="risk-legend">
        <span><strong>${eventFactors.length}</strong> event weight${eventFactors.length === 1 ? '' : 's'}</span>
        <span><strong>${contextFactors.length}</strong> contextual factor${contextFactors.length === 1 ? '' : 's'}</span>
        <span>Confidence <strong>${Math.round((analysis.confidence || 0) * 100)}%</strong></span>
      </div>
    </div>`;
}
