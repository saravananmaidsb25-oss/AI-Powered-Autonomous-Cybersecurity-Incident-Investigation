import {timingSafeEqual} from 'node:crypto';
import {localPrincipal} from './sessions.js';

const ranks={viewer:1,analyst:2,manager:3,admin:4};
const safeEqual=(a,b)=>{const one=Buffer.from(String(a||'')),two=Buffer.from(String(b||''));return one.length===two.length&&timingSafeEqual(one,two);};

export function authMode(){return ['proxy','local'].includes(process.env.SENTINEL_X_AUTH_MODE)?process.env.SENTINEL_X_AUTH_MODE:'demo';}
export function principalFor(req){
  if(authMode()==='local')return localPrincipal(req);
  if(authMode()==='demo')return {actor:'Demo analyst',role:'admin',tenantId:'default'};
  const configured=process.env.SENTINEL_X_PROXY_SECRET;
  if(!configured||!safeEqual(req.headers['x-sentinel-proxy-secret'],configured))return null;
  const role=String(req.headers['x-sentinel-role']||'').toLowerCase();
  const actor=String(req.headers['x-sentinel-user']||'').trim();
  const tenantId=String(req.headers['x-sentinel-tenant']||'default').trim();
  if(!ranks[role]||!actor||!tenantId)return null;
  return {actor:actor.slice(0,80),role,tenantId:tenantId.slice(0,80)};
}
export function hasRole(principal,required){return !!principal&&(ranks[principal.role]||0)>=(ranks[required]||Infinity);}
