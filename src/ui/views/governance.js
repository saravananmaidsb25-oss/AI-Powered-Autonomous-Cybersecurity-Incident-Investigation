import {esc, time} from '../../lib/utils.js';
import {panel} from '../components/panel.js';
import {badge} from '../components/badge.js';
import {store} from '../../app/state.js';

export function governanceView(ctx) {
  const {s, a} = ctx;
  const visible = x => x.step === null ? store.state.step === s.events.length : x.step <= store.state.step;
  const actions = store.actions.filter(x => x.scenarioId === s.id && visible(x));
  const audits = store.audit.filter(x => x.scenarioId === s.id && visible(x));
  const pol = store.state.policy;
  const evidenceProcessed = !store.state.apiOnline || (store.processedSteps[s.id]||0) >= store.state.step;
  const alreadyApproved = actions.some(x=>x.action===a.policy.action&&x.status==='approved');

  return `<div class="layout-grid layout-grid--2">
    <div class="stack">
      ${panel('Policy engine decision', `
        <div class="policy-panel">
          <div class="chip-row">${badge(a.policy.level, a.policy.level.toLowerCase())} ${badge(pol.mode, 'info')}</div>
          <h3>${esc(a.policy.decision)}</h3>
          <p>${esc(a.policy.reason)}</p>
          <dl class="meta-grid">
            <div><dt>Policy</dt><dd>${esc(pol.id)}</dd></div>
            <div><dt>Risk threshold</dt><dd>${pol.criticalRisk}/100</dd></div>
            <div><dt>Min confidence</dt><dd>${Math.round(pol.minConfidence * 100)}%</dd></div>
            <div><dt>Approval</dt><dd>${a.policy.approval ? 'Required' : 'Not required'}</dd></div>
          </dl>
        </div>`)}
      ${panel('Response simulation', `
        <div class="sim-panel">
          <span class="sim-panel__label">Proposed action</span>
          <h3>${esc(a.policy.action || 'Continue monitoring')}</h3>
          <div class="sim-panel__block"><strong>Expected result</strong><p>Action recorded; no external systems changed.</p></div>
          <div class="sim-panel__block"><strong>Potential consequence</strong><p>${a.policy.action?.includes('isolate') ? 'Could interrupt user connectivity in production.' : 'Analyst review time or session impact.'}</p></div>
        </div>
        ${a.policy.action ? `${evidenceProcessed?'':'<p class="text-muted">Replay this evidence before recording a response decision.</p>'}${alreadyApproved?'<p class="text-muted">This action was already approved in the current replay.</p>':''}<input id="response-reason" class="input" placeholder="Reason for analyst decision" aria-label="Reason for decision" ${alreadyApproved?'disabled':''}><div class="btn-row">
          <button type="button" class="btn btn--primary" data-action="approve" ${evidenceProcessed&&!alreadyApproved?'':'disabled'}>${a.policy.approval ? 'Approve action' : 'Execute safe action'}</button>
          <button type="button" class="btn btn--secondary" data-action="reject" ${evidenceProcessed&&!alreadyApproved?'':'disabled'}>Reject</button>
        </div>` : ''}`)}
      ${panel('Action history', `
        <div class="action-list">
          ${actions.map(x => `<div class="action-item"><strong>${esc(x.action)}</strong>${badge(x.status, x.status)}<small>${esc(x.timestamp)} · ${esc(x.target||'Unattributed target')} · risk ${Number.isFinite(x.risk)?`${x.risk}/100`:'not recorded'} · evidence ${esc((x.evidenceIds||[]).join(', ')||'not recorded')} · ${esc(x.result)}</small></div>`).join('') || '<div class="empty-state"><p>No actions recorded at this historical point.</p></div>'}
        </div>`)}
    </div>
    <div class="stack">
      ${panel('Audit trail', `
        <div class="audit-list">
          ${audits.map(x => `<div class="audit-item"><time>${time(x.timestamp)}</time><div><strong>${esc(x.type)}</strong><p>${esc(x.detail)}</p><small>${esc(x.actor)} · simulation</small></div></div>`).join('') || '<div class="empty-state"><p>No audit entries.</p></div>'}
        </div>`)}
      ${panel('Governance boundaries', `
        <ul class="check-list">
          <li>Evidence → Risk → Policy → Decision traceability</li>
          <li>High-impact actions require human approval</li>
          <li>AI has no unrestricted authority</li>
          <li>Simulated responses only; production mode is unavailable</li>
        </ul>`)}
      ${panel('Export incident report', `
        <div class="btn-stack">
          <button type="button" class="btn btn--secondary btn--block" data-action="export">Download JSON</button>
          <button type="button" class="btn btn--secondary btn--block" data-action="export-csv">Download CSV</button>
          <button type="button" class="btn btn--secondary btn--block" data-action="export-pdf">Print PDF report</button>
        </div>`)}
    </div>
  </div>`;
}
