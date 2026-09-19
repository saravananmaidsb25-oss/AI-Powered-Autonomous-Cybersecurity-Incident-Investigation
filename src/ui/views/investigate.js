import {esc, time} from '../../lib/utils.js';
import {panel} from '../components/panel.js';
import {badge} from '../components/badge.js';
import {eventRow} from '../components/timeline.js';
import {store} from '../../app/state.js';
import {getFeedback} from '../../app/context.js';
import {analyze, compareIncidents} from '../../engine.js';
import {scenarios} from '../../scenarios.js';
import {runInvestigation} from '../../../services/investigationAgent.js';
import {riskBreakdown} from '../components/riskBreakdown.js';

export function investigateView(ctx) {
  const {s, a, currentId, environmentEntities=[]} = ctx;
  const step = store.state.step;
  return `
    <nav class="section-nav" aria-label="Investigation sections"><a href="#threat-summary">Summary</a><a href="#risk-calculation">Risk</a><a href="#attack-story">Story</a><a href="#evidence-timeline">Evidence</a><a href="#digital-twin">Graph</a><a href="#impact-analysis">Impact</a><a href="#investigation-tools">Analysis tools</a><a href="#incident-lifecycle">Lifecycle</a></nav>
    <div class="layout-grid layout-grid--investigate">
      <div class="stack">
        <div id="threat-summary">${panel('Threat summary', threatSummary(s, a))}</div>
        <div id="risk-calculation">${panel('Risk score calculation', riskBreakdown(a, store.state.weights, store.state.policy))}</div>
        <div id="attack-story">${panel('Attack story engine', attackStory(a))}</div>
        ${panel('Attack replay & threat time machine', replayControls(s, step), badge('Historical view', 'info'))}
        <div id="evidence-timeline">${panel('Event timeline & evidence', `<div class="timeline">${a.events.map(e => eventRow(e, e.id === currentId)).join('') || '<div class="empty-state"><p>No events at this point.</p></div>'}</div>`)}</div>
        <div id="digital-twin">${panel('Attack graph & security digital twin', graphPanel(a,environmentEntities))}</div>
        ${panel('Evidence chain', evidenceChain(a))}
        ${panel('Uncertainty map', uncertaintyMap(a.uncertaintyMap))}
        <div id="impact-analysis">${panel('Blast radius analysis', blastRadius(a.affected))}</div>
        <div id="investigation-tools">${panel('Turning point & counterfactual', turningPoint(a))}</div>
        ${panel('Investigation gap detector', gaps(a.gaps))}
        ${panel('Bounded investigation agent', agentPanel(a))}
        ${panel('External evidence investigation', externalPanel(s,a))}
        ${panel('Incident comparison', comparisonUI(s))}
        <div id="incident-lifecycle">${panel('Incident lifecycle', lifecycleForm(s))}</div>
      </div>
      <div class="stack stack--sticky">
        ${panel('AI investigation assistant', assistantPanel())}
        ${panel('Why flagged / Why not false positive', whyPanels(a))}
        ${panel('Policy & response', responseSummary(a))}
      </div>
    </div>`;
}

function graphPanel(a,environmentEntities){const critical=environmentEntities.filter(x=>Number(x.criticality)>=3).length,owned=environmentEntities.filter(x=>x.owner).length;return `<div class="topology-stats"><span><strong>${environmentEntities.length}</strong> persistent entities</span><span><strong>${critical}</strong> critical assets</span><span><strong>${owned}</strong> ownership mappings</span></div><div class="graph-toolbar"><label class="field"><span>Find entity</span><input id="graph-search" class="input" type="search" value="${esc(store.state.graphQuery)}" placeholder="Account, device, IP or asset"></label><div class="btn-row" aria-label="Graph zoom"><button class="btn btn--secondary" type="button" data-graph-zoom="out" aria-label="Zoom graph out">−</button><span class="zoom-value">${Math.round(store.state.graphZoom*100)}%</span><button class="btn btn--secondary" type="button" data-graph-zoom="in" aria-label="Zoom graph in">+</button><button class="btn btn--secondary" type="button" data-graph-zoom="reset">Reset</button></div></div><div id="attack-graph" class="graph-host"></div><p class="text-muted">${a.graphEdges.length} incident relationships over persistent topology · highlight follows replay step. Hover or focus a node for evidence metadata.</p>`;}

