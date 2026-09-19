/** Interactive SVG attack graph — light theme optimized. */

export function renderAttackGraph(container, nodes, edges, highlightIds = new Set(), options={}) {
  if (!nodes.length) {
    container.innerHTML = '<div class="empty-state"><p>Entities appear as events are observed.</p></div>';
    return;
  }

  const query=String(options.query||'').trim().toLowerCase(),zoom=Number(options.zoom||1);const visibleNodes=query?nodes.filter(n=>String(n.label).toLowerCase().includes(query)||String(n.kind).toLowerCase().includes(query)):nodes;
  if(query&&!visibleNodes.length){container.innerHTML='<div class="empty-state"><p>No entity matches this search.</p></div>';return;}
  nodes=visibleNodes;const visibleIds=new Set(nodes.map(n=>n.id));edges=edges.filter(e=>visibleIds.has(e.from)&&visibleIds.has(e.to));
  const W = Math.max(560, container.clientWidth || 560);
  const H = 340;
  const positions = layoutNodes(nodes, W, H);

  const lines = edges.map(e => {
    const a = positions[e.from];
    const b = positions[e.to];
    if (!a || !b) return '';
    const hot = highlightIds.has(e.eventId);
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="graph-edge ${hot ? 'graph-edge--hot' : ''}"/>`;
  }).join('');

  const entities = nodes.map(n => {
    const p = positions[n.id];
    const hot = (n.meta?.evidence || []).some(id => highlightIds.has(id));
    const meta = n.meta || {};
    const kindColors = {user: '#2563eb', account: '#7c3aed', device: '#0891b2', ip: '#64748b', asset: '#dc2626', source: '#059669', destination: '#d97706'};
    const color = kindColors[n.kind] || '#475569';
    return `<g class="graph-node ${hot ? 'graph-node--hot' : ''}" transform="translate(${p.x},${p.y})" tabindex="0" role="group" aria-label="${escape(`${n.kind} ${n.label}`)}">
      <title>${escape(`${n.kind}: ${n.label}; evidence ${(meta.evidence||[]).join(', ')}; latest ${meta.timestamp}; confidence ${Math.round((meta.confidence||0)*100)}%; risk contribution ${meta.risk}; relationship ${meta.relationship}`)}</title>
      <circle r="26" fill="#fff" stroke="${color}" stroke-width="${hot ? 3 : 2}" class="graph-node__circle"/>
      <text y="-32" class="graph-node__kind" fill="${color}">${escape(n.kind)}</text>
      <text y="5" class="graph-node__label">${escape(truncate(n.label, 16))}</text>
      ${meta.risk ? `<text y="22" class="graph-node__risk">+${meta.risk}</text>` : ''}
    </g>`;
  }).join('');

  const viewW=W/zoom,viewH=H/zoom,x=(W-viewW)/2,y=(H-viewH)/2;container.innerHTML = `<svg viewBox="${x} ${y} ${viewW} ${viewH}" class="attack-graph" role="img" aria-label="Attack graph digital twin">${lines}${entities}</svg>`;
}

function layoutNodes(nodes, W, H) {
  const positions = {};
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const padX = 80;
  const padY = 60;
  const cellW = (W - padX * 2) / Math.max(cols - 1, 1);
  const cellH = (H - padY * 2) / Math.max(Math.ceil(nodes.length / cols) - 1, 1);
  nodes.forEach((n, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[n.id] = {x: padX + col * cellW, y: padY + row * cellH};
  });
  return positions;
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function escape(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
