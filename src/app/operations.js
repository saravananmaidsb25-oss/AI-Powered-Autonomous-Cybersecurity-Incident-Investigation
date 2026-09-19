import {api} from '../api.js';
import {store} from './state.js';
import {setModelArtifact} from '../engine.js';
import {scenarios} from '../scenarios.js';
import {download} from '../lib/utils.js';
import {trainingFixture} from '../trainingExample.js';

export const operationActions=['poll-wazuh','refresh-operations','train-model','promote-model','rollback-model','download-training-example','external-investigation'];
export async function refreshOperations(){
  [store.connectors,store.modelOps]=await Promise.all([api.connectors(),api.modelOps()]);
  setModelArtifact(await api.deployedModel());
  for(const info of await api.scenarios())if(['wazuh','telemetry'].includes(info.id)){
    const events=await api.events(info.id);let scenario=scenarios.find(s=>s.id===info.id);
    if(!scenario){scenario={...info,entities:{},events:[]};scenarios.push(scenario);}scenario.events=events;store.processedSteps[info.id]=events.length;
    store.actions=[...store.actions.filter(a=>a.scenarioId!==info.id),...await api.actions(info.id)];
  }
  store.audit=await api.audit();
}
export async function handleOperation(action,root,render){
  if(store.state.operationBusy)return;
  try{
    const file=root.querySelector('#training-file')?.files?.[0],approved=root.querySelector('#training-approved')?.checked,version=root.querySelector('#model-version')?.value;
    const scenarioId=store.state.scenarioId,step=store.state.step;
    if(action==='download-training-example'){download('synthetic-training-example.json',JSON.stringify(trainingFixture('lab-'+Date.now()),null,2),'application/json');return;}
    store.state.operationBusy=true;store.state.uiError='';store.state.uiNotice='';render();
    if(action==='poll-wazuh')await api.pollWazuh();
    if(action==='train-model'){
      if(!file||file.size>900000)throw Error('Select a training JSON file smaller than 900 KB.');
      if(!approved)throw Error('Review the dataset labels and check the approval box.');
      await api.trainModel({...JSON.parse(await file.text()),approved:true});
    }
    if(action==='promote-model'){if(!version)throw Error('Train a candidate that passes evaluation first.');await api.promoteModel(version);}
    if(action==='rollback-model')await api.rollbackModel();
    if(action==='external-investigation')store.externalInvestigations[scenarioId]=await api.externalInvestigation(scenarioId,step);
    await refreshOperations();store.state.uiNotice='Operation completed. Results and audit records refreshed.';
  }catch(e){store.state.uiError=e.message;}finally{store.state.operationBusy=false;render();}
}