function threatSummary(s, a) {
  return `<div class="threat-summary">
    <div class="chip-row">${badge(a.severity, a.severity.toLowerCase())} ${badge(`${Math.round(a.confidence * 100)}% confidence`, 'info')} ${badge(a.disposition, a.detected ? 'high' : 'default')}</div>
    <h3>${a.stages.length ? esc(a.stages.at(-1).name) : 'Awaiting events'}</h3>
    <p>${a.events.length ? `Observed through ${esc(a.events.at(-1).action)}.${a.events.length < s.events.length ? ' Later events are hidden at this historical point.' : ''}` : 'No event has been observed at this historical point.'}</p>
    <p><strong>Disposition evidence:</strong> ${esc(a.dispositionReasons.join('; '))}</p>
  </div>`;
}

function attackStory(a) {
  return `<div class="story-track">${a.stages.map((x, i) => `
    <div class="story-step">
      <div class="story-step__num">${i + 1}</div>
      <div class="story-step__body">
        <small>${time(x.time)} · ${esc(x.eventId)}</small>
        <strong>${esc(x.name)}</strong>
        ${badge(x.label, x.label.toLowerCase())}<small>${esc(x.interpretation)} · event risk contribution +${x.riskContribution} · ${esc(x.entities.join(', '))}</small>
      </div>
    </div>`).join('') || '<div class="empty-state"><p>No stages yet.</p></div>'}</div>`;
}

function replayControls(s, step) {
  return `<div class="replay-bar">
    <button type="button" class="btn btn--primary" data-action="${['telemetry','wazuh','live'].includes(s.id)?'replay-history':'start'}">▶ Replay</button>
    <button type="button" class="btn btn--secondary" data-action="stop">Pause</button>
    <input type="range" class="replay-bar__slider" min="0" max="${store.state.apiOnline?(store.processedSteps[s.id]||0):s.events.length}" value="${step}" id="time-range" aria-label="Threat time machine">
    <span class="replay-bar__count">${step} / ${s.events.length}</span>
  </div>
  <p class="text-muted">Showing ${step} observed event(s). ${store.state.apiOnline?`${store.processedSteps[s.id]||0} of ${s.events.length} demo events processed.`:'Local preview mode.'}</p>`;
}

function evidenceChain(a) {
  return `<div class="evidence-chain">${a.stages.map(st => `
    <div class="evidence-chain__item">
      <strong>${esc(st.name)}</strong>
      <span>← ${esc(st.eventId)}: ${esc(a.evidence.find(e=>e.id===st.eventId)?.observation||'')}</span>
      <span>Confidence ${Math.round(st.confidence*100)}%</span>
      ${badge(st.label, st.label.toLowerCase())}
    </div>`).join('') || '<div class="empty-state"><p>Awaiting evidence.</p></div>'}</div>`;
}

function uncertaintyMap(map) {
  return `<div class="uncertainty-grid">${Object.entries(map || {}).map(([k, v]) => `
    <div class="uncertainty-cell uncertainty-cell--${k.toLowerCase()}">
      <span class="uncertainty-cell__label">${k}</span>
      <p>${(v || []).map(x => esc(x)).join(', ') || '—'}</p>
    </div>`).join('')}</div>`;
}

function blastRadius(affected) {
  return `<p class="text-muted">Observed entities are separated from potentially exposed assets. Access or reachability alone does not establish compromise or data loss.</p><div class="blast-grid">${Object.entries(affected).map(([k, v]) => `
    <div class="blast-cell">
      <strong>${v.length}</strong>
      <span>${esc(k)}</span>
      <small>${esc(v.join(', ') || 'None')}</small>
    </div>`).join('')}</div>`;
}

