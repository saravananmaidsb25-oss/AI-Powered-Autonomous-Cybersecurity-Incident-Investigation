import {esc} from '../../lib/utils.js';

export const DEMO_CREDENTIALS = {
  tenantId: 'default',
  username: 'demo.analyst',
  password: 'SentinelDemo1!',
  label: 'Demo Analyst',
  role: 'admin',
};

export function loginView({error = '', authMode = 'demo'} = {}) {
  const isLocal = authMode === 'local';
  return `
    <div class="login-page">
      <div class="login-page__panel">
        <div class="login-page__brand">
          <div class="login-page__logo" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 28 28" fill="none"><path d="M14 2L26 8v12l-12 6L2 20V8l12-6z" stroke="currentColor" stroke-width="1.5"/><path d="M14 8l6 3v6l-6 3-6-3v-6l6-3z" fill="currentColor" opacity=".15"/></svg>
          </div>
          <div>
            <h1>SENTINEL<span>-X</span></h1>
            <p>AI Security Investigator · Evidence-first incident response</p>
          </div>
        </div>

        <div class="login-page__grid">
          <section class="login-card login-card--demo">
            <h2>Demo workspace</h2>
            <p>One-click access for judges and evaluators. All containment actions remain simulated.</p>
            <dl class="login-demo-creds">
              <div><dt>Organization</dt><dd><code>${esc(DEMO_CREDENTIALS.tenantId)}</code></dd></div>
              <div><dt>Username</dt><dd><code>${esc(DEMO_CREDENTIALS.username)}</code></dd></div>
              <div><dt>Password</dt><dd><code>${esc(DEMO_CREDENTIALS.password)}</code></dd></div>
              <div><dt>Role</dt><dd>${esc(DEMO_CREDENTIALS.role)}</dd></div>
            </dl>
            <button type="button" class="btn btn--primary btn--block" data-login-action="demo">Enter demo workspace</button>
          </section>

          <section class="login-card">
            <h2>${isLocal ? 'Sign in' : 'Sign in with demo credentials'}</h2>
            <p>${isLocal ? 'Use your provisioned local account.' : 'Use the demo credentials or click Enter demo workspace.'}</p>
            <form id="login-form" class="login-form" novalidate>
              <label class="field">
                <span>Organization</span>
                <input class="input" name="tenantId" value="${esc(DEMO_CREDENTIALS.tenantId)}" required autocomplete="organization">
              </label>
              <label class="field">
                <span>Username</span>
                <input class="input" name="username" value="${esc(DEMO_CREDENTIALS.username)}" required autocomplete="username">
              </label>
              <label class="field">
                <span>Password</span>
                <input class="input" name="password" type="password" value="${esc(DEMO_CREDENTIALS.password)}" required autocomplete="current-password">
              </label>
              <button class="btn btn--secondary btn--block" type="submit">Sign in</button>
              ${error ? `<p class="login-error" role="alert">${esc(error)}</p>` : ''}
            </form>
          </section>
        </div>

        <p class="login-page__footer text-muted">
          Simulation mode · SQLite persistence · Configure production auth with <code>SENTINEL_X_AUTH_MODE=local</code>
        </p>
      </div>
    </div>`;
}

export function bindLogin(root, {onDemo, onSubmit}) {
  root.querySelector('[data-login-action="demo"]')?.addEventListener('click', onDemo);
  root.querySelector('#login-form')?.addEventListener('submit', onSubmit);
}
