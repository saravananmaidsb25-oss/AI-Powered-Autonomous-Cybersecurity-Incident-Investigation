import {esc} from '../../lib/utils.js';

export function panel(title, content, aside = '') {
  return `<section class="card">
    <header class="card__header">
      <h2 class="card__title">${esc(title)}</h2>
      ${aside ? `<div class="card__aside">${aside}</div>` : ''}
    </header>
    <div class="card__body">${content}</div>
  </section>`;
}

export function empty(message = 'No data available.') {
  return `<div class="empty-state"><div class="empty-state__icon">◇</div><p>${esc(message)}</p></div>`;
}
