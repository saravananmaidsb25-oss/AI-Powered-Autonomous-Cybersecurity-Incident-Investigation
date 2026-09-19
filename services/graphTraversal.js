/** Traverses observed entity associations, not inferred network reachability. */
export function traverseObservedGraph(nodes,edges,seeds,{maxDepth=6,maxNodes=200}={}){
  const allowed=new Set(nodes.map(n=>n.id)),adjacent=new Map();
  for(const edge of edges){if(!allowed.has(edge.from)||!allowed.has(edge.to))continue;for(const [a,b] of [[edge.from,edge.to],[edge.to,edge.from]]){if(!adjacent.has(a))adjacent.set(a,[]);adjacent.get(a).push({id:b,eventId:edge.eventId});}}
  const found=new Map(),queue=seeds.filter(id=>allowed.has(id)).map(id=>({id,depth:0,path:[],evidence:[]}));
  while(queue.length&&found.size<maxNodes){const current=queue.shift();if(found.has(current.id))continue;found.set(current.id,current);if(current.depth>=maxDepth)continue;for(const next of adjacent.get(current.id)||[])if(!found.has(next.id))queue.push({id:next.id,depth:current.depth+1,path:[...current.path,current.id],evidence:[...new Set([...current.evidence,next.eventId])]});}
  return {basis:'Observed event/entity associations; not proof of compromise or network access',nodes:[...found.values()],truncated:queue.length>0,maxDepth};
}
