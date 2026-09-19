import test from 'node:test';
import assert from 'node:assert/strict';
import {scenarios} from '../src/scenarios.js';
import {analyze, normalize, report} from '../src/engine.js';
import {renderReportPdf} from '../services/reportPdf.js';

test('explicit disposition separates likely threats from legitimate activity', () => {
  const attack = analyze(scenarios[0]);
  const routine = analyze(scenarios[2], 1);
  assert.equal(attack.disposition, 'Likely threat');
  assert.ok(attack.dispositionReasons.some(x => x.includes('correlated sequence')));
  assert.equal(routine.detected, false);
  assert.equal(routine.disposition, 'Likely legitimate');
  assert.ok(routine.legitimacy.some(x => x.includes('Normal activity')));
});

test('response choice follows threat nature and learning is reportable', () => {
  const transfer = analyze(scenarios[2]);
  const lateral = analyze(scenarios[1]);
  const learned = analyze(scenarios[2], scenarios[2].events.length, [
    {scenarioId: 'transfer', classification: 'false_positive'},
  ]);
  assert.equal(transfer.policy.action, 'block simulated source');
  assert.equal(transfer.policy.approval, true);
  assert.equal(lateral.policy.action, 'restrict simulated account');
  assert.equal(lateral.policy.approval, true);
  assert.equal(learned.feedbackImpact.falsePositives, 1);
  const data = report(scenarios[2], learned);
  assert.equal(data.disposition.classification, learned.disposition);
  assert.equal(data.learning.effectiveDetectionThreshold, learned.threshold);
  const pdf = renderReportPdf(data);
  assert.ok(pdf.includes(Buffer.from('DISPOSITION')));
  assert.ok(pdf.includes(Buffer.from('LEARNING')));
});

test('all documented telemetry families normalize for continuous monitoring', () => {
  const families = [
    ['authentication', 'auth_failure'], ['network', 'outbound_transfer'],
    ['endpoint', 'endpoint_alert'], ['server', 'internal_access'],
    ['cloud', 'cloud_alert'], ['application', 'application_alert'],
    ['firewall', 'firewall_alert'], ['identity', 'privilege_escalation'],
  ];
  for (const [sourceType, type] of families) {
    const event = normalize({id:`TEST-${sourceType}`,timestamp:'2026-09-19T10:00:00Z',type,sourceType,action:`${sourceType} test`,metadata:{simulation:true}});
    assert.equal(event.sourceType, sourceType);
  }
});


test('bounded investigations verify observations and keep future evidence hidden', async () => {
  const {runInvestigation,verifyClaims}=await import('../services/investigationAgent.js');
  for(const scenario of scenarios)for(let step=0;step<=scenario.events.length;step++){
    const analysis=analyze(scenario,step),before=JSON.stringify(analysis),run=runInvestigation(analysis);
    assert.equal(JSON.stringify(analysis),before);
    assert.equal(run.stepsUsed,step?5:0);
    assert.equal(run.claims.length,step);
    assert.equal(run.verification.accepted,Boolean(step));
    assert.ok(run.claims.every(c=>c.citations.every(id=>analysis.events.some(e=>e.id===id))));
    assert.equal(run.externalQueries,0);
    if(step){const short=runInvestigation(analysis,{maxSteps:2});assert.equal(short.stepsUsed,2);assert.equal(short.stopReason,'step-budget-exhausted');}
  }
  const evidence=[{eventId:'a',observation:'Login failed'},{eventId:'b',observation:'Login succeeded'}];
  for(const citations of [['missing'],['a','b'],[]])assert.equal(verifyClaims([{text:'Login failed',citations}],evidence).accepted,false);
  assert.equal(verifyClaims([{text:'Login succeeded',citations:['a']}],evidence).accepted,false);
  assert.equal(verifyClaims([null],evidence).accepted,false);
});

test('mandatory description is preserved in documentation and the application',async()=>{
  const {readFileSync}=await import('node:fs');
  const {mandatoryRequirements,projectTitle}=await import('../src/requirements.js');
  const {requirementsView}=await import('../src/ui/views/requirements.js');
  const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8'),view=requirementsView();
  assert.ok(readme.includes(projectTitle));
  assert.equal(mandatoryRequirements.flatMap(x=>x.items).length,16);
  for(const section of mandatoryRequirements)for(const item of section.items){assert.ok(readme.includes(item));assert.ok(view.includes(item));}
});

test('graph traversal follows evidence associations and preserves disconnected nodes',async()=>{
  const {traverseObservedGraph}=await import('../services/graphTraversal.js');
  const result=traverseObservedGraph([{id:'a'},{id:'b'},{id:'c'}],[{from:'a',to:'b',eventId:'e1'}],['a']);
  assert.deepEqual(result.nodes.map(n=>n.id),['a','b']);assert.deepEqual(result.nodes[1].evidence,['e1']);assert.match(result.basis,/not proof/);
  const a=analyze(scenarios[0]);assert.ok(a.stages.every(s=>s.entities.length&&Number.isFinite(s.riskContribution)&&s.interpretation.includes('observed telemetry')));
});
