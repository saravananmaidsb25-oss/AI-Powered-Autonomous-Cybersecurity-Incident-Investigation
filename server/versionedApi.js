/** Compatibility routing while the existing client migrates incrementally. */
export function versionedPath(path){
  if(!path.startsWith('/api/v1/')||/^\/api\/v1\/(auth|telemetry)(\/|$)/.test(path))return path;
  const parts=path.split('/').filter(Boolean),aliases={assets:'entities',policies:'policy',reports:'report',responses:'actions',intelligence:'dashboard',risk:'risk', 'attack-graphs':'attack-graphs'};
  return '/api/'+[aliases[parts[2]]||parts[2],...parts.slice(3)].join('/');
}
export function pageParameters(url){
  const limit=Number(url.searchParams.get('limit')||50),offset=Number(url.searchParams.get('offset')||0);
  if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>100000)throw Object.assign(Error('Pagination requires limit 1–100 and a nonnegative offset'),{status:400});
  return {limit,offset};
}
