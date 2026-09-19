import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {randomInt,randomUUID} from 'node:crypto';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {normalizeTelemetry} from '../services/telemetry.js';
import {trustedEndpoint} from '../services/externalHttp.js';
import {trainingFixture} from '../evaluation/trainingFixture.js';
import {trainCandidate} from '../services/modelTraining.js';
import {IsolationForest} from '../services/isolationForest.js';
import {investigateExternalEvidence} from '../services/externalInvestigation.js';
import {investigateWithGrounding} from '../services/llmInvestigation.js';
import {analyze,setModelArtifact} from '../src/engine.js';
import {scenarios} from '../src/scenarios.js';

test('external agent discovers related entities, enforces budgets and rejects future evidence',async()=>{
  const seed=normalizeTelemetry(sampleEvent()),earlier={...seed,id:'related',account:'discovered',timestamp:new Date(Date.parse(seed.timestamp)-1000).toISOString()};
  const analysis={events:[seed]},queries=[];
  const result=await investigateExternalEvidence(analysis,{maxQueries:2,query:async q=>{queries.push(q);return {events:[earlier,{...earlier,id:'future',timestamp:new Date(Date.parse(seed.timestamp)+1000).toISOString()}],hasMore:false};}});
  assert.equal(result.queriesUsed,2);assert.equal(result.stopReason,'query-budget-exhausted');assert.deepEqual(result.evidence.map(e=>e.id),['related']);assert.equal(result.verification.accepted,true);assert.equal(queries[0].until,seed.timestamp);assert.deepEqual(result.responseActions,[]);
  await assert.rejects(()=>investigateExternalEvidence({events:scenarios[0].events}),/real-source/);
  const failed=await investigateExternalEvidence(analysis,{query:async()=>{throw Error('Upstream secret must not escape');}});assert.equal(failed.stopReason,'external-query-failed');assert.ok(!JSON.stringify(failed).includes('secret'));
});

test('Gemini uses structured evidence, server-side auth and verified response fallback',async t=>{
  let unsupported=false,calls=0;
  const vendor=createServer((req,res)=>{let raw='';req.on('data',x=>raw+=x);req.on('end',()=>{calls++;assert.equal(req.headers['x-goog-api-key'],'fixture-secret');assert.equal(req.url,'/v1beta/models/gemini-test:generateContent');const body=JSON.parse(raw);assert.equal(body.generationConfig.responseMimeType,'application/json');const evidence=JSON.parse(body.contents[0].parts[0].text).evidence;assert.ok(evidence.every(e=>!('raw'in e)));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({claims:[{text:unsupported?'Invented compromise':evidence[0].observation,citations:[evidence[0].eventId]}]})}]}}]}));});});
  await new Promise(r=>vendor.listen(0,'127.0.0.1',r));t.after(()=>vendor.close());
  const keys=['SENTINEL_X_GEMINI_API_KEY','SENTINEL_X_GEMINI_MODEL','SENTINEL_X_GEMINI_BASE_URL'],prior=keys.map(k=>process.env[k]);t.after(()=>keys.forEach((k,i)=>prior[i]===undefined?delete process.env[k]:process.env[k]=prior[i]));
  process.env.SENTINEL_X_GEMINI_API_KEY='fixture-secret';process.env.SENTINEL_X_GEMINI_MODEL='gemini-test';process.env.SENTINEL_X_GEMINI_BASE_URL=`http://127.0.0.1:${vendor.address().port}`;
  const a=analyze(scenarios[0]);assert.equal((await investigateWithGrounding('What happened?',a,scenarios[0])).provider,'gemini');unsupported=true;assert.equal((await investigateWithGrounding('What happened?',a,scenarios[0])).provider,'deterministic-fallback');assert.equal(calls,2);
});

test('model artifacts reproduce scores and reject training/evaluation overlap',()=>{
  const input=trainingFixture(),one=trainCandidate(input),two=trainCandidate(input);assert.equal(one.checksum,two.checksum);assert.equal(one.metrics.eligible,true);
  const model=IsolationForest.fromJSON(one.artifact.forest);assert.equal(model.score([0,0,.5,0,0,0]),IsolationForest.fromJSON(two.artifact.forest).score([0,0,.5,0,0,0]));
  input.evaluationEvents[0].event.id=input.trainingEvents[0].id;assert.throws(()=>trainCandidate(input),/disjoint/);
});

