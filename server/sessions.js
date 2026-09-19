import {randomBytes,randomUUID,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {getDb} from './db.js';
const derive=promisify(scrypt),db=getDb();
db.exec(`CREATE TABLE IF NOT EXISTS local_users (
 tenant_id TEXT NOT NULL, username TEXT NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL,
 PRIMARY KEY(tenant_id,username));
 CREATE TABLE IF NOT EXISTS auth_sessions (
 access_hash TEXT PRIMARY KEY, refresh_hash TEXT NOT NULL UNIQUE, family TEXT NOT NULL, tenant_id TEXT NOT NULL,
 username TEXT NOT NULL, access_expires INTEGER NOT NULL, refresh_expires INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0);`);
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>Object.assign(Error(message),{status});
const cookie=(req,name)=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';
export async function createLocalUser({tenantId,username,role,password}){
  if(!/^[a-zA-Z0-9_-]{1,60}$/.test(tenantId||'')||!/^\S{3,100}$/.test(username||'')||!['viewer','analyst','manager','admin'].includes(role)||typeof password!=='string'||password.length<12||password.length>256)throw fail(400,'Valid organization, username, role and 12–256 character password required');
  const salt=randomBytes(16).toString('hex'),key=await derive(password,salt,64);
  try{db.prepare('INSERT INTO local_users VALUES (?,?,?,?,?)').run(tenantId,username,role,key.toString('hex'),salt);}catch{throw fail(409,'User already exists');}
  return {tenantId,username,role};
}
export function localPrincipal(req){
  const token=cookie(req,'sentinel_access');if(!token)return null;
  const row=db.prepare('SELECT s.tenant_id,s.username,u.role FROM auth_sessions s JOIN local_users u ON u.tenant_id=s.tenant_id AND u.username=s.username WHERE access_hash=? AND revoked=0 AND used=0 AND access_expires>?').get(hash(token),Date.now());
  return row?{tenantId:row.tenant_id,actor:row.username,role:row.role}:null;
}
function setCookies(res,access,refresh,clear=false){
  const secure=process.env.SENTINEL_X_SECURE_COOKIES==='1'?'; Secure':'';
  res.setHeader('Set-Cookie',[`sentinel_access=${access}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear?0:900}${secure}`,`sentinel_refresh=${refresh}; Path=/api/v1/auth; HttpOnly; SameSite=Strict; Max-Age=${clear?0:604800}${secure}`]);
}
function issue(res,tenant,username,family=randomUUID()){
  const access=randomBytes(32).toString('hex'),refresh=randomBytes(32).toString('hex'),now=Date.now();
  db.prepare('INSERT INTO auth_sessions VALUES (?,?,?,?,?,?,?,?,?)').run(hash(access),hash(refresh),family,tenant,username,now+900000,now+604800000,0,0);
  setCookies(res,access,refresh);return {authenticated:true,expiresIn:900};
}
export async function loginLocal(res,{tenantId='default',username,password},allowedTenants){
  if(typeof password!=='string'||password.length>256||typeof username!=='string'||!allowedTenants.has(tenantId))throw fail(401,'Invalid credentials');
  const row=db.prepare('SELECT * FROM local_users WHERE tenant_id=? AND username=?').get(tenantId,username);
  const supplied=await derive(password,row?.salt||'dummy-sentinel-auth-salt',64);
  if(!row||!timingSafeEqual(supplied,Buffer.from(row.password_hash,'hex')))throw fail(401,'Invalid credentials');
  return issue(res,tenantId,username);
}
export function refreshLocal(req,res){
  const row=db.prepare('SELECT * FROM auth_sessions WHERE refresh_hash=?').get(hash(cookie(req,'sentinel_refresh')));
  if(!row||row.revoked||row.refresh_expires<Date.now())throw fail(401,'Refresh session expired');
  if(row.used){db.prepare('UPDATE auth_sessions SET revoked=1 WHERE family=?').run(row.family);setCookies(res,'','',true);throw fail(401,'Refresh token reuse detected; sign in again');}
  db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE auth_sessions SET used=1 WHERE access_hash=?').run(row.access_hash);const result=issue(res,row.tenant_id,row.username,row.family);db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}
}
export function logoutLocal(req,res){
  const row=db.prepare('SELECT family FROM auth_sessions WHERE refresh_hash=? OR access_hash=?').get(hash(cookie(req,'sentinel_refresh')),hash(cookie(req,'sentinel_access')));
  if(row)db.prepare('UPDATE auth_sessions SET revoked=1 WHERE family=?').run(row.family);
  setCookies(res,'','',true);return {authenticated:false};
}
