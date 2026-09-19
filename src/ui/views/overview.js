import {esc} from '../../lib/utils.js';
import {panel} from '../components/panel.js';
import {metricGrid} from '../components/metric.js';
import {badge} from '../components/badge.js';
import {eventRow} from '../components/timeline.js';
import {securityPipeline} from '../components/pipeline.js';
import {store} from '../../app/state.js';
import {riskBreakdown} from '../components/riskBreakdown.js';

export function overviewView(ctx) {
  const {s, a, active, pending, pendingCount, briefing, assets, triaged, scenarios} = ctx;
  const visibleAction = x => x.scenarioId !== s.id || (x.step === null ? store.state.step === s.events.length : x.step <= store.state.step);
  return `
    ${securityPipeline(6)}
    ${metricGrid([
      {label: 'Active incidents', value: active.filter(x => x.detected).length, hint: 'Under investigation'},
      {label: 'Critical incidents', value: active.filter(x => x.severity === 'Critical').length, hint: 'Immediate attention', variant: 'critical'},
      {label: 'AI investigations', value: active.length, hint: 'Evidence-grounded'},
      {label: 'High-risk assets', value: assets.length, hint: assets.slice(0, 2).join(', ') || 'None'},
      {label: 'Auto-triaged', value: triaged, hint: 'Policy-eligible events'},
      {label: 'Pending approvals', value: pendingCount, hint: 'Human governance', variant: pendingCount ? 'warning' : 'default'},
    ])}
    <div class="layout-grid layout-grid--2">
      <div class="stack">
        ${panel('Threat posture', `
          <div class="posture-card ${a.severity === 'Critical' ? 'posture-card--critical' : ''}">
            <div class="risk-gauge">
              <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="risk-gauge__bg"/><circle cx="60" cy="60" r="52" class="risk-gauge__fill" stroke-dasharray="${a.risk * 3.27} 327"/></svg>
              <div class="risk-gauge__value"><strong>${a.risk}</strong><small>/100</small></div>
            </div>
            <div class="posture-card__body">
              <h3>${a.detected ? `${a.severity} risk — ${esc(a.disposition)}` : `${esc(a.disposition)} — no active anomaly`}</h3>
              <p>${a.detected ? esc(`${a.detectionMethod}. ${a.contextSignals.join('. ')}`) : 'Start a scenario to evaluate threat posture.'}</p>
              <div class="chip-row">${badge(`${Math.round(a.confidence * 100)}% confidence`, 'info')} ${badge(a.disposition, a.detected ? 'high' : 'default')}</div>
            </div>
          </div>`)}
        ${panel('Incident priority queue', `
          <div class="incident-queue">
            ${scenarios.map((x, i) => {
              const v = active[i];
              return `<button type="button" class="incident-queue__item ${x.id === s.id ? 'incident-queue__item--active' : ''}" data-scenario="${x.id}">
                <span class="incident-queue__severity incident-queue__severity--${v.severity.toLowerCase()}">${v.severity === 'Critical' ? '!' : '◇'}</span>
                <span class="incident-queue__main">
                  <strong>${esc(v.events.length === x.events.length ? x.summary : x.name)}</strong>
                  <small>${x.incidentId} · Risk ${v.risk} · ${v.affected.assets.length} assets</small>
                </span>
                ${badge(v.severity, v.severity.toLowerCase())}
              </button>`;
            }).join('')}
          </div>`)}
        ${panel('Live event stream', `
          <div class="timeline">${a.events.length ? a.events.map(e => eventRow(e)).join('') : '<div class="empty-state"><p>Start simulation to ingest events.</p></div>'}</div>`,
          `<span class="text-muted">${a.events.length}/${s.events.length} events</span>`)}
      </div>
      <div class="stack">
        ${panel('AI security briefing', `
          <div class="briefing-card">
            <div class="briefing-card__stats">
              <div><strong>${briefing.activeIncidents}</strong><span>Active</span></div>
              <div><strong>${briefing.criticalIncidents}</strong><span>Critical</span></div>
              <div><strong>${briefing.pendingApprovals}</strong><span>Pending</span></div>
            </div>
            <p><strong>Affected assets:</strong> ${esc(briefing.affectedAssets.join(', ') || 'none')}</p>
            <ul class="briefing-list">${briefing.priorities.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
            <p class="text-muted">${briefing.label}</p>
          </div>`)}
        ${panel('Analyst attention', `
          <div class="attention-card ${pending ? 'attention-card--urgent' : ''}">
            <div class="attention-card__icon">${pending ? '!' : '✓'}</div>
            <div>
              <strong>${pending ? 'Endpoint isolation needs approval' : a.detected ? 'Investigation ready for review' : 'No action pending'}</strong>
              <p>${pending ? 'Policy requires human decision before simulated containment.' : 'Review evidence and response guidance.'}</p>
            </div>
          </div>
          <button type="button" class="btn btn--ghost btn--block" data-view="governance">Open governance →</button>`)}
        ${panel('Risk score calculation', riskBreakdown(a, store.state.weights, store.state.policy), `<button type="button" class="btn btn--ghost" data-view="admin">Edit weights</button>`)}
        ${panel('Actions already taken', `<div class="action-list">${store.actions.filter(visibleAction).slice(0,4).map(x=>`<div class="action-item"><strong>${esc(x.action)}</strong>${badge(x.status,x.status)}<small>${esc(x.scenarioId)} · ${esc(x.result)} · ${esc(x.evidenceIds?.join(', ')||'legacy record')}</small></div>`).join('')||'<div class="empty-state"><p>No simulated response has been recorded yet.</p></div>'}</div>`)}
      </div>
    </div>`;
}