function turningPoint(a) {
  return `<div class="detail-stack">
    <div class="detail-block"><span class="detail-block__label">Turning point</span><strong>${esc(a.turningPoint?.label || 'None yet')}</strong><p>${a.turningPoint ? `${a.turningPoint.points} risk-point change when ${a.turningPoint.eventId} is removed.` : 'Awaiting events.'}</p></div>
    <div class="detail-block"><span class="detail-block__label">Counterfactual (simulated, not observed)</span><strong>Remove turning-point event</strong><p>${a.turningPoint ? `Recomputed risk ${a.turningPoint.counterfactual.risk}/100, confidence ${Math.round(a.turningPoint.counterfactual.confidence*100)}%, detection ${a.turningPoint.counterfactual.detected?'yes':'no'}. Remaining stages: ${esc(a.turningPoint.counterfactual.stages.join(' → '))}.` : 'N/A'}</p></div>
  </div>`;
}

function gaps(g) {
  return `<div class="gap-panel"><div><strong>Known</strong><p>${(g?.known || []).map(esc).join(' · ')}</p></div><div><strong>Unknown</strong><p>${(g?.unknown || []).map(esc).join(' · ')}</p></div><div><strong>Next investigation</strong><p>${(g?.next || []).map(esc).join(' · ')}</p></div></div>`;
}

