import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

const dbPath = process.env.SENTINEL_X_DB_PATH || resolve(dirname(fileURLToPath(import.meta.url)), '../data/sentinel-x.db');
mkdirSync(dirname(dbPath), {recursive: true});

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'professional',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scenario_id TEXT,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scenario_id TEXT,
  incident_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW',
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scenario_id TEXT,
  type TEXT NOT NULL,
  detail TEXT NOT NULL,
  actor TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  simulation INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  classification TEXT NOT NULL,
  reason TEXT,
  analyst TEXT NOT NULL,
  timestamp TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS response_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  policy_id TEXT,
  actor TEXT NOT NULL,
  result TEXT,
  timestamp TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'simulation',
  critical_risk INTEGER NOT NULL DEFAULT 75,
  min_confidence REAL NOT NULL DEFAULT 0.8,
  allowed_actions TEXT NOT NULL,
  approval_required TEXT NOT NULL,
  audit_required INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS risk_weights (
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  points INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, event_type)
);
CREATE TABLE IF NOT EXISTS subscriptions (
  tenant_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE IF NOT EXISTS entities (
  tenant_id TEXT NOT NULL, kind TEXT NOT NULL, value TEXT NOT NULL,
  first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
  PRIMARY KEY (tenant_id, kind, value)
);
CREATE TABLE IF NOT EXISTS event_entities (
  tenant_id TEXT NOT NULL, event_id TEXT NOT NULL, kind TEXT NOT NULL, value TEXT NOT NULL,
  PRIMARY KEY (tenant_id, event_id, kind, value)
);
CREATE TABLE IF NOT EXISTS analysis_snapshots (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, scenario_id TEXT NOT NULL,
  observed_at TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS simulated_controls (
  tenant_id TEXT NOT NULL, scenario_id TEXT NOT NULL, action TEXT NOT NULL,
  target TEXT NOT NULL, state TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id,scenario_id,action,target)
);
CREATE TABLE IF NOT EXISTS replay_runs (
  tenant_id TEXT NOT NULL, scenario_id TEXT NOT NULL, run_id INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL, PRIMARY KEY (tenant_id, scenario_id)
);
CREATE TABLE IF NOT EXISTS topology_entities (
  tenant_id TEXT NOT NULL, kind TEXT NOT NULL, value TEXT NOT NULL,
  owner TEXT, criticality INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL DEFAULT 'telemetry',
  first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
  PRIMARY KEY (tenant_id,kind,value)
);
CREATE TABLE IF NOT EXISTS topology_relationships (
  tenant_id TEXT NOT NULL, source_kind TEXT NOT NULL, source_value TEXT NOT NULL,
  target_kind TEXT NOT NULL, target_value TEXT NOT NULL, relationship TEXT NOT NULL,
  first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, evidence_ids TEXT NOT NULL,
  PRIMARY KEY (tenant_id,source_kind,source_value,target_kind,target_value,relationship)
);
CREATE TABLE IF NOT EXISTS model_versions (
  tenant_id TEXT NOT NULL, version TEXT NOT NULL, status TEXT NOT NULL,
  algorithm TEXT NOT NULL, metrics TEXT NOT NULL, created_at TEXT NOT NULL,
  promoted_at TEXT, parent_version TEXT, PRIMARY KEY (tenant_id,version)
);
CREATE TABLE IF NOT EXISTS model_drift (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, model_version TEXT NOT NULL,
  measured_at TEXT NOT NULL, sample_count INTEGER NOT NULL, score REAL NOT NULL,
  status TEXT NOT NULL, details TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, connector TEXT NOT NULL,
  payload TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS response_rollbacks (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, scenario_id TEXT NOT NULL,
  action TEXT NOT NULL, target TEXT NOT NULL, actor TEXT NOT NULL,
  reason TEXT NOT NULL, result TEXT NOT NULL, timestamp TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS connector_state (
  tenant_id TEXT NOT NULL, connector TEXT NOT NULL, payload TEXT NOT NULL,
  PRIMARY KEY (tenant_id,connector)
);
CREATE TABLE IF NOT EXISTS external_investigations (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, scenario_id TEXT NOT NULL,
  created_at TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS model_artifacts (
  tenant_id TEXT NOT NULL, version TEXT NOT NULL, payload TEXT NOT NULL,
  checksum TEXT NOT NULL, PRIMARY KEY (tenant_id,version)
);
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
`);
if(!db.prepare('SELECT 1 FROM schema_migrations WHERE version=1').get()){
  db.exec('BEGIN IMMEDIATE');try{
    db.exec('CREATE INDEX IF NOT EXISTS events_tenant_scenario_time ON events(tenant_id,scenario_id,timestamp); CREATE INDEX IF NOT EXISTS audit_tenant_time ON audit_log(tenant_id,timestamp); CREATE INDEX IF NOT EXISTS jobs_tenant_status ON ingestion_jobs(tenant_id,status,updated_at);');
    db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(1,new Date().toISOString());db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
}
if (!db.prepare('PRAGMA table_info(response_actions)').all().some(c=>c.name==='step')) db.exec('ALTER TABLE response_actions ADD COLUMN step INTEGER');
for(const [name,type] of [['risk','INTEGER'],['confidence','REAL'],['evidence_ids','TEXT'],['target','TEXT']])if(!db.prepare('PRAGMA table_info(response_actions)').all().some(c=>c.name===name))db.exec(`ALTER TABLE response_actions ADD COLUMN ${name} ${type}`);
if (!db.prepare('PRAGMA table_info(audit_log)').all().some(c=>c.name==='step')) db.exec('ALTER TABLE audit_log ADD COLUMN step INTEGER');
for(const table of ['response_actions','audit_log','analysis_snapshots','feedback'])if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name==='run_id'))db.exec(`ALTER TABLE ${table} ADD COLUMN run_id INTEGER NOT NULL DEFAULT 0`);

export function currentRun(tenantId,scenarioId){return db.prepare('SELECT run_id FROM replay_runs WHERE tenant_id=? AND scenario_id=?').get(tenantId,scenarioId)?.run_id||0;}

export function getDb() { return db; }
export function connectorState(tenant,connector){const row=db.prepare('SELECT payload FROM connector_state WHERE tenant_id=? AND connector=?').get(tenant,connector);return row?JSON.parse(row.payload):{};}
export function saveConnectorState(tenant,connector,payload){db.prepare('INSERT INTO connector_state VALUES (?,?,?) ON CONFLICT(tenant_id,connector) DO UPDATE SET payload=excluded.payload').run(tenant,connector,JSON.stringify(payload));return payload;}
export function eventExists(tenant,id){return Boolean(db.prepare('SELECT 1 FROM events WHERE tenant_id=? AND id=?').get(tenant,storageId(tenant,id)));}
export function saveExternalInvestigation(tenant,scenario,payload){const id=`INV-${randomUUID()}`,createdAt=new Date().toISOString();db.prepare('INSERT INTO external_investigations VALUES (?,?,?,?,?)').run(id,tenant,scenario,createdAt,JSON.stringify(payload));return {id,createdAt,...payload};}
export function listExternalInvestigations(tenant,scenario){return db.prepare('SELECT id,created_at AS createdAt,payload FROM external_investigations WHERE tenant_id=? AND scenario_id=? ORDER BY created_at DESC LIMIT 20').all(tenant,scenario).map(({payload,...row})=>({...row,...JSON.parse(payload)}));}
export function databaseReady(){try{return db.prepare('SELECT 1 AS ok').get().ok===1;}catch{return false;}}
export function closeDb(){try{db.close();}catch{}}
export function pruneOldData(retentionDays=365){const days=Math.max(1,Number(retentionDays)||365),cutoff=new Date(Date.now()-days*86400000).toISOString();const oldIds=db.prepare('SELECT id FROM events WHERE ingested_at < ?').all(cutoff).map(x=>x.id);db.exec('BEGIN IMMEDIATE');try{for(const id of oldIds)db.prepare('DELETE FROM event_entities WHERE event_id=?').run(id);const events=db.prepare('DELETE FROM events WHERE ingested_at < ?').run(cutoff).changes;const audits=db.prepare('DELETE FROM audit_log WHERE timestamp < ?').run(cutoff).changes;const snapshots=db.prepare('DELETE FROM analysis_snapshots WHERE observed_at < ?').run(cutoff).changes;db.exec('COMMIT');return {events,audits,snapshots,cutoff};}catch(error){db.exec('ROLLBACK');throw error;}}
export function backupDatabase(destination){const safe=String(destination).replaceAll("'","''");db.exec(`VACUUM INTO '${safe}'`);return destination;}

const storageId=(tenant,id)=>tenant==='default'?id:tenant+'::'+id;
export function seedTenant(tenantId = 'default') {
  const now = new Date().toISOString();
  db.prepare(`INSERT OR IGNORE INTO tenants (id, name, plan, created_at) VALUES (?, ?, ?, ?)`)
    .run(tenantId, 'Default Organization', 'professional', now);
  db.prepare(`INSERT OR IGNORE INTO subscriptions (tenant_id, plan, started_at, expires_at) VALUES (?, ?, ?, ?)`)
    .run(tenantId, 'professional', now, new Date(Date.now() + 365 * 86400000).toISOString());
  db.prepare(`UPDATE policies SET id = 'POL-DEMO-01', name = 'Controlled simulation policy'
    WHERE id = 'POL-PROD-01' AND tenant_id = ?
    AND NOT EXISTS (SELECT 1 FROM policies WHERE id = 'POL-DEMO-01' AND tenant_id = ?)`)
    .run(tenantId, tenantId);
  const policy = db.prepare('SELECT id FROM policies WHERE tenant_id = ? LIMIT 1').get(tenantId);
  if (!policy) {
    db.prepare(`INSERT INTO policies (id, tenant_id, name, mode, critical_risk, min_confidence, allowed_actions, approval_required, audit_required, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      storageId(tenantId,'POL-DEMO-01'), tenantId, 'Controlled simulation policy', 'simulation', 75, 0.8,
      JSON.stringify(['revoke simulated session', 'block simulated source', 'isolate simulated endpoint', 'create incident', 'notify administrator', 'restrict simulated account', 'force re-authentication']),
      JSON.stringify(['isolate simulated endpoint', 'restrict simulated account', 'revoke simulated session', 'block simulated source', 'force re-authentication']),
      1, now
    );
  }
  const weights = [
    ['auth_failure', 25], ['auth_success', 20], ['privilege_escalation', 18],
    ['sensitive_access', 16], ['internal_access', 9], ['outbound_transfer', 15],
    ['endpoint_alert', 12], ['normal_activity', 0], ['cloud_alert', 12],
    ['application_alert', 12], ['firewall_alert', 12],
  ];
  for (const [type, points] of weights) {
    db.prepare(`INSERT OR IGNORE INTO risk_weights (tenant_id, event_type, points) VALUES (?, ?, ?)`)
      .run(tenantId, type, points);
  }
  db.prepare(`INSERT OR IGNORE INTO model_versions (tenant_id,version,status,algorithm,metrics,created_at,promoted_at,parent_version) VALUES (?,?,?,?,?,?,?,?)`).run(tenantId,'iforest-demo-v1','active','Seeded Isolation Forest + robust MAD',JSON.stringify({dataset:'deterministic-normal-baseline',reproducible:true}),now,now,null);
}

export function getPolicy(tenantId) {
  const row = db.prepare('SELECT * FROM policies WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 1').get(tenantId);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    mode: 'simulation',
    criticalRisk: row.critical_risk,
    minConfidence: row.min_confidence,
    allowedActions: JSON.parse(row.allowed_actions),
    approvalRequired: [...new Set([...JSON.parse(row.approval_required),'isolate simulated endpoint','restrict simulated account','revoke simulated session','block simulated source','force re-authentication'])],
    auditRequired: true,
  };
}

export function updatePolicy(tenantId, patch) {
  const current = getPolicy(tenantId);
  if (!current) return null;
  const next = {...current, ...patch};
  db.prepare(`UPDATE policies SET name=?, mode=?, critical_risk=?, min_confidence=?, allowed_actions=?, approval_required=?, audit_required=?, updated_at=? WHERE id=? AND tenant_id=?`)
    .run(next.name, next.mode, next.criticalRisk, next.minConfidence, JSON.stringify(next.allowedActions), JSON.stringify(next.approvalRequired), next.auditRequired ? 1 : 0, new Date().toISOString(), next.id, tenantId);
  return getPolicy(tenantId);
}

export function getWeights(tenantId) {
  const rows = db.prepare('SELECT event_type, points FROM risk_weights WHERE tenant_id = ?').all(tenantId);
  return Object.fromEntries(rows.map(r => [r.event_type, r.points]));
}

export function updateWeights(tenantId, weights) {
  for (const [type, points] of Object.entries(weights)) {
    db.prepare(`INSERT INTO risk_weights (tenant_id, event_type, points) VALUES (?, ?, ?) ON CONFLICT(tenant_id, event_type) DO UPDATE SET points=excluded.points`)
      .run(tenantId, type, Number(points));
  }
  return getWeights(tenantId);
}

export function insertAudit(entry) {
  db.prepare(`INSERT INTO audit_log (id, tenant_id, scenario_id, type, detail, actor, timestamp, simulation, step, run_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(entry.id, entry.tenantId, entry.scenarioId || null, entry.type, entry.detail, entry.actor, entry.timestamp, entry.simulation ? 1 : 0,entry.step??null,entry.scenarioId?currentRun(entry.tenantId,entry.scenarioId):0);
}

export function listAudit(tenantId, scenarioId, allRuns=false) {
  let sql = 'SELECT * FROM audit_log WHERE tenant_id = ?';
  const params = [tenantId];
  if (scenarioId) { sql += ' AND scenario_id = ?'; params.push(scenarioId); if(!allRuns){sql+=' AND run_id = ?';params.push(currentRun(tenantId,scenarioId));} }
  else if(!allRuns)sql+=' AND (scenario_id IS NULL OR run_id = COALESCE((SELECT run_id FROM replay_runs WHERE replay_runs.tenant_id = audit_log.tenant_id AND replay_runs.scenario_id = audit_log.scenario_id),0))';
  sql += ' ORDER BY timestamp DESC LIMIT 200';
  return db.prepare(sql).all(...params).map(r => ({
    id: r.id, type: r.type, detail: r.detail, actor: r.actor, timestamp: r.timestamp,
    scenarioId: r.scenario_id, simulation: !!r.simulation,step:r.step,runId:r.run_id,
  }));
}

export function insertFeedback(entry) {
  db.prepare(`INSERT INTO feedback (id, tenant_id, scenario_id, classification, reason, analyst, timestamp, run_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(entry.id, entry.tenantId, entry.scenarioId, entry.classification, entry.reason, entry.analyst, entry.timestamp,entry.runId??currentRun(entry.tenantId,entry.scenarioId));
}

export function listFeedback(tenantId, scenarioId) {
  const sql = scenarioId ? 'SELECT * FROM feedback WHERE tenant_id = ? AND scenario_id = ? ORDER BY timestamp DESC' : 'SELECT * FROM feedback WHERE tenant_id = ? ORDER BY timestamp DESC';
  return db.prepare(sql)
    .all(...(scenarioId ? [tenantId,scenarioId] : [tenantId])).map(r => ({
      id: r.id, scenarioId: r.scenario_id, classification: r.classification,
      reason: r.reason, analyst: r.analyst, timestamp: r.timestamp,runId:r.run_id,
    }));
}

export function insertAction(entry) {
  db.prepare(`INSERT INTO response_actions (id, tenant_id, scenario_id, action, status, reason, policy_id, actor, result, timestamp, step, risk, confidence, evidence_ids, target, run_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(entry.id, entry.tenantId, entry.scenarioId, entry.action, entry.status, entry.reason, entry.policyId, entry.actor, entry.result, entry.timestamp,entry.step??null,entry.risk??null,entry.confidence??null,JSON.stringify(entry.evidenceIds||[]),entry.target||null,currentRun(entry.tenantId,entry.scenarioId));
}

export function listActions(tenantId, scenarioId, allRuns=false) {
  return db.prepare(`SELECT * FROM response_actions WHERE tenant_id = ? AND scenario_id = ? ${allRuns?'':'AND run_id = ?'} ORDER BY timestamp DESC`)
    .all(...(allRuns?[tenantId,scenarioId]:[tenantId,scenarioId,currentRun(tenantId,scenarioId)])).map(r => ({
      id: r.id, scenarioId: r.scenario_id, action: r.action, status: r.status,
      reason: r.reason, policy: r.policy_id, actor: r.actor, result: r.result, timestamp: r.timestamp,step:r.step,risk:r.risk,confidence:r.confidence,evidenceIds:JSON.parse(r.evidence_ids||'[]'),target:r.target,runId:r.run_id,
    }));
}

export function upsertIncidentStatus(tenantId, scenarioId, incidentId, status, note) {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM incidents WHERE tenant_id = ? AND scenario_id = ?').get(tenantId, scenarioId);
  if (existing) {
    db.prepare('UPDATE incidents SET status = ?, note = ?, updated_at = ? WHERE tenant_id = ? AND scenario_id = ?')
      .run(status, note || null, now, tenantId, scenarioId);
  } else {
    db.prepare('INSERT INTO incidents (id, tenant_id, scenario_id, incident_id, status, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(storageId(tenantId,`INC-${scenarioId}`), tenantId, scenarioId, incidentId, status, note || null, now, now);
  }
  return db.prepare('SELECT * FROM incidents WHERE tenant_id = ? AND scenario_id = ?').get(tenantId, scenarioId);
}

export function getIncidentStatus(tenantId, scenarioId) {
  return db.prepare('SELECT status, note FROM incidents WHERE tenant_id = ? AND scenario_id = ?').get(tenantId, scenarioId);
}

export function ingestEvent(tenantId, event) {
  db.prepare(`INSERT OR REPLACE INTO events (id, tenant_id, scenario_id, timestamp, type, payload, ingested_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(storageId(tenantId,event.id), tenantId, event.metadata?.scenario || null, event.timestamp, event.type, JSON.stringify(event), new Date().toISOString());
  for (const kind of ['user','account','device','ip','asset','source','destination']) {
    if (!event[kind]) continue;
    db.prepare('INSERT INTO entities (tenant_id,kind,value,first_seen,last_seen) VALUES (?,?,?,?,?) ON CONFLICT(tenant_id,kind,value) DO UPDATE SET last_seen=excluded.last_seen')
      .run(tenantId,kind,event[kind],event.timestamp,event.timestamp);
    db.prepare('INSERT OR IGNORE INTO event_entities (tenant_id,event_id,kind,value) VALUES (?,?,?,?)')
      .run(tenantId,storageId(tenantId,event.id),kind,event[kind]);
  }
  const linked=['user','account','device','ip','asset','source','destination'].filter(k=>event[k]).map(kind=>({kind,value:event[kind]}));
  for(const entity of linked)db.prepare(`INSERT INTO topology_entities (tenant_id,kind,value,owner,criticality,source,first_seen,last_seen) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,kind,value) DO UPDATE SET last_seen=excluded.last_seen`).run(tenantId,entity.kind,entity.value,null,entity.kind==='asset'?3:1,event.sourceType,event.timestamp,event.timestamp);
  for(let i=1;i<linked.length;i++){const from=linked[0],to=linked[i],existing=db.prepare('SELECT evidence_ids FROM topology_relationships WHERE tenant_id=? AND source_kind=? AND source_value=? AND target_kind=? AND target_value=? AND relationship=?').get(tenantId,from.kind,from.value,to.kind,to.value,event.type),ids=[...new Set([...(existing?JSON.parse(existing.evidence_ids):[]),event.id])];db.prepare(`INSERT INTO topology_relationships (tenant_id,source_kind,source_value,target_kind,target_value,relationship,first_seen,last_seen,evidence_ids) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,source_kind,source_value,target_kind,target_value,relationship) DO UPDATE SET last_seen=excluded.last_seen,evidence_ids=excluded.evidence_ids`).run(tenantId,from.kind,from.value,to.kind,to.value,event.type,event.timestamp,event.timestamp,JSON.stringify(ids));}
}

export function listIngestedEvents(tenantId, scenarioId) {
  const rows = db.prepare('SELECT payload FROM events WHERE tenant_id = ? AND scenario_id = ? ORDER BY ingested_at ASC, rowid ASC')
    .all(tenantId, scenarioId);
  return rows.map(r => JSON.parse(r.payload));
}
export function listEntities(tenantId) { return db.prepare('SELECT kind,value,first_seen,last_seen FROM entities WHERE tenant_id=? ORDER BY last_seen DESC').all(tenantId); }
export function listTopology(tenantId){return {entities:db.prepare('SELECT kind,value,owner,criticality,source,first_seen,last_seen FROM topology_entities WHERE tenant_id=? ORDER BY criticality DESC,last_seen DESC').all(tenantId),relationships:db.prepare('SELECT source_kind AS sourceKind,source_value AS sourceValue,target_kind AS targetKind,target_value AS targetValue,relationship,first_seen AS firstSeen,last_seen AS lastSeen,evidence_ids AS evidenceIds FROM topology_relationships WHERE tenant_id=? ORDER BY last_seen DESC').all(tenantId).map(x=>({...x,evidenceIds:JSON.parse(x.evidenceIds)}))};}
export function modelOperations(tenantId){const versions=db.prepare('SELECT version,status,algorithm,metrics,created_at AS createdAt,promoted_at AS promotedAt,parent_version AS parentVersion FROM model_versions WHERE tenant_id=? ORDER BY created_at DESC').all(tenantId).map(x=>({...x,metrics:JSON.parse(x.metrics)})),drift=db.prepare('SELECT model_version AS modelVersion,measured_at AS measuredAt,sample_count AS sampleCount,score,status,details FROM model_drift WHERE tenant_id=? ORDER BY measured_at DESC LIMIT 20').all(tenantId).map(x=>({...x,details:JSON.parse(x.details)}));return {versions,activeVersion:versions.find(x=>x.status==='active')?.version||null,drift};}
export function registerModelVersion(tenantId,{version,algorithm,metrics,parentVersion}){db.prepare('INSERT INTO model_versions (tenant_id,version,status,algorithm,metrics,created_at,parent_version) VALUES (?,?,?,?,?,?,?)').run(tenantId,version,'candidate',algorithm,JSON.stringify(metrics||{}),new Date().toISOString(),parentVersion||null);return modelOperations(tenantId);}
export function promoteModelVersion(tenantId,version){const row=db.prepare('SELECT version FROM model_versions WHERE tenant_id=? AND version=?').get(tenantId,version);if(!row)throw Error('Unknown model version');const now=new Date().toISOString();db.exec('BEGIN IMMEDIATE');try{db.prepare("UPDATE model_versions SET status='retired' WHERE tenant_id=? AND status='active'").run(tenantId);db.prepare("UPDATE model_versions SET status='active',promoted_at=? WHERE tenant_id=? AND version=?").run(now,tenantId,version);db.exec('COMMIT');return modelOperations(tenantId);}catch(e){db.exec('ROLLBACK');throw e;}}
export function rollbackModelVersion(tenantId){const current=db.prepare("SELECT parent_version AS parentVersion FROM model_versions WHERE tenant_id=? AND status='active'").get(tenantId);if(!current?.parentVersion)throw Error('No rollback version configured');return promoteModelVersion(tenantId,current.parentVersion);}
export function recordModelDrift(tenantId,{modelVersion,sampleCount,score,details={}}){const status=score>=.3?'drifted':score>=.15?'watch':'stable';db.prepare('INSERT INTO model_drift (id,tenant_id,model_version,measured_at,sample_count,score,status,details) VALUES (?,?,?,?,?,?,?,?)').run(`DRIFT-${randomUUID()}`,tenantId,modelVersion,new Date().toISOString(),sampleCount,score,status,JSON.stringify(details));return {modelVersion,sampleCount,score,status,details};}
export function enqueueIngestion(tenantId,connector,payload){const id=`JOB-${randomUUID()}`,now=new Date().toISOString();db.prepare('INSERT INTO ingestion_jobs (id,tenant_id,connector,payload,status,attempts,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(id,tenantId,connector,JSON.stringify(payload),'queued',0,now,now);return id;}
export function updateIngestionJob(tenantId,id,status,errorMessage=null){const row=db.prepare('SELECT attempts FROM ingestion_jobs WHERE tenant_id=? AND id=?').get(tenantId,id);if(!row)return null;const attempts=row.attempts+1,next=status==='failed'&&attempts>=3?'dead-letter':status;db.prepare('UPDATE ingestion_jobs SET status=?,attempts=?,last_error=?,updated_at=? WHERE tenant_id=? AND id=?').run(next,attempts,errorMessage,new Date().toISOString(),tenantId,id);return db.prepare('SELECT id,connector,status,attempts,last_error AS lastError,created_at AS createdAt,updated_at AS updatedAt FROM ingestion_jobs WHERE tenant_id=? AND id=?').get(tenantId,id);}
export function ingestionHealth(tenantId){const counts=Object.fromEntries(db.prepare('SELECT status,COUNT(*) AS count FROM ingestion_jobs WHERE tenant_id=? GROUP BY status').all(tenantId).map(x=>[x.status,x.count]));return {counts,deadLetters:db.prepare("SELECT id,connector,attempts,last_error AS lastError,updated_at AS updatedAt FROM ingestion_jobs WHERE tenant_id=? AND status='dead-letter' ORDER BY updated_at DESC LIMIT 50").all(tenantId)};}
export function getIngestionJob(tenantId,id){const row=db.prepare('SELECT id,connector,payload,status,attempts,last_error AS lastError FROM ingestion_jobs WHERE tenant_id=? AND id=?').get(tenantId,id);return row?{...row,payload:JSON.parse(row.payload)}:null;}
export function rollbackSimulatedControl(tenantId,scenarioId,action,target,actor,reason){const row=db.prepare('SELECT state FROM simulated_controls WHERE tenant_id=? AND scenario_id=? AND action=? AND target=?').get(tenantId,scenarioId,action,target);if(!row)throw Error('Simulated control not found');const now=new Date().toISOString(),result='rolled back in simulation; no external system changed';db.prepare('UPDATE simulated_controls SET state=?,updated_at=? WHERE tenant_id=? AND scenario_id=? AND action=? AND target=?').run('rolled back in simulation',now,tenantId,scenarioId,action,target);db.prepare('INSERT INTO response_rollbacks (id,tenant_id,scenario_id,action,target,actor,reason,result,timestamp) VALUES (?,?,?,?,?,?,?,?,?)').run(`RB-${randomUUID()}`,tenantId,scenarioId,action,target,actor,reason,result,now);return {action,target,actor,reason,result,timestamp:now};}
export function clearScenarioEvents(tenantId,scenarioId){const ids=db.prepare('SELECT id FROM events WHERE tenant_id=? AND scenario_id=?').all(tenantId,scenarioId).map(x=>x.id);for(const id of ids)db.prepare('DELETE FROM event_entities WHERE tenant_id=? AND event_id=?').run(tenantId,id);db.prepare('DELETE FROM events WHERE tenant_id=? AND scenario_id=?').run(tenantId,scenarioId);db.prepare('DELETE FROM simulated_controls WHERE tenant_id=? AND scenario_id=?').run(tenantId,scenarioId);db.prepare('INSERT INTO replay_runs (tenant_id,scenario_id,run_id,started_at) VALUES (?,?,1,?) ON CONFLICT(tenant_id,scenario_id) DO UPDATE SET run_id=run_id+1,started_at=excluded.started_at').run(tenantId,scenarioId,new Date().toISOString());}
export function saveSnapshot(tenantId,scenarioId,payload){db.prepare('INSERT INTO analysis_snapshots (id,tenant_id,scenario_id,observed_at,payload,run_id) VALUES (?,?,?,?,?,?)').run(`SNAP-${randomUUID()}`,tenantId,scenarioId,new Date().toISOString(),JSON.stringify(payload),currentRun(tenantId,scenarioId));}
export function listSnapshots(tenantId,scenarioId,allRuns=false){return db.prepare(`SELECT observed_at,payload,run_id FROM analysis_snapshots WHERE tenant_id=? AND scenario_id=? ${allRuns?'':'AND run_id=?'} ORDER BY observed_at ASC`).all(...(allRuns?[tenantId,scenarioId]:[tenantId,scenarioId,currentRun(tenantId,scenarioId)])).map(x=>({observedAt:x.observed_at,analysis:JSON.parse(x.payload),runId:x.run_id}));}
export function applySimulatedControl(tenantId,scenarioId,action,target){db.prepare('INSERT INTO simulated_controls (tenant_id,scenario_id,action,target,state,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(tenant_id,scenario_id,action,target) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at').run(tenantId,scenarioId,action,target,'applied in simulation',new Date().toISOString());return {action,target,state:'applied in simulation'};}
export function listSimulatedControls(tenantId,scenarioId){return db.prepare('SELECT action,target,state,updated_at FROM simulated_controls WHERE tenant_id=? AND scenario_id=? ORDER BY updated_at DESC').all(tenantId,scenarioId);}
