import {trustedEndpoint,fetchJson} from './externalHttp.js';
import {normalizeTelemetry} from './telemetry.js';

export function wazuhConfig() {
  const configured=Boolean(process.env.SENTINEL_X_WAZUH_URL&&process.env.SENTINEL_X_WAZUH_USER&&process.env.SENTINEL_X_WAZUH_PASSWORD);
  if(!configured)return null;
  const endpoint=trustedEndpoint(process.env.SENTINEL_X_WAZUH_URL);
  const index=process.env.SENTINEL_X_WAZUH_INDEX||'wazuh-alerts-*';
  if(!/^[a-z0-9_.*-]+$/.test(index)||index.startsWith('.'))throw Error('Invalid Wazuh alert index');
  return {endpoint,index,headers:{Authorization:`Basic ${Buffer.from(`${process.env.SENTINEL_X_WAZUH_USER}:${process.env.SENTINEL_X_WAZUH_PASSWORD}`).toString('base64')}`}};
}
export function mapWazuh(hit) {
  const s=hit?._source;
  if(!s||!hit._id||!hit._index)throw Error('Malformed Wazuh search hit');
  const groups=Array.isArray(s.rule?.groups)?s.rule.groups:[],win=s.data?.win?.eventdata||{};
  const type=groups.includes('authentication_failed')?'auth_failure':groups.includes('authentication_success')?'auth_success':'endpoint_alert';
  return normalizeTelemetry({event_id:`${hit._index}/${hit._id}`,timestamp:s.timestamp,event_type:type,source_type:type.startsWith('auth_')?'authentication':'endpoint',user_id:s.data?.srcuser||s.data?.dstuser||win.targetUserName,device_id:s.agent?.name,source_ip:s.data?.srcip||win.ipAddress,action:s.rule?.description||'Wazuh security alert',severity:String(s.rule?.level??'unknown'),normalized:{failures:type==='auth_failure'?1:0},raw_data:{rule:s.rule,agent:s.agent,data:s.data,decoder:s.decoder}},{source:'wazuh',scenario:'wazuh'});
}
export async function queryWazuh({from,until,offset=0,limit=100,entity,signal}={}) {
  const config=wazuhConfig();if(!config)throw Object.assign(Error('Wazuh connector is not configured'),{status:503});
  if(!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(until))||Date.parse(from)>Date.parse(until))throw Error('Invalid Wazuh time window');
  const filters=[{range:{timestamp:{gte:from,lte:until}}}];
  if(entity){const fields={device:'agent.name',account:'data.dstuser',ip:'data.srcip'};if(!fields[entity.kind]||typeof entity.value!=='string')throw Error('Unsupported investigation entity');filters.push({match_phrase:{[fields[entity.kind]]:entity.value}});}
  const body={size:Math.min(100,limit),from:offset,sort:[{timestamp:'asc'}],query:{bool:{filter:filters}}};
  const response=await fetchJson(new URL(`/${config.index}/_search`,config.endpoint),{headers:config.headers,body,signal});
  if(response.timed_out||response._shards?.failed>0)throw Error('Wazuh query returned incomplete shard results');
  if(!Array.isArray(response.hits?.hits))throw Error('Invalid Wazuh search response');
  const events=response.hits.hits.map(mapWazuh);
  // Enforce the requested historical boundary even if the upstream returns bad data.
  if(events.some(e=>Date.parse(e.timestamp)<Date.parse(from)||Date.parse(e.timestamp)>Date.parse(until)))throw Error('Wazuh returned evidence outside requested time window');
  return {events,hasMore:events.length===body.size,query:{from,until,offset,limit:body.size,entity:entity||null}};
}
