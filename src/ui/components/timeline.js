import {esc, time} from '../../lib/utils.js';
import {badge} from './badge.js';
export function eventRow(e, hot = false) {
  return `<div class="timeline-item ${hot ? 'timeline-item--active' : ''}">
    <time class="timeline-item__time">${time(e.timestamp)}</time>
    <div class="timeline-item__track"><span class="timeline-item__dot"></span></div>
    <div class="timeline-item__content">
      <div class="timeline-item__head">
        <strong>${esc(e.action)}</strong>
        ${badge(e.severity, e.severity)}
      </div>
      <small>${esc(e.id)} · ${esc(e.sourceType)}</small>
      <div class="chip-row">${(e.signals || []).map(s => badge(s, 'info')).join('')}</div>
      <details class="event-inspector"><summary>Inspect event evidence</summary><dl class="event-fields">
        ${[['Event ID',e.id],['Timestamp',e.timestamp],['Type',e.type],['Source',e.source],['Destination',e.destination],['User',e.user],['Account',e.account],['Device',e.device],['IP address',e.ip],['Asset',e.asset]].filter(([,v])=>v).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
      </dl><strong>Normalized fields</strong><pre>${esc(JSON.stringify(e.normalized||{},null,2))}</pre><strong>Redacted raw payload</strong><pre>${esc(JSON.stringify(e.raw||{},null,2))}</pre></details>
    </div>
  </div>`;
}

export function timeline(events, emptyMsg) {
  if (!events?.length) return empty(emptyMsg);
  return `<div class="timeline">${events.map(e => eventRow(e)).join('')}</div>`;
}

import {empty} from './panel.js';