test('identically named tenant models do not share an inference cache',()=>{
  const first=trainCandidate(trainingFixture('same-model'));
  const input=trainingFixture('same-model');for(const e of [...input.trainingEvents,...input.evaluationEvents.filter(x=>!x.anomaly).map(x=>x.event)]){e.device='Endpoint-07';e.ip='198.51.100.42';}
  const second=trainCandidate(input);
  try{setModelArtifact(first.artifact);const a=analyze(scenarios[0],2);setModelArtifact(second.artifact);const b=analyze(scenarios[0],2);assert.notEqual(a.events[1].mlScore,b.events[1].mlScore);}finally{setModelArtifact(null);}
});

test('training promotion changes actual inference and rollback restores it',async t=>{
  let server=await app(t);await server.post('/api/simulate/account/step',{step:1});
  const before=await(await server.get('/api/analyze/account')).json();
  const response=await server.post('/api/model-ops/train',trainingFixture());assert.equal(response.status,201,JSON.stringify(await response.clone().json()));
  const ops=await response.json();assert.equal(ops.activeVersion,'iforest-demo-v1');assert.equal(ops.versions.find(v=>v.version==='lab-model-v1').metrics.eligible,true);
  assert.equal((await server.post('/api/model-ops/promote',{version:'lab-model-v1'})).status,200);
  const after=await(await server.get('/api/analyze/account')).json();assert.equal(after.analysis.modelVersion,'lab-model-v1');assert.notEqual(before.analysis.events[0].mlScore,after.analysis.events[0].mlScore);
  assert.equal((await(await server.get('/api/model-ops/deployed')).json()).version,'lab-model-v1');
  const db=server.db,exit=once(server.child,'exit');server.child.kill();await exit;
  server=await app(t,{SENTINEL_X_DB_PATH:db});
  const restarted=await(await server.get('/api/analyze/account')).json();assert.equal(restarted.analysis.modelVersion,'lab-model-v1');assert.equal(restarted.analysis.events[0].mlScore,after.analysis.events[0].mlScore);
  assert.equal((await server.post('/api/model-ops/rollback',{})).status,200);
  const rolled=await(await server.get('/api/analyze/account')).json();assert.equal(rolled.analysis.modelVersion,'iforest-demo-v1');assert.equal(rolled.analysis.events[0].mlScore,before.analysis.events[0].mlScore);
});

