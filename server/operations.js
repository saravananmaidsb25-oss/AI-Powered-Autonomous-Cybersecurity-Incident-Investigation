import {randomUUID} from 'node:crypto';

const startedAt = Date.now();
const counters = {requests:0,errors:0,rateLimited:0,byStatus:new Map(),byRoute:new Map(),totalDurationMs:0};
const windows = new Map();
const pipeline={ingested:0,detectionFailures:0,aiRequests:0,aiFallbacks:0,externalQueries:0,externalFailures:0};
export function observePipeline(name,count=1){if(Object.hasOwn(pipeline,name))pipeline[name]+=count;}

export function requestId(req) {
  const supplied = String(req.headers['x-request-id'] || '').trim();
  return /^[A-Za-z0-9._:-]{8,128}$/.test(supplied) ? supplied : randomUUID();
}

export function applySecurityHeaders(res, id) {
  res.setHeader('X-Request-Id', id);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'");
}

export function allowMutation(req) {
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return {allowed:true};
  const limit = Math.max(10, Number(process.env.SENTINEL_X_RATE_LIMIT || 120));
  const windowMs = Math.max(1000, Number(process.env.SENTINEL_X_RATE_WINDOW_MS || 60000));
  const key = req.socket.remoteAddress || 'local';
  const now = Date.now();
  let entry = windows.get(key);
  if (!entry || now - entry.startedAt >= windowMs) entry = {startedAt:now,count:0};
  entry.count += 1;
  windows.set(key, entry);
  if (entry.count > limit) { counters.rateLimited += 1; return {allowed:false,retryAfter:Math.max(1,Math.ceil((windowMs-(now-entry.startedAt))/1000))}; }
  return {allowed:true,remaining:limit-entry.count};
}

export function observeRequest({method,path,status,durationMs,id}) {
  counters.requests += 1;
  counters.totalDurationMs += durationMs;
  if (status >= 500) counters.errors += 1;
  counters.byStatus.set(status,(counters.byStatus.get(status)||0)+1);
  const route = `${method} ${path.replace(/[A-Fa-f0-9-]{20,}/g,':id')}`;
  counters.byRoute.set(route,(counters.byRoute.get(route)||0)+1);
  if (process.env.SENTINEL_X_REQUEST_LOG === '1') console.log(JSON.stringify({time:new Date().toISOString(),requestId:id,method,path,status,durationMs:Number(durationMs.toFixed(2))}));
}

export function metricsText() {
  const lines = [
    '# HELP sentinel_x_uptime_seconds Process uptime in seconds',
    '# TYPE sentinel_x_uptime_seconds gauge',
    `sentinel_x_uptime_seconds ${Math.floor((Date.now()-startedAt)/1000)}`,
    '# HELP sentinel_x_http_requests_total HTTP requests handled',
    '# TYPE sentinel_x_http_requests_total counter',
    `sentinel_x_http_requests_total ${counters.requests}`,
    `sentinel_x_http_errors_total ${counters.errors}`,
    `sentinel_x_http_rate_limited_total ${counters.rateLimited}`,
    `sentinel_x_http_duration_ms_total ${counters.totalDurationMs.toFixed(2)}`,
  ];
  for (const [status,count] of counters.byStatus) lines.push(`sentinel_x_http_responses_total{status="${status}"} ${count}`);
  for(const [name,count] of Object.entries(pipeline))lines.push(`sentinel_x_pipeline_${name}_total ${count}`);
  lines.push(`sentinel_x_memory_rss_bytes ${process.memoryUsage().rss}`,`sentinel_x_cpu_user_microseconds ${process.cpuUsage().user}`,`sentinel_x_cpu_system_microseconds ${process.cpuUsage().system}`);
  for (const [route,count] of counters.byRoute) lines.push(`sentinel_x_http_route_requests_total{route="${route.replaceAll('"','\\"')}"} ${count}`);
  return lines.join('\n')+'\n';
}
