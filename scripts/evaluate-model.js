import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {scenarios} from '../src/scenarios.js';
import {analyze} from '../src/engine.js';

const cases=JSON.parse(readFileSync(resolve('evaluation/incident-cases.json'),'utf8'));
const rows=cases.map(testCase=>{const scenario=scenarios.find(x=>x.id===testCase.scenarioId);if(!scenario)throw Error(`Unknown evaluation scenario: ${testCase.scenarioId}`);const result=analyze(scenario,testCase.step??scenario.events.length);return {...testCase,predictedThreat:result.detected,risk:result.risk,confidence:result.confidence,correct:result.detected===testCase.expectedThreat};});
const tp=rows.filter(x=>x.expectedThreat&&x.predictedThreat).length,fp=rows.filter(x=>!x.expectedThreat&&x.predictedThreat).length,fn=rows.filter(x=>x.expectedThreat&&!x.predictedThreat).length,tn=rows.filter(x=>!x.expectedThreat&&!x.predictedThreat).length;
const precision=tp/(tp+fp||1),recall=tp/(tp+fn||1),accuracy=(tp+tn)/rows.length;
const output={dataset:'evaluation/incident-cases.json',generatedAt:new Date().toISOString(),metrics:{accuracy,precision,recall,falsePositiveRate:fp/(fp+tn||1)},confusionMatrix:{tp,fp,fn,tn},cases:rows};
process.stdout.write(`${JSON.stringify(output,null,2)}\n`);
if(accuracy<.95||precision<.95||recall<.95)process.exitCode=1;
