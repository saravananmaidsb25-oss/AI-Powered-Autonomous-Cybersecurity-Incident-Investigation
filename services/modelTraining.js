import {createHash} from 'node:crypto';
import {IsolationForest,eventFeatures} from './isolationForest.js';
import {baseline as demoBaseline} from '../src/scenarios.js';
import {normalize} from '../src/engine.js';

export const checksum=artifact=>createHash('sha256').update(JSON.stringify(artifact)).digest('hex');
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
const stats=values=>{const center=median(values);return [center,Math.max(1,median(values.map(v=>Math.abs(v-center))))];};

export function trainCandidate({version,trainingEvents,evaluationEvents,datasetName,approved}) {
  if(!/^[a-zA-Z0-9._-]{3,80}$/.test(version||'')||version==='iforest-demo-v1')throw Error('Unique candidate version required');
  if(approved!==true)throw Error('Administrator must approve the supplied normal training data');
  if(typeof datasetName!=='string'||!datasetName.trim()||datasetName.length>100)throw Error('Dataset name required');
  if(!Array.isArray(trainingEvents)||trainingEvents.length<20||trainingEvents.length>2000)throw Error('Provide 20–2000 reviewed normal training events');
  if(!Array.isArray(evaluationEvents)||evaluationEvents.length<10||evaluationEvents.length>1000)throw Error('Provide 10–1000 held-out labeled evaluation events');
  const train=trainingEvents.map(normalize),evaluation=evaluationEvents.map(row=>{if(typeof row.anomaly!=='boolean')throw Error('Evaluation anomaly labels must be boolean');return {event:normalize(row.event),anomaly:row.anomaly};});
  const ids=new Set();for(const e of [...train,...evaluation.map(x=>x.event)]){if(ids.has(e.id))throw Error('Training and evaluation event IDs must be unique and disjoint');ids.add(e.id);if(!Number.isFinite(e.normalized.bytes)||!Number.isFinite(e.normalized.failures)||e.normalized.bytes<0||e.normalized.failures<0)throw Error('Invalid training features');}
  const positives=evaluation.filter(x=>x.anomaly).length,negatives=evaluation.length-positives;
  if(positives<5||negatives<5)throw Error('Evaluation requires at least five normal and five anomalous cases');
  const [loginHourMedian,loginHourMad]=stats(train.map(e=>new Date(e.timestamp).getUTCHours()));
  const [failedLoginMedian,failedLoginMad]=stats(train.map(e=>e.normalized.failures));
  const [outboundBytesMedian,outboundBytesMad]=stats(train.map(e=>e.normalized.bytes));
  const unique=key=>[...new Set(train.map(e=>e[key]).filter(Boolean))];
  const baseline={...demoBaseline,users:{},assetCriticality:{},loginHourMedian,loginHourMad,failedLoginMedian,failedLoginMad,outboundBytesMedian,outboundBytesMad,knownDevices:unique('device'),knownIPs:unique('ip'),knownLocations:[...new Set(train.map(e=>e.normalized.location).filter(Boolean))]};
  const features=e=>eventFeatures(e,baseline);
  const forest=new IsolationForest(64,64,8,271828).fit(train.map(features));
  const threshold=.7,confusion={tp:0,fp:0,fn:0,tn:0};
  for(const row of evaluation){const predicted=forest.score(features(row.event))>threshold;confusion[row.anomaly?(predicted?'tp':'fn'):(predicted?'fp':'tn')]++;}
  const {tp,fp,fn,tn}=confusion,precision=tp/(tp+fp||1),recall=tp/(tp+fn||1),falsePositiveRate=fp/(fp+tn||1);
  const metrics={precision,recall,falsePositiveRate,confusion,trainingCount:train.length,evaluationCount:evaluation.length,datasetName,eligible:precision>=.8&&recall>=.8&&falsePositiveRate<=.2,acceptance:{minPrecision:.8,minRecall:.8,maxFalsePositiveRate:.2},scope:'Held-out event anomaly detection; not incident-level or production accuracy'};
  const artifact={schemaVersion:1,version,algorithm:'Seeded Isolation Forest',featureSchema:'security-event-six-v1',threshold,baseline,forest:forest.toJSON(),trainingDigest:checksum(train),evaluationDigest:checksum(evaluation)};
  return {artifact,checksum:checksum(artifact),metrics};
}
