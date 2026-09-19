import {parentPort,workerData} from 'node:worker_threads';
import {trainCandidate} from './modelTraining.js';
try{parentPort.postMessage({result:trainCandidate(workerData)});}catch(e){parentPort.postMessage({error:e.message});}
