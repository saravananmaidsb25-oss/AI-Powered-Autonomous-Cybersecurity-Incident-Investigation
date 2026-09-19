const BASE = '/api';
let demoToken = '';
let refreshing=null;

async function request(path, options = {}) {
  const optionsWithHeaders={
    headers: {'Content-Type': 'application/json', ...(demoToken ? {'X-Sentinel-Demo-Token':demoToken} : {}), ...options.headers},
    ...options,
  };
  let res = await fetch(`${BASE}${path}`,optionsWithHeaders);
  if(res.status===401&&!path.startsWith('/v1/auth/')){
    if(!refreshing)refreshing=fetch('/api/v1/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.ok).finally(()=>{refreshing=null;});
    if(await refreshing)res=await fetch(`${BASE}${path}`,optionsWithHeaders);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.error || res.statusText),{status:res.status});
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/html') || ct.includes('text/csv')) return res.text();
  return res.json();
}

export const api = {
  login: data => request('/v1/auth/login',{method:'POST',body:JSON.stringify(data)}),
  logout: () => request('/v1/auth/logout',{method:'POST',body:'{}'}),
  connectors: () => request('/connectors'),
  pollWazuh: () => request('/connectors/wazuh/poll',{method:'POST',body:'{}'}),
  trainModel: data => request('/model-ops/train',{method:'POST',body:JSON.stringify(data)}),
  promoteModel: version => request('/model-ops/promote',{method:'POST',body:JSON.stringify({version})}),
  rollbackModel: () => request('/model-ops/rollback',{method:'POST',body:'{}'}),
  externalInvestigation: (scenarioId,step) => request('/investigations/external',{method:'POST',body:JSON.stringify({scenarioId,step,maxQueries:3})}),
  health: () => request('/health'),
  session: async () => {const data=await request('/session');demoToken=data.token;return data;},
  scenarios: () => request('/scenarios'),
  events: (scenarioId) => request(`/events/${scenarioId}`),
  entities: () => request('/entities'),
  topology: () => request('/topology'),
  deployedModel: () => request('/model-ops/deployed'),
  modelOps: () => request('/model-ops'),
  aiStatus: () => request('/ai-status'),
  snapshots: (scenarioId) => request(`/snapshots/${scenarioId}`),
  analyze: (scenarioId, step) => request(`/analyze/${scenarioId}${step===undefined?'':`?step=${step}`}`),
  dashboard: () => request('/dashboard'),
  investigate: (scenarioId, question, step) => request('/investigate', {method: 'POST', body: JSON.stringify({scenarioId, question, step})}),
  policy: {
    get: () => request('/policy'),
    update: (patch) => request('/policy', {method: 'PUT', body: JSON.stringify(patch)}),
  },
  weights: {
    get: () => request('/weights'),
    update: (weights) => request('/weights', {method: 'PUT', body: JSON.stringify({weights})}),
  },
  feedback: (data) => request('/feedback', {method: 'POST', body: JSON.stringify(data)}),
  feedbackList: (scenarioId = '') => request(`/feedback/${scenarioId}`),
  action: (data) => request('/actions', {method: 'POST', body: JSON.stringify(data)}),
  actions: (scenarioId) => request(`/actions/${scenarioId}`),
  audit: (scenarioId) => request(`/audit/${scenarioId || ''}`),
  status: (scenarioId, status, note) => request(`/incidents/${scenarioId}/status`, {method: 'PUT', body: JSON.stringify({status, note})}),
  incident: (scenarioId) => request(`/incidents/${scenarioId}`),
  simulateReset: (scenarioId) => request(`/simulate/${scenarioId}/reset`, {method:'POST',body:'{}'}),
  simulateStep: (scenarioId, step) => request(`/simulate/${scenarioId}/step`, {method:'POST',body:JSON.stringify({step})}),
  report: (scenarioId, format = 'json', step) => request(`/report/${scenarioId}/${format}${step===undefined?'':`?step=${step}`}`),
  reportPdf: async (scenarioId, step) => {const res=await fetch(`/api/report/${scenarioId}/pdf?step=${step}`);if(!res.ok)throw new Error((await res.json().catch(()=>({}))).error||'PDF export failed');return res.blob();},
  compare: (a, b, step) => request(`/compare?a=${a}&b=${b}${step===undefined?'':`&step=${step}`}`),
  stream: (onMessage) => {
    const es = new EventSource(`${BASE}/stream`);
    es.onmessage = e => onMessage(JSON.parse(e.data));
    es.addEventListener('event', e => onMessage(JSON.parse(e.data)));
    es.addEventListener('action', e => onMessage({type: 'action', ...JSON.parse(e.data)}));
    es.addEventListener('feedback', e => onMessage({type: 'feedback', ...JSON.parse(e.data)}));
    return es;
  },
};
