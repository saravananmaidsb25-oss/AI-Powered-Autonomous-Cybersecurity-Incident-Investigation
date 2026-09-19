import {createServer} from 'node:http';
import {createServer as createHttpsServer} from 'node:https';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {principalFor} from './server/auth.js';
import {handleApi,startConnectorWorker,startIngestionWorker} from './server/api.js';
import {seedTenant,databaseReady,closeDb,pruneOldData} from './server/db.js';
import {requestId,applySecurityHeaders,allowMutation,observeRequest,metricsText} from './server/operations.js';

seedTenant('default');
const retention = pruneOldData(process.env.SENTINEL_X_RETENTION_DAYS || 365);

const root = resolve('.');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const port = Number(process.env.PORT || 4173);
const host = process.env.SENTINEL_X_HOST || '127.0.0.1';
const productionExposure = host !== '127.0.0.1' && host !== 'localhost';
if (productionExposure && process.env.SENTINEL_X_ALLOW_NETWORK !== '1') throw new Error('Network exposure is disabled. Set SENTINEL_X_ALLOW_NETWORK=1 only behind an authenticated TLS reverse proxy.');

const tlsCert=process.env.SENTINEL_X_TLS_CERT,tlsKey=process.env.SENTINEL_X_TLS_KEY;
if(Boolean(tlsCert)!==Boolean(tlsKey))throw Error('Both TLS certificate and key paths are required');
const tlsOptions=tlsCert?{cert:readFileSync(tlsCert),key:readFileSync(tlsKey),minVersion:'TLSv1.2'}:null;
if(tlsOptions)process.env.SENTINEL_X_SECURE_COOKIES='1';
const makeServer=tlsOptions?handler=>createHttpsServer(tlsOptions,handler):createServer;
const server = makeServer(async (req,res) => {
  const started = performance.now(), id = requestId(req);
  applySecurityHeaders(res,id);
  if(req.socket.encrypted)res.setHeader('Strict-Transport-Security','max-age=31536000');
  const originalEnd = res.end.bind(res);
  let observed = false;
  res.end = (...args) => { if(!observed){observed=true;observeRequest({method:req.method,path:new URL(req.url,`http://localhost:${port}`).pathname,status:res.statusCode,durationMs:performance.now()-started,id});} return originalEnd(...args); };
  try {
    const url = new URL(req.url,`http://localhost:${port}`);
    if(url.pathname==='/api/ready'){
      const ready=databaseReady();res.writeHead(ready?200:503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify({status:ready?'ready':'not_ready',database:ready,mode:'simulation'}));
    }
    if(url.pathname==='/api/metrics'){
      if(!principalFor(req)){res.writeHead(401,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Authentication required'}));}
      res.writeHead(200,{'Content-Type':'text/plain; version=0.0.4; charset=utf-8','Cache-Control':'no-store'});return res.end(metricsText());
    }
    if(url.pathname.startsWith('/api/')){
      const rate=allowMutation(req);
      if(!rate.allowed){res.writeHead(429,{'Content-Type':'application/json; charset=utf-8','Retry-After':String(rate.retryAfter),'Cache-Control':'no-store'});return res.end(JSON.stringify({error:'Mutation rate limit exceeded',requestId:id}));}
      return handleApi(req,res,url.pathname);
    }
    const pathname=decodeURIComponent(url.pathname),path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end('Forbidden');return;}
    const allowed=pathname==='/'||pathname==='/index.html'||pathname.startsWith('/src/')||pathname.startsWith('/services/');
    if(!allowed){res.writeHead(403).end('Forbidden');return;}
    const bytes=await readFile(path);
    res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  }catch(err){
    if(process.env.SENTINEL_X_REQUEST_LOG==='1')console.error(JSON.stringify({time:new Date().toISOString(),requestId:id,error:err.message}));
    res.writeHead(404,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify({error:'Not found',requestId:id}));
  }
});

server.requestTimeout=Math.max(5000,Number(process.env.SENTINEL_X_REQUEST_TIMEOUT_MS||15000));
server.headersTimeout=Math.max(server.requestTimeout+1000,Number(process.env.SENTINEL_X_HEADERS_TIMEOUT_MS||16000));
server.keepAliveTimeout=Math.max(1000,Number(process.env.SENTINEL_X_KEEPALIVE_TIMEOUT_MS||5000));
server.maxRequestsPerSocket=Math.max(10,Number(process.env.SENTINEL_X_MAX_REQUESTS_PER_SOCKET||1000));

server.on('error',err=>{if(err.code==='EADDRINUSE'){console.error(`Port ${port} is already in use. Stop the other process or set PORT to another local port.`);process.exit(1);}throw err;});
const stopConnectorWorker=startConnectorWorker();
const stopIngestionWorker=startIngestionWorker();
let shuttingDown=false;
function shutdown(signal){if(shuttingDown)return;shuttingDown=true;stopConnectorWorker();stopIngestionWorker();console.log(`${signal}: draining SENTINEL-X`);const force=setTimeout(()=>process.exit(1),10000);force.unref();server.close(()=>{closeDb();clearTimeout(force);process.exit(0);});}
process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));

server.listen(port,host,()=>{
  console.log('SENTINEL-X investigation service; containment remains simulated');
  console.log(`  Local:   ${tlsOptions?'https':'http'}://${host}:${port}`);
  console.log(`  Health:  http://${host}:${port}/api/health`);
  console.log(`  Ready:   http://${host}:${port}/api/ready`);
  console.log(`  Metrics: http://${host}:${port}/api/metrics`);
  if(retention.events||retention.audits||retention.snapshots)console.log(`  Retention cleanup: ${JSON.stringify(retention)}`);
});