export async function app(t,env={}){
  const port=randomInt(55001,61000),db=env.SENTINEL_X_DB_PATH||join(tmpdir(),`sentinel-live-${randomUUID()}.db`);
  const child=spawn(process.execPath,['server.js'],{cwd:resolve('.'),env:{...process.env,PORT:String(port),SENTINEL_X_DB_PATH:db,...env},stdio:'ignore'});
  t.after(()=>child.kill());const base=`http://127.0.0.1:${port}`;
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/ready')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,75));}assert.ok(ready,'Server must start');
  const session=await(await fetch(base+'/api/session')).json();
  return {base,db,child,get:path=>fetch(base+path),post:(path,body,extra={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-Sentinel-Demo-Token':session.token,...extra},body:JSON.stringify(body)})};
}
export const sampleEvent=(id='real-1')=>({event_id:id,timestamp:new Date().toISOString(),event_type:'authentication_failure',source_type:'authentication',user_id:'lab-user',device_id:'lab-endpoint',source_ip:'192.0.2.10',action:'Failed authentication',severity:'critical',normalized:{failures:27},raw_data:{password:'never-store-me'}});

test('real telemetry validates fields and ignores untrusted risk/severity',()=>{
  const e=normalizeTelemetry({...sampleEvent(),risk:100});assert.equal(e.metadata.simulation,false);assert.equal(e.severity,'medium');assert.equal(e.metadata.sourceSeverity,'critical');assert.equal(e.raw.password,'[REDACTED]');
  for(const patch of [{event_id:{}},{timestamp:'yesterday'},{normalized:{bytes:-1}},{source_type:'unknown'},{event_type:'toString'},{action:'\u0000'}])assert.throws(()=>normalizeTelemetry({...sampleEvent(),...patch}));
  assert.throws(()=>trustedEndpoint('http://external.example'));
  assert.throws(()=>trustedEndpoint('https://user:secret@example.test'));
});

test('authenticated live ingestion is idempotent and retains report provenance',async t=>{
  const token=randomUUID(),server=await app(t,{SENTINEL_X_TELEMETRY_TOKEN:token});
  assert.equal((await server.post('/api/v1/telemetry/events',sampleEvent())).status,401);
  const headers={Authorization:`Bearer ${token}`};
  assert.equal((await server.post('/api/v1/telemetry/events',sampleEvent(),headers)).status,201);
  const duplicate=await(await server.post('/api/v1/telemetry/events',sampleEvent(),headers)).json();assert.equal(duplicate.duplicate,true);
  assert.equal((await server.post('/api/v1/telemetry/events',{bad:true},headers)).status,400);
  const report=await(await server.get('/api/report/telemetry/json')).json();assert.equal(report.simulation,false);assert.equal(report.responseMode,'simulation');assert.equal(report.evidence.length,1);
  const page=await(await server.get('/api/v1/events?scenarioId=telemetry&limit=1')).json();assert.equal(page.total,1);assert.equal(page.items.length,1);
  assert.equal((await server.get('/api/v1/events?limit=10000')).status,400);
  assert.equal((await server.get('/api/v1/risk/telemetry')).status,200);
  assert.equal((await server.get('/api/v1/attack-graphs/telemetry')).status,200);
  assert.equal((await server.post('/api/simulate/telemetry/reset',{})).status,400);
});

test('historical comparison excludes later incident evidence',async t=>{
  const server=await app(t);await server.post('/api/simulate/account/step',{step:1});
  for(let step=1;step<=4;step++)await server.post('/api/simulate/lateral/step',{step});
  const comparison=await(await server.get('/api/compare?a=account&b=lateral&step=1')).json();assert.equal(comparison.riskB,0);assert.deepEqual(comparison.stagesB,[]);
});

test('Wazuh performs real HTTP reads, persists collection state and deduplicates',async t=>{
  const now=new Date().toISOString(),calls=[];
  const vendor=createServer((req,res)=>{let data='';req.on('data',chunk=>data+=chunk);req.on('end',()=>{calls.push({url:req.url,auth:req.headers.authorization,body:JSON.parse(data)});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({hits:{hits:[{_index:'wazuh-alerts-lab',_id:'1',_source:{timestamp:now,agent:{name:'host-one'},rule:{groups:['authentication_failed'],level:10,description:'Failed SSH login'},data:{srcuser:'alice',srcip:'192.0.2.2'}}}]}}));});});
  await new Promise(r=>vendor.listen(0,'127.0.0.1',r));t.after(()=>vendor.close());
  const server=await app(t,{SENTINEL_X_WAZUH_URL:`http://127.0.0.1:${vendor.address().port}`,SENTINEL_X_WAZUH_USER:'readonly',SENTINEL_X_WAZUH_PASSWORD:'test-only'});
  const response=await server.post('/api/connectors/wazuh/poll',{});assert.equal(response.status,200);assert.equal((await response.json()).imported,1);
  const repeated=await(await server.post('/api/connectors/wazuh/poll',{})).json();assert.equal(repeated.imported,0);assert.equal(repeated.duplicates,1);
  assert.equal(calls.length,2);assert.equal(calls[0].url,'/wazuh-alerts-*/_search');assert.match(calls[0].auth,/^Basic /);assert.ok(calls[0].body.query.bool.filter[0].range.timestamp.lte);
  const rows=await(await server.get('/api/events/wazuh')).json();assert.equal(rows.length,1);assert.equal(rows[0].metadata.simulation,false);
  const investigation=await server.post('/api/investigations/external',{scenarioId:'wazuh',step:1,maxQueries:1});assert.equal(investigation.status,201);assert.equal((await investigation.json()).queriesUsed,1);
  const savedRuns=await(await server.get('/api/investigations/wazuh')).json();assert.equal(savedRuns.length,1);assert.equal(savedRuns[0].mode,'external-read-only');
  const status=await(await server.get('/api/connectors')).json();assert.equal(status.wazuh.status,'connected');assert.ok(status.wazuh.checkpoint);assert.ok(!JSON.stringify(status).includes('test-only'));
});

test('configured organizations isolate events, incidents, reports, models and permissions',async t=>{
  const secret=randomUUID(),server=await app(t,{SENTINEL_X_AUTH_MODE:'proxy',SENTINEL_X_PROXY_SECRET:secret,SENTINEL_X_TENANTS:'org-a,org-b'});
  const headers=(tenant,role='admin')=>({'X-Sentinel-Proxy-Secret':secret,'X-Sentinel-Tenant':tenant,'X-Sentinel-User':role+'@'+tenant,'X-Sentinel-Role':role,'Content-Type':'application/json'});
  const tokens={};for(const tenant of ['org-a','org-b'])tokens[tenant]=(await(await fetch(server.base+'/api/session',{headers:headers(tenant)})).json()).token;
  const get=(tenant,path)=>fetch(server.base+path,{headers:headers(tenant)});
  const post=(tenant,path,body,role='admin')=>fetch(server.base+path,{method:'POST',headers:{...headers(tenant,role),'X-Sentinel-Demo-Token':tokens[tenant]},body:JSON.stringify(body)});
  assert.equal((await post('org-a','/api/simulate/account/step',{step:1})).status,200);
  assert.equal((await(await get('org-b','/api/events/account')).json()).length,0);
  assert.equal((await post('org-b','/api/simulate/account/step',{step:1})).status,200);
  assert.equal((await(await get('org-a','/api/events/account')).json()).length,1);
  const policyA=await(await get('org-a','/api/policy')).json(),policyB=await(await get('org-b','/api/policy')).json();assert.notEqual(policyA.id,policyB.id);
  assert.equal((await post('org-a','/api/model-ops/train',trainingFixture('org-a-model'),'viewer')).status,403);
  assert.equal((await post('org-a','/api/model-ops/train',trainingFixture('org-a-model'))).status,201);
  assert.ok(!(await(await get('org-b','/api/model-ops')).json()).versions.some(x=>x.version==='org-a-model'));
  assert.equal((await post('org-b','/api/model-ops/promote',{version:'org-a-model'})).status,400);
  assert.equal((await post('org-b','/api/connectors/wazuh/poll',{})).status,403);
  await post('org-a','/api/simulate/account/reset',{});
  assert.equal((await(await get('org-a','/api/report/account/json')).json()).evidence.length,0);
  assert.equal((await(await get('org-b','/api/report/account/json')).json()).evidence.length,1);
  assert.equal((await fetch(server.base+'/api/scenarios',{headers:headers('unconfigured')})).status,403);
});

test('local sessions hash credentials, rotate refresh tokens and reject token reuse',async t=>{
  const server=await app(t,{SENTINEL_X_AUTH_MODE:'local'});
  const created=spawnSync(process.execPath,['scripts/create-user.js','default','local-analyst','analyst'],{cwd:resolve('.'),env:{...process.env,SENTINEL_X_DB_PATH:server.db,SENTINEL_X_NEW_USER_PASSWORD:'test-password-long-enough'},encoding:'utf8'});assert.equal(created.status,0,created.stderr);
  const login=body=>server.post('/api/v1/auth/login',body);
  assert.equal((await login({username:'local-analyst',password:'incorrect'})).status,401);
  const response=await login({username:'local-analyst',password:'test-password-long-enough'});assert.equal(response.status,200);
  const setCookies=response.headers.getSetCookie();assert.ok(setCookies.every(x=>x.includes('HttpOnly')&&x.includes('SameSite=Strict')));
  const cookies=setCookies.map(x=>x.split(';')[0]).join('; ');
  const principal=await(await fetch(server.base+'/api/session',{headers:{Cookie:cookies}})).json();assert.equal(principal.actor,'local-analyst');assert.equal(principal.role,'analyst');
  const refresh=await server.post('/api/v1/auth/refresh',{}, {Cookie:cookies});assert.equal(refresh.status,200);
  const nextCookies=refresh.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');assert.notEqual(nextCookies,cookies);
  assert.equal((await fetch(server.base+'/api/session',{headers:{Cookie:cookies}})).status,401);
  assert.equal((await server.post('/api/v1/auth/refresh',{}, {Cookie:cookies})).status,401);
  assert.equal((await fetch(server.base+'/api/session',{headers:{Cookie:nextCookies}})).status,401);
  assert.equal((await server.post('/api/v1/auth/login',{username:'local-analyst',password:'test-password-long-enough'},{Origin:'https://hostile.example'})).status,403);
});
