import {queryWazuh} from './wazuh.js';
import {verifyClaims} from './investigationAgent.js';

/** Evidence-driven breadth-first investigation; queries cannot select endpoints or run commands. */
export async function investigateExternalEvidence(analysis,{maxQueries=3,query=queryWazuh,timeoutMs=12000}={}) {
  if(!Number.isInteger(maxQueries)||maxQueries<1||maxQueries>5)throw Object.assign(Error('Query budget must be 1–5'),{status:400});
  if(!analysis.events.length)return {mode:'external-read-only',trace:[],evidence:[],claims:[],stopReason:'insufficient-evidence',queriesUsed:0};
  if(analysis.events.some(e=>e.metadata?.simulation!==false))throw Object.assign(Error('External investigation requires real-source evidence'),{status:400});
  const seedIds=analysis.events.map(e=>e.id),until=analysis.events.at(-1).timestamp;
  const from=new Date(Date.parse(analysis.events[0].timestamp)-1800000).toISOString();
  const queue=[],seenEntities=new Set(),seenEvents=new Set(seedIds),evidence=[],trace=[];
  const enqueue=events=>{for(const e of events)for(const kind of ['device','account','ip']){const value=e[kind],key=kind+':'+value;if(typeof value==='string'&&value.length<=500&&!seenEntities.has(key)){seenEntities.add(key);queue.push({kind,value});}}};
  enqueue(analysis.events);
  const signal=AbortSignal.timeout(timeoutMs);let stopReason='entity-frontier-exhausted';
  while(queue.length&&trace.length<maxQueries&&evidence.length<100){
    const entity=queue.shift(),started=performance.now();
    try{
      const result=await query({from,until,entity,limit:Math.min(50,100-evidence.length),signal});
      const accepted=result.events.filter(e=>Date.parse(e.timestamp)>=Date.parse(from)&&Date.parse(e.timestamp)<=Date.parse(until)&&e.metadata?.simulation===false&&e[entity.kind]===entity.value);
      const fresh=accepted.filter(e=>{if(seenEvents.has(e.id))return false;seenEvents.add(e.id);return true;}).slice(0,100-evidence.length);
      evidence.push(...fresh);enqueue(fresh);
      trace.push({step:trace.length+1,tool:'wazuh_related_events',reason:`Inspect evidence related to observed ${entity.kind}`,entity,window:{from,until},eventIds:fresh.map(e=>e.id),returned:result.events.length,accepted:accepted.length,truncated:result.hasMore,durationMs:Math.round(performance.now()-started),readOnly:true,status:'completed'});
    }catch{
      trace.push({step:trace.length+1,tool:'wazuh_related_events',entity,readOnly:true,status:'failed',durationMs:Math.round(performance.now()-started)});stopReason=signal.aborted?'time-budget-exhausted':'external-query-failed';break;
    }
  }
  if(!trace.some(t=>t.status==='failed'))stopReason=evidence.length>=100?'evidence-budget-exhausted':queue.length?'query-budget-exhausted':'entity-frontier-exhausted';
  const claims=evidence.map(e=>({text:e.action,citations:[e.id]})),verification=verifyClaims(claims,evidence.map(e=>({eventId:e.id,observation:e.action})));
  return {mode:'external-read-only',planner:'Evidence-driven entity traversal',seedIds,asOf:until,budget:maxQueries,queriesUsed:trace.length,evidence,claims,verification,trace,stopReason,uncertainty:['Related telemetry is not proof of malicious intent.','Queries are bounded and may not retrieve every related event.'],responseActions:[],providerCalls:0};
}
