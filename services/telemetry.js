import {createHash,timingSafeEqual} from 'node:crypto';
import {normalize,STAGES} from '../src/engine.js';

export const invalid=message=>Object.assign(Error(message),{status:400});
const text=(value,name,required=false)=>{
  if(value==null&&!required)return null;
  if(typeof value!=='string'||!value.trim()||value.length>500||/[\u0000-\u001f]/.test(value))throw invalid(`Invalid ${name}`);
  return value.trim();
};
export function telemetryAuthorized(req) {
  const expected=process.env.SENTINEL_X_TELEMETRY_TOKEN;
  const supplied=String(req.headers.authorization||'').replace(/^Bearer /,'');
  if(!expected||expected.length<32)return false;
  const a=Buffer.from(expected),b=Buffer.from(supplied);
  return a.length===b.length&&timingSafeEqual(a,b);
}
export function normalizeTelemetry(input,{source='authenticated-push',scenario='telemetry'}={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw invalid('Event object required');
  const id=text(input.event_id??input.id,'event_id',true),timestamp=text(input.timestamp,'timestamp',true);
  if(!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(timestamp)||!Number.isFinite(Date.parse(timestamp)))throw invalid('Timestamp must include a timezone');
  const aliases={authentication_failure:'auth_failure',authentication_success:'auth_success',security_alert:'endpoint_alert'};
  const type=aliases[input.event_type]||input.event_type||input.type;
  if(!Object.hasOwn(STAGES,type))throw invalid('Unsupported event_type');
  const values=input.normalized||{};
  for(const key of ['bytes','failures'])if(values[key]!=null&&(!Number.isFinite(values[key])||values[key]<0))throw invalid(`Invalid normalized.${key}`);
  const raw=input.raw_data??input.raw??{};
  if(typeof raw!=='object'||Array.isArray(raw)||raw===null)throw invalid('raw_data must be an object');
  // Source severity is retained as evidence, never trusted as a risk contribution.
  const mapped={id:`${source}:${createHash('sha256').update(id).digest('hex').slice(0,32)}`,timestamp:new Date(timestamp).toISOString(),type,sourceType:input.source_type||input.sourceType,
    user:text(input.user_id??input.user,'user_id'),account:text(input.account??input.user_id,'account'),device:text(input.device_id??input.device,'device_id'),ip:text(input.source_ip??input.ip,'source_ip'),asset:text(input.asset_id??input.asset,'asset_id'),destination:text(input.destination,'destination'),source,
    action:text(input.action,'action',true),severity:'medium',raw,normalized:{...values,location:text(values.location,'location')},metadata:{simulation:false,scenario,connector:source,sourceEventId:id,sourceSeverity:text(input.severity,'severity'),receivedAt:new Date().toISOString()}};
  try{return normalize(mapped);}catch(e){throw invalid(e.message);}
}
