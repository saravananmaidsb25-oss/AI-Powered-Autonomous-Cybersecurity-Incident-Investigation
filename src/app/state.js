import {POLICY, WEIGHTS} from '../engine.js';

export function createInitialState() {
  return {
    scenarioId: 'account',
    step: 0,
    playing: false,
    view: 'overview',
    question: '',
    answer: '',
    comparison: null,
    apiOnline: false,
    operationBusy: false,
    policy: {...POLICY},
    weights: {...WEIGHTS},
    incidentStatus: 'NEW',
    note: '',
    uiError: '',
    uiNotice: '',
    session: {actor: 'Demo analyst', role: 'admin', tenantId: 'default', authentication: 'demo'},
    graphQuery: '',
    graphZoom: 1,
    answerEvidence: [],
    theme: localStorage.getItem('sentinel-x-theme') || 'light',
  };
}

export const store = {
  state: createInitialState(),
  audit: [],
  actions: [],
  feedback: [],
  processedSteps: {},
  runIds: {},
  timer: null,
  connectors: {},
  externalInvestigations: {},
  stream: null,
  environmentEntities: [],
  topology: {entities:[],relationships:[]},
  modelOps: {versions:[],drift:[],activeVersion:null},
  aiStatus: {provider:'deterministic-fallback'},
};
