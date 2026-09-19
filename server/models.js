import {Worker} from 'node:worker_threads';
import {checksum} from '../services/modelTraining.js';
import {IsolationForest} from '../services/isolationForest.js';
import {getDb,modelOperations,registerModelVersion,promoteModelVersion} from './db.js';
let training=false;
export function deployedArtifact(tenant) {
  const version=modelOperations(tenant).activeVersion;
  if(version==='iforest-demo-v1')return null;
  const row=getDb().prepare('SELECT payload,checksum FROM model_artifacts WHERE tenant_id=? AND version=?').get(tenant,version);
  if(!row)throw Error('Active model has no trained artifact; roll back to the demo baseline');
  const artifact=JSON.parse(row.payload);if(checksum(artifact)!==row.checksum)throw Error('Model integrity check failed');
  return {...artifact,integrityHash:row.checksum};
}
export function trainInWorker(input) {
  if(training)throw Object.assign(Error('A training job is already running'),{status:409});training=true;
  return new Promise((resolve,reject)=>{
    let settled=false;
    const worker=new Worker(new URL('../services/modelWorker.js',import.meta.url),{workerData:input,resourceLimits:{maxOldGenerationSizeMb:128}});
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);training=false;worker.terminate();error?reject(error):resolve(result);};
    const timer=setTimeout(()=>finish(Error('Model training timed out')),20000);
    worker.once('message',message=>finish(message.error?Error(message.error):null,message.result));worker.once('error',error=>finish(error));
    worker.once('exit',code=>{if(!settled)finish(Error('Model worker stopped'));});
  });
}
export function saveCandidate(tenant,input,result) {
  const db=getDb();db.exec('BEGIN IMMEDIATE');try{
    registerModelVersion(tenant,{version:input.version,algorithm:'Trained Isolation Forest',metrics:result.metrics,parentVersion:modelOperations(tenant).activeVersion});
    db.prepare('INSERT INTO model_artifacts VALUES (?,?,?,?)').run(tenant,input.version,JSON.stringify(result.artifact),result.checksum);
    db.exec('COMMIT');return modelOperations(tenant);
  }catch(e){db.exec('ROLLBACK');throw e;}
}
export function promoteTrainedModel(tenant,version,{rollback=false}={}){
  const db=getDb(),ops=modelOperations(tenant),candidate=ops.versions.find(x=>x.version===version);
  if(!candidate)throw Error('Unknown model version');
  if(version!=='iforest-demo-v1'){
    const row=db.prepare('SELECT payload,checksum FROM model_artifacts WHERE tenant_id=? AND version=?').get(tenant,version);
    if(!row||candidate.metrics.eligible!==true)throw Error('Promotion requires a trained artifact passing held-out evaluation');
    const artifact=JSON.parse(row.payload);if(checksum(artifact)!==row.checksum)throw Error('Model integrity check failed');IsolationForest.fromJSON(artifact.forest);
  }
  if(version===ops.activeVersion)return ops;
  if(!rollback)db.prepare('UPDATE model_versions SET parent_version=? WHERE tenant_id=? AND version=?').run(ops.activeVersion,tenant,version);
  return promoteModelVersion(tenant,version);
}
export function rollbackTrainedModel(tenant){const ops=modelOperations(tenant),parent=ops.versions.find(x=>x.status==='active')?.parentVersion;if(!parent)throw Error('No rollback version configured');return promoteTrainedModel(tenant,parent,{rollback:true});}
