import {esc} from '../../lib/utils.js';

export function metricCard({label, value, hint, variant = ''}) {
  return `<article class="metric-card metric-card--${variant || 'default'}">
    <span class="metric-card__label">${esc(label)}</span>
    <strong class="metric-card__value">${esc(value)}</strong>
    <span class="metric-card__hint">${esc(hint)}</span>
  </article>`;
}

export function metricGrid(items) {
  return `<div class="metric-grid">${items.map(metricCard).join('')}</div>`;
}
