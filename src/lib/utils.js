export const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export const time = x => x ? new Date(x).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC'}) : '—';

export function download(name, content, type) {
  const blob = new Blob([content], {type});
  downloadBlob(name, blob);
}

export function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
