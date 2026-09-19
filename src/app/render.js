import {operationsView} from '../ui/views/operations.js';
import {esc} from '../lib/utils.js';
import {renderShell, pageHeader} from '../ui/components/shell.js';
import {overviewView} from '../ui/views/overview.js';
import {investigateView} from '../ui/views/investigate.js';
import {intelligenceView} from '../ui/views/intelligence.js';
import {governanceView} from '../ui/views/governance.js';
import {adminView} from '../ui/views/admin.js';
import {requirementsView} from '../ui/views/requirements.js';
import {evaluationView} from '../ui/views/evaluation.js';
import {renderAttackGraph} from '../graph.js';
import {getDashboardContext} from './context.js';
import {scenarios} from '../scenarios.js';
import {store} from './state.js';
import {handleAction, stopReplay, setStep, askQuestion, submitFeedback, loadScenarioState} from './actions.js';

const TITLES = {
  operations: 'Integrations & model deployment',
  overview: 'Security command center',
  investigate: 'Incident investigation workspace',
  intelligence: 'Proactive security intelligence',
  governance: 'Response governance & audit',
  admin: 'Policy & risk configuration',
  requirements: 'Mandatory project requirements',
  evaluation: 'Jury evaluation scorecard',
};

const SUBTITLES = {
  operations: 'Real telemetry, read-only investigation, and evaluated detection models.',
  overview: 'Real-time posture, incident priority, and analyst attention across your security operations.',
  investigate: 'Story-centric investigation with evidence, attack graph, replay, and AI-assisted analysis.',
  intelligence: 'Patterns, trends, feedback-driven improvement, and proactive risk watchlist.',
  governance: 'Policy-controlled autonomous response with human approval and complete audit trail.',
  admin: 'Configure risk weights, policy thresholds, and response authorization rules.',
  requirements: 'AI Powered Autonomous Cybersecurity & Incident Investigation',
  evaluation: 'Human and AI jury criteria mapped to verifiable evidence, tests, and documentation.',
};

export function renderApp(root) {
  const ctx = getDashboardContext();
  const {s, state} = {s: ctx.s, state: store.state};
  const pol = state.policy;

  const headerActions = `
    <button type="button" class="btn btn--secondary" data-action="export-pdf">PDF</button>
    <button type="button" class="btn btn--secondary" data-action="export-csv">CSV</button>
    <button type="button" class="btn btn--secondary" data-action="export">JSON</button>
    <button type="button" class="btn btn--primary" data-action="${['telemetry','wazuh','live'].includes(s.id)?'replay-history':'start'}">▶ ${['telemetry','wazuh','live'].includes(s.id)?'Replay observed telemetry':state.step ? 'Replay attack' : 'Start simulation'}</button>`;

  const realTelemetry=['telemetry','wazuh'].includes(s.id);
  const banner = realTelemetry?'<strong>Real telemetry · simulated response</strong> — Evidence comes from an authenticated source. All containment actions remain simulated.': `<strong>Simulation / demo mode</strong> — All events and response actions on this screen are simulated. No production security system is connected.`;

  let viewHtml = '';
  if (state.view === 'overview') viewHtml = overviewView(ctx);
  else if (state.view === 'investigate') viewHtml = investigateView(ctx);
  else if (state.view === 'intelligence') viewHtml = intelligenceView(ctx);
  else if (state.view === 'governance') viewHtml = governanceView(ctx);
  else if (state.view === 'admin') viewHtml = adminView();
  else if (state.view === 'operations') viewHtml = operationsView();
  else if (state.view === 'requirements') viewHtml = requirementsView();
  else if (state.view === 'evaluation') viewHtml = evaluationView();

  document.documentElement.dataset.theme = state.theme === 'dark' ? 'dark' : '';

  root.innerHTML = renderShell({
    state,
    scenarios,
    scenario: s,
    pageHeader: pageHeader({
      incidentId: s.incidentId,
      title: TITLES[state.view] || TITLES.overview,
      subtitle: SUBTITLES[state.view] || SUBTITLES.overview,
      actions: headerActions,
      banner,
    }),
    content: `${state.uiError ? `<div class="alert-banner" role="alert"><strong>Action failed:</strong> ${esc(state.uiError)}</div>` : ''}${state.uiNotice ? `<div class="alert-banner" role="status">${esc(state.uiNotice)}</div>` : ''}${viewHtml}`,
  });

  bindEvents(root, () => renderApp(root));

  if (state.view === 'investigate') {
    const g = root.querySelector('#attack-graph');
    if (g) {const existing=new Set(ctx.a.graphNodes.map(n=>n.id)),environment=(ctx.environmentEntities||[]).filter(x=>!existing.has(`${x.kind}:${x.value}`)).map(x=>({id:`${x.kind}:${x.value}`,kind:x.kind,label:x.value,meta:{timestamp:x.last_seen||x.lastSeen,evidence:[],confidence:0,risk:Number(x.criticality||0),relationship:`persistent topology${x.owner?`; owner ${x.owner}`:''}`}})),incidentEdges=new Set(ctx.a.graphEdges.map(e=>`${e.from}|${e.to}|${e.relationship}`)),topologyEdges=(ctx.topology?.relationships||[]).map(x=>({from:`${x.sourceKind}:${x.sourceValue}`,to:`${x.targetKind}:${x.targetValue}`,eventId:x.evidenceIds?.at(-1),relationship:x.relationship,timestamp:x.lastSeen,confidence:0})).filter(e=>!incidentEdges.has(`${e.from}|${e.to}|${e.relationship}`));renderAttackGraph(g,[...ctx.a.graphNodes,...environment],[...ctx.a.graphEdges,...topologyEdges],new Set(ctx.currentId?[ctx.currentId]:[]),{query:state.graphQuery,zoom:state.graphZoom});}
  }
}

function bindEvents(root, render) {
  root.querySelectorAll('[data-view]').forEach(el => {
    el.onclick = () => { store.state.view = el.dataset.view; render(); };
  });
  root.querySelectorAll('[data-scenario]').forEach(el => {
    el.onclick = () => loadScenarioState(el.dataset.scenario, render);
  });
  root.querySelectorAll('[data-action]').forEach(el => {
    el.onclick = () => handleAction(el.dataset.action, root, render);
  });
  root.querySelector('#time-range')?.addEventListener('input', e => {
    stopReplay(render);
    setStep(Number(e.target.value), render);
  });
  root.querySelectorAll('[data-question]').forEach(el => {
    el.onclick = () => { root.querySelector('#question').value=el.dataset.question; askQuestion(root, render); };
  });
  root.querySelector('#question')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') askQuestion(root, render);
  });
  root.querySelector('#compare')?.addEventListener('change', e => {
    store.state.comparison = e.target.value;
    render();
  });
  root.querySelector('#graph-search')?.addEventListener('input', e => {store.state.graphQuery=e.target.value;render();});
  root.querySelectorAll('[data-graph-zoom]').forEach(el=>{el.onclick=()=>{const mode=el.dataset.graphZoom;store.state.graphZoom=mode==='reset'?1:Math.max(.6,Math.min(2,store.state.graphZoom+(mode==='in' ? .2 : -.2)));render();};});
  root.querySelectorAll('[data-feedback]').forEach(el => {
    el.onclick = () => submitFeedback(root, el.dataset.feedback, render);
  });
}

export function showBootError(root, err) {
  root.innerHTML = `<div class="boot-error"><h1>SENTINEL-X failed to start</h1><p>${esc(err.message)}</p><p>Run <code>npm start</code> in the project folder, then open <a href="http://localhost:4173">http://localhost:4173</a></p></div>`;
}
