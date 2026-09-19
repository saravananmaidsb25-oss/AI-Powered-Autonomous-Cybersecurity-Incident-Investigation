import {esc} from '../../lib/utils.js';

const NAV = [
  {id: 'operations', icon: '↗', label: 'Integrations & models'},
  {id: 'overview', icon: '◫', label: 'Command center'},
  {id: 'investigate', icon: '◇', label: 'Investigation'},
  {id: 'intelligence', icon: '◉', label: 'Intelligence'},
  {id: 'governance', icon: '▣', label: 'Governance'},
  {id: 'admin', icon: '⚙', label: 'Configuration'},
  {id: 'requirements', icon: '≡', label: 'Project requirements'},
  {id: 'evaluation', icon: '★', label: 'Jury evaluation'},
];

export function renderShell({state, scenarios, scenario, content, pageHeader}) {
  const identity=state.session||{},initials=String(identity.actor||'Security Analyst').split(/\s+|@/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  return `<a class="skip-link" href="#main-content">Skip to main content</a><div class="app-shell">
    <aside class="sidebar" aria-label="Main navigation">
      <div class="sidebar__brand">
        <div class="sidebar__logo" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 2L26 8v12l-12 6L2 20V8l12-6z" stroke="currentColor" stroke-width="1.5"/><path d="M14 8l6 3v6l-6 3-6-3v-6l6-3z" fill="currentColor" opacity=".15"/></svg>
        </div>
        <div>
          <strong class="sidebar__title">SENTINEL<span>-X</span></strong>
          <small class="sidebar__subtitle">AI Security Investigator</small>
        </div>
      </div>
      <div class="sidebar__status ${state.apiOnline ? 'sidebar__status--online' : ''}">
        <span class="status-dot"></span>
        ${state.apiOnline ? 'API connected · controlled response' : 'Offline · local simulation'}
      </div>
      <nav class="sidebar__nav">
        <span class="sidebar__section">Workspace</span>
        ${NAV.map(n => `<button type="button" class="nav-item ${state.view === n.id ? 'nav-item--active' : ''}" data-view="${n.id}" ${state.view===n.id?'aria-current="page"':''}>
          <span class="nav-item__icon">${n.icon}</span>
          <span>${esc(n.label)}</span>
        </button>`).join('')}
        <span class="sidebar__section sidebar__section--spaced">Scenarios</span>
        ${scenarios.map(x => `<button type="button" class="scenario-item ${scenario.id === x.id ? 'scenario-item--active' : ''}" data-scenario="${x.id}">
          <span class="scenario-item__dot"></span>
          <span class="scenario-item__text">
            <span>${esc(x.name)}</span>
            <small>${esc(x.incidentId)}</small>
          </span>
        </button>`).join('')}
      </nav>
      <div class="sidebar__footer">
        <div class="sidebar__engine">Deterministic demo · SQLite persistence</div>
      </div>
    </aside>
    <div class="main-area">
      <header class="topbar">
        <div class="topbar__breadcrumb">Security Operations <span>/</span> ${esc(state.view)}</div>
        <div class="topbar__actions">
          <button type="button" class="btn btn--ghost" data-action="toggle-theme" title="Toggle light/dark theme">${state.theme === 'dark' ? '☀' : '☾'}</button>
          <span class="topbar__pill ${state.apiOnline ? 'topbar__pill--live' : ''}">${state.apiOnline ? 'Live API' : 'Local mode'}</span>
          <button class="btn btn--secondary" data-action="logout">Sign out</button><div class="identity"><span class="identity__text"><strong>${esc(identity.actor||'Demo analyst')}</strong><small>${esc(identity.role||'analyst')} · ${esc(identity.authentication||'demo')}</small></span><div class="avatar" title="${esc(identity.actor||'Security Analyst')}">${esc(initials||'SA')}</div></div>
        </div>
      </header>
      <main class="page" id="main-content" tabindex="-1">
        ${pageHeader}
        ${content}
      </main>
    </div>
  </div>`;
}

export function pageHeader({incidentId, title, subtitle, actions, banner}) {
  return `
    <div class="page-header">
      <div class="page-header__text">
        <p class="page-header__eyebrow">SENTINEL-X · ${esc(incidentId)}</p>
        <h1 class="page-header__title">${esc(title)}</h1>
        <p class="page-header__desc">${esc(subtitle)}</p>
      </div>
      <div class="page-header__actions">${actions}</div>
    </div>
    ${banner ? `<div class="alert-banner">${banner}</div>` : ''}`;
}
