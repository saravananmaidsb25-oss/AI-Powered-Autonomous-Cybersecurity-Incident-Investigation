import {esc} from '../../lib/utils.js';

export function badge(label, variant = '') {
  const v = variant.toLowerCase().replace(/\s+/g, '-');
  return `<span class="badge badge--${v || 'default'}">${esc(label)}</span>`;
}
