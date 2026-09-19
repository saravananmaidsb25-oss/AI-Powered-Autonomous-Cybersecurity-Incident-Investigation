import {setModelArtifact} from './engine.js';
import {api} from './api.js';
import {store} from './app/state.js';
import {renderApp, showBootError} from './app/render.js';
import {scenarios} from './scenarios.js';
import {loginView, bindLogin, DEMO_CREDENTIALS} from './ui/views/login.js';

const root = document.querySelector('#app');
const AUTH_KEY = 'sentinel-x-signed-in';

function readAuth() {
  try {
    return JSON.parse(sessionStorage.getItem(AUTH_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveAuth(session) {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
  store.state.session = session;
  store.state.signedIn = true;
}

function clearAuth() {
  sessionStorage.removeItem(AUTH_KEY);
  store.state.signedIn = false;
}

export function showLogin(error = '') {
  let authMode = 'demo';
  api.health().then(h => { authMode = h.authentication || 'demo'; }).catch(() => {});
  root.innerHTML = loginView({error, authMode});
  bindLogin(root, {
    onDemo: () => {
      saveAuth({
        actor: DEMO_CREDENTIALS.label,
        username: DEMO_CREDENTIALS.username,
        role: DEMO_CREDENTIALS.role,
        tenantId: DEMO_CREDENTIALS.tenantId,
        authentication: 'demo',
      });
      boot();
    },
    onSubmit: async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const data = Object.fromEntries(new FormData(form));
      button.disabled = true;
      try {
        const health = await api.health();
        if (health.authentication === 'local') {
          await api.login(data);
          saveAuth({
            actor: data.username,
            username: data.username,
            role: 'analyst',
            tenantId: data.tenantId,
            authentication: 'local',
          });
          await boot();
          return;
        }
        if (
          data.tenantId === DEMO_CREDENTIALS.tenantId &&
          data.username === DEMO_CREDENTIALS.username &&
          data.password === DEMO_CREDENTIALS.password
        ) {
          saveAuth({
            actor: DEMO_CREDENTIALS.label,
            username: DEMO_CREDENTIALS.username,
            role: DEMO_CREDENTIALS.role,
            tenantId: DEMO_CREDENTIALS.tenantId,
            authentication: 'demo',
          });
          await boot();
          return;
        }
        throw Object.assign(new Error('Invalid demo credentials. Use the values shown on this page.'), {status: 401});
      } catch (e) {
        showLogin(e.message);
      } finally {
        button.disabled = false;
      }
    },
  });
  api.health().then(h => {
    const panel = root.querySelector('.login-card:not(.login-card--demo) p');
    if (panel && h.authentication === 'local') panel.textContent = 'Use your provisioned local account.';
  }).catch(() => {});
}

async function boot() {
  if (!readAuth()) return showLogin();

  let health;
  try {
    health = await api.health();
    const session = await api.session();
    const saved = readAuth();
    store.state.session = {...session, ...saved, actor: saved?.actor || session.actor};
    store.state.signedIn = true;
    store.state.apiOnline = true;
    store.state.policy = await api.policy.get();
    store.state.weights = await api.weights.get();
    store.audit = await api.audit();
    store.actions = (await Promise.all(scenarios.map(s => api.actions(s.id)))).flat();
    store.feedback = await api.feedbackList();
    store.environmentEntities = await api.entities();
    store.topology = await api.topology();
    store.modelOps = await api.modelOps();
    setModelArtifact(await api.deployedModel());
    store.aiStatus = await api.aiStatus();
    store.connectors = await api.connectors();
    const progress = await Promise.all(scenarios.map(async scenario => ({id: scenario.id, events: await api.events(scenario.id), incident: await api.incident(scenario.id)})));
    for (const row of progress) { store.processedSteps[row.id] = row.events.length; store.runIds[row.id] = row.incident.runId; }
    const incident = progress.find(x => x.id === store.state.scenarioId).incident;
    store.state.incidentStatus = incident.status;
    store.state.note = incident.note;
    store.state.step = store.processedSteps[store.state.scenarioId];
    for (const id of ['telemetry', 'wazuh']) {
      const events = await api.events(id);
      if (events.length) {
        scenarios.push({id, name: id === 'wazuh' ? 'Wazuh telemetry' : 'Authenticated telemetry', incidentId: 'SX-' + id.toUpperCase(), entities: {}, events});
        store.processedSteps[id] = events.length;
        store.actions.push(...await api.actions(id));
      }
    }
    const liveEvents = await api.events('live');
    if (liveEvents.length) {
      scenarios.push({id: 'live', name: 'Ingested demo events', incidentId: 'SX-LIVE', summary: 'Evidence from ingested simulated events', entities: {}, events: liveEvents});
      store.actions.push(...await api.actions('live'));
      store.processedSteps.live = liveEvents.length;
      store.runIds.live = (await api.incident('live')).runId;
    }
    store.stream = api.stream(async message => {
      if (['live', 'telemetry', 'wazuh'].includes(message.scenarioId) && message.event) {
        let live = scenarios.find(s => s.id === message.scenarioId);
        if (!live) {
          live = {id: message.scenarioId, name: message.scenarioId === 'live' ? 'Ingested demo events' : message.scenarioId + ' telemetry', incidentId: 'SX-' + message.scenarioId.toUpperCase(), summary: 'Evidence from ingested simulated events', entities: {}, events: []};
          scenarios.push(live);
        }
        const wasAtLatest = store.state.step === live.events.length;
        if (!live.events.some(e => e.id === message.event.id)) live.events.push(message.event);
        store.processedSteps[message.scenarioId] = live.events.length;
        if (store.state.scenarioId === message.scenarioId && wasAtLatest && !store.state.playing) store.state.step = live.events.length;
      }
      if (message.type === 'action' && !store.actions.some(a => a.id === message.id)) store.actions.unshift(message);
      if (message.type === 'feedback' && !store.feedback.some(f => f.id === message.id)) store.feedback.unshift(message);
      try { store.audit = await api.audit(); } catch { store.state.uiError = 'Could not refresh the live audit trail.'; }
      renderApp(root);
    });
  } catch (error) {
    if (error.status === 401 && health?.authentication === 'local') {
      clearAuth();
      return showLogin();
    }
    store.state.apiOnline = false;
  }
  try {
    renderApp(root);
  } catch (err) {
    showBootError(root, err);
    console.error(err);
  }
}

if (!readAuth()) showLogin();
else boot();
