import {scenarios} from '../scenarios.js';
import {analyze, securityBriefing, triageCount, highRiskAssets} from '../engine.js';
import {store} from './state.js';

export function getScenario() {
  return scenarios.find(s => s.id === store.state.scenarioId) || scenarios[0];
}

export function getFeedback() {
  return store.feedback;
}

export function getAnalysis(step = store.state.step) {
  const s = getScenario();
  const runId = store.runIds[s.id] || 0;
  const feedback = getFeedback().filter(f => f.scenarioId === s.id && (step === s.events.length || (f.runId||0) < runId));
  return analyze(s, step, feedback, {policy: store.state.policy, weights: store.state.weights});
}

export function getAllAnalyses() {
  return scenarios.map(s => {
    const observed = Math.min(store.processedSteps[s.id]||0,s.events.length),runId=store.runIds[s.id]||0;
    const feedback=getFeedback().filter(f=>f.scenarioId===s.id&&(observed===s.events.length||(f.runId||0)<runId));
    return analyze(s,observed,feedback,{policy:store.state.policy,weights:store.state.weights});
  });
}

export function getDashboardContext() {
  const active = getAllAnalyses();
  const a = getAnalysis();
  const s = getScenario();
  const currentIndex = scenarios.findIndex(x => x.id === s.id);
  active[currentIndex] = a;
  const visibleApproval = x => x.scenarioId !== s.id || (x.step === null ? store.state.step === s.events.length : x.step <= store.state.step);
  const pending = a.policy.approval && !store.actions.some(x => x.scenarioId === s.id && x.status === 'approved' && visibleApproval(x));
  const pendingCount = active.filter((analysis,index)=>analysis.policy.approval&&!store.actions.some(x=>x.scenarioId===scenarios[index].id&&x.action===analysis.policy.action&&x.status==='approved'&&visibleApproval(x))).length;
  const briefing = securityBriefing(active, pendingCount);
  const currentId = store.state.step && a.events.length ? a.events.at(-1)?.id : null;
  const cutoff=a.events.at(-1)?.timestamp;
  const visibleAtTime=x=>cutoff&&(x.last_seen||x.lastSeen)<=cutoff;
  const historicalTopology={entities:store.topology.entities.filter(visibleAtTime),relationships:store.topology.relationships.filter(visibleAtTime)};
  return {scenarios, active, a, s, pending, pendingCount, briefing, currentId, assets: highRiskAssets(active), triaged: triageCount(active), environmentEntities: historicalTopology.entities.length?historicalTopology.entities:store.environmentEntities.filter(visibleAtTime), topology:historicalTopology, modelOps:store.modelOps, aiStatus:store.aiStatus};
}
