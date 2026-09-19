/** Synthetic demonstration dataset. Never describe this as organization training data. */
export function trainingFixture(version='lab-model-v1') {
  const event=(id,i,anomaly=false)=>({id,timestamp:`2026-09-${String(i<30?17:18).padStart(2,'0')}T${String(anomaly?2:9+i%8).padStart(2,'0')}:${String(i%60).padStart(2,'0')}:00Z`,type:anomaly?'outbound_transfer':'normal_activity',sourceType:'network',action:anomaly?'Synthetic anomalous transfer':'Synthetic normal lab activity',device:anomaly?'unknown-host':'lab-endpoint',ip:anomaly?'198.51.100.2':'192.0.2.10',normalized:{failures:anomaly?80:i%3,bytes:anomaly?9e9:1e6+(i%9)*100000},metadata:{simulation:true,scenario:'training-fixture'}});
  return {version,datasetName:'Synthetic lab fixture — not organizational telemetry',approved:true,trainingEvents:Array.from({length:30},(_,i)=>event(`train-${i}`,i)),evaluationEvents:Array.from({length:20},(_,i)=>({event:event(`eval-${i}`,i+30,i>=10),anomaly:i>=10}))};
}
