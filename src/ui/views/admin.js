import {esc} from '../../lib/utils.js';
import {panel} from '../components/panel.js';
import {store} from '../../app/state.js';
import {DEFAULT_POLICY} from '../../engine.js';

export function adminView() {
  const pol = store.state.policy;
  const w = store.state.weights;

  return `<div class="layout-grid layout-grid--2">
    <div class="stack">
      ${panel('Policy configuration', `
        <div class="form-grid">
          <label class="field"><span>Policy</span><input class="input" value="${esc(pol.id)} · simulation only" disabled></label>
          <label class="field"><span>Critical risk threshold</span><input id="pol-risk" class="input" type="number" min="1" max="100" value="${pol.criticalRisk}"></label>
          <label class="field"><span>Minimum confidence</span><input id="pol-conf" class="input" type="number" min="0" max="1" step="0.01" value="${pol.minConfidence}"></label>
        </div>
        <button type="button" class="btn btn--primary" data-action="save-policy">Save policy</button>`)}
      ${panel('Response authorization', `
        <p class="text-muted">Select permitted simulated actions. High-impact actions always require analyst approval.</p>
        <div class="form-grid">${DEFAULT_POLICY.allowedActions.map(a => `<label class="field"><span><input type="checkbox" data-allowed-action="${esc(a)}" ${pol.allowedActions.includes(a)?'checked':''}> ${esc(a)}</span>${DEFAULT_POLICY.approvalRequired.includes(a)?'<small>Human approval mandatory</small>':`<small><input type="checkbox" data-approval-action="${esc(a)}" ${pol.approvalRequired.includes(a)?'checked':''}> Require approval</small>`}</label>`).join('')}</div>`)}
    </div>
    <div class="stack">
      ${panel('Risk weight configuration', `
        <div class="form-grid form-grid--weights">
          ${Object.entries(w).map(([k, v]) => `<label class="field"><span>${esc(k)}</span><input data-weight="${k}" class="input" type="number" value="${v}"></label>`).join('')}
        </div>
        <button type="button" class="btn btn--primary" data-action="save-weights">Save weights</button>
        <p class="text-muted">Weights apply immediately to explainable risk scoring.</p>`)}
      ${panel('AI architecture (per spec)', `
        <ul class="arch-list">
          <li><strong>Isolation Forest + MAD</strong><span>Anomaly detection</span></li>
          <li><strong>Temporal rules</strong><span>Event correlation</span></li>
          <li><strong>Entity graph</strong><span>Attack relationships</span></li>
          <li><strong>Evidence templates</strong><span>Investigation assistant</span></li>
          <li><strong>Deterministic engine</strong><span>Risk & policy</span></li>
          <li><strong>Feedback loop</strong><span>Threshold adjustment</span></li>
        </ul>`)}
    </div>
  </div>`;
}
