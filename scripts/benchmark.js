const BASE = process.env.SENTINEL_X_BENCH_URL || 'http://127.0.0.1:4173';

async function request(path, options = {}) {
  const session = await fetch(`${BASE}/api/session`).then(r => r.json());
  const headers = {
    'Content-Type': 'application/json',
    'X-Sentinel-Demo-Token': session.token,
    ...options.headers,
  };
  const started = performance.now();
  const res = await fetch(`${BASE}${path}`, {...options, headers});
  const ms = performance.now() - started;
  const body = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  return {status: res.status, ms, body};
}

function pass(label, ms, budget) {
  const ok = ms <= budget;
  console.log(`${ok ? '✓' : '✗'} ${label}: ${ms.toFixed(1)} ms (budget ${budget} ms)`);
  return ok;
}

async function main() {
  console.log(`SENTINEL-X benchmark → ${BASE}\n`);
  let ok = true;

  await request('/api/simulate/account/reset', {method: 'POST', body: '{}'});
  for (let step = 1; step <= 6; step++) {
    const r = await request('/api/simulate/account/step', {method: 'POST', body: JSON.stringify({step})});
    if (step === 6) ok = pass('Ingest + analyze (6-event scenario)', r.ms, 80) && ok;
  }

  const dash = await request('/api/dashboard');
  ok = pass('Dashboard API', dash.ms, 120) && ok;

  const analyze = await request('/api/analyze/account');
  ok = pass('Analyze API', analyze.ms, 60) && ok;

  const metricsStarted = performance.now();
  const metricsRes = await fetch(`${BASE}/api/metrics`);
  const metricsText = await metricsRes.text();
  ok = pass('Metrics endpoint', performance.now() - metricsStarted, 40) && ok;
  if (metricsText) {
    console.log('  Prometheus samples:', metricsText.split('\n').filter(l => l.startsWith('sentinel_x_')).length);
  }

  console.log(`\n${ok ? 'All benchmarks within budget.' : 'Some benchmarks exceeded budget.'}`);
  process.exit(ok ? 0 : 1);
}

main().catch(err => {
  console.error('Benchmark failed:', err.message);
  console.error('Ensure the server is running: npm start');
  process.exit(1);
});
