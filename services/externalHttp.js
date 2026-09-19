/** Server-configured destinations only. Never forward credentials on redirects. */
export function trustedEndpoint(value) {
  const url=new URL(value);
  if(url.username||url.password||url.search||url.hash)throw Error('Endpoint must not contain credentials, query or fragment');
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw Error('External endpoints require HTTPS');
  return url;
}

export async function fetchJson(url,{headers={},body,signal,timeoutMs=5000,maxBytes=2_000_000,method='POST'}={}) {
  const deadline=AbortSignal.timeout(Math.max(100,Math.min(15000,timeoutMs)));
  const response=await fetch(url,{method,headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:signal?AbortSignal.any([signal,deadline]):deadline});
  if(!response.ok){await response.body?.cancel();throw Object.assign(Error(`External service HTTP ${response.status}`),{upstreamStatus:response.status});}
  let size=0;const chunks=[];
  for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes)throw Error('External response exceeds size limit');chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