function comparisonUI(s) {
  const cmp = store.state.comparison;
  return `<select id="compare" class="input"><option value="">Compare with another incident</option>
    ${scenarios.filter(x => x.id !== s.id).map(x => `<option value="${x.id}" ${cmp === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
  </select>${cmp ? comparisonBlock(s, scenarios.find(x => x.id === cmp)) : ''}`;
}

function comparisonBlock(s, other) {
  if (!other) return '';
  const st = store.state;
  const cmp = compareIncidents(
    analyze(s, st.step, getFeedback(), {policy: st.policy, weights: st.weights}),
    analyze({...other,events:other.events.filter(e=>e.timestamp<=(s.events[st.step-1]?.timestamp||''))}, Math.min(store.processedSteps[other.id]||0,other.events.length), getFeedback(), {policy: st.policy, weights: st.weights}),
    s, other,
  );
  return `<div class="compare-grid">
    <div><strong>${cmp.incidentA}</strong><p>${cmp.stagesA.join(' → ')}</p><small>Risk ${cmp.riskA}</small></div>
    <div><strong>${cmp.incidentB}</strong><p>${cmp.stagesB.join(' → ')}</p><small>Risk ${cmp.riskB}</small></div>
  </div><p class="text-muted">Common entities: ${esc(cmp.commonEntities.join(', ') || 'none')} · Higher calculated risk: ${esc(cmp.riskier)}</p><p class="text-muted">Evidence: ${esc(cmp.differences.evidence)} · Timeline start: ${esc(cmp.differences.timeline)} · Response count: ${esc(cmp.differences.response)}</p>`;
}

function lifecycleForm(s) {
  const statuses = ['NEW', 'INVESTIGATING', 'CONTAINMENT', 'RESOLVED', 'CLOSED'];
  const ready = store.state.step === s.events.length && (!store.state.apiOnline || (store.processedSteps[s.id]||0) === s.events.length);
  return `<div class="form-row">
    <select id="status" class="input" ${ready?'':'disabled'}>${statuses.map(x => `<option ${(ready?store.state.incidentStatus:'NEW') === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <button type="button" class="btn btn--secondary" data-action="status" ${ready?'':'disabled'}>Update status</button>
  </div>
  <textarea id="note" class="input input--textarea" placeholder="Analyst investigation notes…" ${ready?'':'disabled'}>${ready?esc(store.state.note):''}</textarea>
  <button type="button" class="btn btn--secondary" data-action="note" ${ready?'':'disabled'}>Save note</button>${ready?'':'<p class="text-muted">Complete the replay to update investigation status and notes.</p>'}`;
}

function assistantPanel() {
  const chips = ['What happened?', 'Why was this detected?', 'What is the potential impact?', 'What should I investigate next?', 'Probable attack sequence?', 'Why not false positive?'];
  return `<div class="assistant">
    <div class="assistant__label">Evidence-grounded assistant</div>
    <div class="chip-row chip-row--wrap">${chips.map(q => `<button type="button" class="chip-btn" data-question="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <div class="assistant__ask">
      <input id="question" class="input" value="${esc(store.state.question)}" placeholder="Ask about this incident…">
      <button type="button" class="btn btn--primary" data-action="ask">Ask</button>
    </div>
    ${store.state.answer ? `<div class="assistant__answer" aria-live="polite"><span class="assistant__answer-label">Answer · evidence only</span><pre>${esc(store.state.answer)}</pre>${store.state.answerEvidence.length?`<div class="citation-list"><strong>Evidence citations</strong>${store.state.answerEvidence.map(x=>`<a href="#evidence-timeline">${esc(typeof x==='string'?x:(x.id||x.eventId||x.observation))}</a>`).join('')}</div>`:''}</div>` : ''}
  </div>`;
}

function whyPanels(a) {
  return `<div class="why-panel">
    <strong>Why flagged</strong>
    ${(a.contextSignals.length ? a.contextSignals : ['No multi-event pattern yet']).map(x => `<p class="why-panel__yes">✓ ${esc(x)}</p>`).join('')}
    ${(a.mlSignals || []).map(x => `<p class="why-panel__yes">✓ ${esc(x)}</p>`).join('')}
    <strong>Why may be legitimate</strong>
    ${a.legitimacy.map(x => `<p class="why-panel__no">○ ${esc(x)}</p>`).join('')}
  </div>`;
}

function responseSummary(a) {
  return `<p><strong>${esc(a.policy.decision)}</strong></p><p>${esc(a.policy.reason)}</p><p class="text-muted">Action: ${esc(a.policy.action || 'Continue monitoring')}</p>
  <button type="button" class="btn btn--ghost btn--block" data-view="governance">Open governance →</button>`;
}

function agentPanel(a) {
  const run=runInvestigation(a);
  return '<div id="investigation-agent"><p>Deterministic read-only workflow · '+run.stepsUsed+' / '+run.budget+' steps · '+run.externalQueries+' external queries · '+run.providerCalls+' provider calls</p><p><strong>Stop reason:</strong> '+esc(run.stopReason)+'</p><p><strong>Claim verification:</strong> '+(run.claims.length?run.verification.claims.filter(c=>c.supported).length+' / '+run.claims.length+' exact observations supported':'No claims; insufficient evidence')+'</p><p class="text-muted">Exact matching checks supplied observations. Malicious intent remains unverified.</p>'+run.trace.map(t=>'<details class="event-inspector"><summary>'+t.step+'. '+esc(t.tool)+'</summary><p>'+esc(t.reason)+'</p><pre>'+esc(JSON.stringify(t.result,null,2))+'</pre></details>').join('')+'</div>';
}

function externalPanel(s,a){
  const real=a.events.length&&a.events.every(e=>e.metadata.simulation===false),result=store.externalInvestigations[s.id],visible=result&&result.step===store.state.step;
  return `<p>Follow observed entities through bounded, read-only Wazuh queries. The planner can discover further related entities and stop when its budget is reached.</p><button class="btn btn--primary" data-action="external-investigation" ${real&&store.connectors?.wazuh?.configured&&!store.state.operationBusy?'':'disabled'}>Investigate external evidence</button>${!real?'<p class="text-muted">Select real-source telemetry to investigate external evidence.</p>':''}${visible?`<p><strong>Stop:</strong> ${esc(result.stopReason)} · ${result.queriesUsed} queries · ${result.evidence.length} new evidence records</p><p class="text-muted">Retrieved after the original snapshot; event timestamps are bounded by ${esc(result.asOf)}. External evidence does not automatically change risk or execute response actions.</p>${result.trace.map(t=>`<details class="event-inspector"><summary>${esc(t.tool)} · ${esc(t.entity.kind)} · ${esc(t.status)}</summary><pre>${esc(JSON.stringify(t,null,2))}</pre></details>`).join('')}<ul>${result.claims.map(c=>`<li>${esc(c.text)} [${esc(c.citations.join(', '))}]</li>`).join('')}</ul>`:''}`;
}
