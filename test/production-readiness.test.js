import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomInt,randomUUID} from 'node:crypto';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {existsSync,unlinkSync} from 'node:fs';

test('hardened service exposes readiness, metrics, headers, tracing and rate limits',async t=>{
  const port=randomInt(35001,42000),db=join(tmpdir(),`sentinel-prod-${randomUUID()}.db`);
  const child=spawn(process.execPath,['server.js'],{cwd:resolve('.'),env:{...process.env,PORT:String(port),SENTINEL_X_DB_PATH:db,SENTINEL_X_RATE_LIMIT:'10'},stdio:'ignore'});
  t.after(()=>{child.kill();for(const suffix of ['','-wal','-shm'])if(existsSync(db+suffix))try{unlinkSync(db+suffix);}catch{}});
  const base=`http://127.0.0.1:${port}`;
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/api/ready')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
  const page=await fetch(base+'/',{headers:{'X-Request-Id':'prod-test-request'}});
  assert.equal(page.headers.get('x-request-id'),'prod-test-request');
  assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.equal(page.headers.get('permissions-policy'),'camera=(), microphone=(), geolocation=()');
  const readiness=await(await fetch(base+'/api/ready')).json();assert.equal(readiness.database,true);
  for(let i=0;i<10;i++)assert.equal((await fetch(base+'/api/policy',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  const limited=await fetch(base+'/api/policy',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>=1);
  const metrics=await(await fetch(base+'/api/metrics')).text();assert.match(metrics,/sentinel_x_http_requests_total/);assert.match(metrics,/sentinel_x_http_rate_limited_total 1/);
});

test('trusted proxy authentication enforces identity, tenant and roles',async t=>{
  const port=randomInt(42001,49000),db=join(tmpdir(),`sentinel-auth-${randomUUID()}.db`),secret=`proxy-${randomUUID()}`;
  const child=spawn(process.execPath,['server.js'],{cwd:resolve('.'),env:{...process.env,PORT:String(port),SENTINEL_X_DB_PATH:db,SENTINEL_X_AUTH_MODE:'proxy',SENTINEL_X_PROXY_SECRET:secret},stdio:'ignore'});
  t.after(()=>{child.kill();for(const suffix of ['','-wal','-shm'])if(existsSync(db+suffix))try{unlinkSync(db+suffix);}catch{}});
  const base=`http://127.0.0.1:${port}`;
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/api/ready')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
  assert.equal((await fetch(base+'/api/health')).status,200);
  assert.equal((await fetch(base+'/api/scenarios')).status,401);
  const headers=role=>({'X-Sentinel-Proxy-Secret':secret,'X-Sentinel-Role':role,'X-Sentinel-User':`${role}@example.test`,'X-Sentinel-Tenant':'default'});
  assert.equal((await fetch(base+'/api/scenarios',{headers:headers('viewer')})).status,200);
  const sessionResponse=await fetch(base+'/api/session',{headers:headers('viewer')});
  assert.equal(sessionResponse.status,200);
  const session=await sessionResponse.json();
  assert.equal(session.authentication,'proxy');assert.equal(session.role,'viewer');assert.equal(session.actor,'viewer@example.test');
  assert.equal((await fetch(base+'/api/policy',{method:'PUT',headers:{...headers('viewer'),'Content-Type':'application/json','X-Sentinel-Demo-Token':session.token},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/api/policy',{method:'PUT',headers:{...headers('admin'),'Content-Type':'application/json','X-Sentinel-Demo-Token':session.token},body:'{}'})).status,200);
  assert.equal((await fetch(base+'/api/scenarios',{headers:{...headers('viewer'),'X-Sentinel-Tenant':'other'}})).status,403);
  assert.equal((await fetch(base+'/api/scenarios',{headers:{...headers('viewer'),'X-Sentinel-Proxy-Secret':'wrong'}})).status,401);
});
