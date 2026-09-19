/** Bounded read-only investigation over the already observed incident snapshot. */
export function runInvestigation(analysis,{maxSteps=5}={}){
  const budget=Math.max(1,Math.min(5,Number.isInteger(maxSteps)?maxSteps:5));
  const events=analysis.events||[],ids=new Set(events.map(e=>e.id)),trace=[],claims=[];
  const add=(tool,reason,result)=>trace.push({step:trace.length+1,tool,reason,result,readOnly:true});
  const evidence=(analysis.evidence||[]).filter(e=>ids.has(e.eventId));
  const tasks=[
    ()=>{add('read_observed_events','Establish the observed sequence',events.map(e=>({id:e.id,time:e.timestamp,type:e.type})));for(const e of evidence)claims.push({kind:'observation',text:e.observation,citations:[e.eventId],verification:'exact observation'});},
    ()=>{const correlations=(analysis.correlations||[]).filter(c=>ids.has(c.from)&&ids.has(c.to));add('inspect_relationships','Find evidence connecting events',correlations);},
    ()=>{add('compare_explanations','Consider suspicious and legitimate explanations',{suspicious:analysis.contextSignals,legitimate:analysis.legitimacy,disposition:analysis.disposition,maliciousIntentProven:false});},
    ()=>{add('inspect_impact','Identify observed affected systems',analysis.affected);},
    ()=>{add('identify_gaps','Stop where missing evidence requires administrator investigation',analysis.gaps);}
  ];
  if(events.length)for(const task of tasks.slice(0,budget))task();
  return {mode:'bounded-read-only',planner:'deterministic evidence workflow',budget,stepsUsed:trace.length,trace,claims,verification:verifyClaims(claims,evidence),stopReason:!events.length?'insufficient-evidence':budget<tasks.length?'step-budget-exhausted':'available-evidence-exhausted',uncertainty:analysis.gaps?.unknown||[],nextSteps:analysis.gaps?.next||[],externalQueries:0,providerCalls:0};
}

/** Accept only exact extractive factual claims; semantic inference remains unverified. */
export function verifyClaims(claims,evidence){
  const byId=new Map(evidence.map(e=>[e.eventId||e.id,e]));
  if(!Array.isArray(claims)||!claims.length)return {accepted:false,claims:[],rejected:1};
  const results=claims.map(claim=>{
    const citations=Array.isArray(claim?.citations)?claim.citations:[];
    const known=citations.length>0&&citations.every(id=>typeof id==='string'&&byId.has(id));
    const text=typeof claim?.text==='string'?claim.text.trim():'';
    const supported=known&&text.length>0&&citations.every(id=>byId.get(id).observation===text);
    return {text,citations,supported,reason:supported?'Exact observed evidence':'Unsupported claim or unknown citation'};
  });
  return {accepted:results.every(c=>c.supported),claims:results,rejected:results.filter(c=>!c.supported).length};
}
