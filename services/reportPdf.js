/** Minimal, dependency-free PDF renderer for the structured incident report. */
const ascii = value => String(value ?? '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '?');
const esc = value => ascii(value).replace(/[\\()]/g, '\\$&');
const wrap = (value, width = 92) => { const words = ascii(value).split(/\s+/), lines = []; let line = ''; for (const word of words) { if ((line + ' ' + word).trim().length > width && line) { lines.push(line); line = word; } else line = (line + ' ' + word).trim(); } lines.push(line); return lines; };

export function renderReportPdf(data) {
  const lines = [], add = (title, value) => { lines.push(title.toUpperCase()); for (const line of wrap(value)) lines.push('  ' + line); lines.push(''); };
  add('SENTINEL-X incident report', `${data.incidentId} | ${data.simulation?'SIMULATION':'REAL TELEMETRY / SIMULATED RESPONSE'} | ${data.severity} | confidence ${Math.round(data.confidence * 100)}%`);
  add('Detection time', data.detectionTime || 'Unavailable');
  add('Disposition', `${data.disposition?.classification || 'Unavailable'}; ${(data.disposition?.reasons || []).join('; ')}`);
  add('Threat summary', data.threatSummary);
  add('Attack sequence', (data.attackSequence || []).map(s => `${s.name} [${s.label}; ${s.eventId}]`).join(' -> '));
  add('Timeline', (data.timeline || []).map(e => `${e.time} ${e.id}: ${e.action}`).join(' | '));
  add('Affected systems', Object.entries(data.affectedSystems || {}).map(([k, v]) => `${k}: ${v.join(', ') || 'none'}`).join(' | '));
  add('Blast radius', Object.entries(data.blastRadius || {}).map(([k, v]) => `${k} ${v}`).join(', '));
  add('Risk assessment', `${data.risk?.score}/100; ${(data.risk?.factors || []).map(f => `+${f.points} ${f.label}`).join('; ')}`);
  add('Evidence', (data.evidence || []).map(e => `${e.eventId}: ${e.observation}`).join(' | '));
  add('Correlations', (data.correlations || []).map(c => `${c.from} -> ${c.to}: ${(c.reasons || []).join(', ')}`).join(' | ') || 'None');
  add('Observed reasoning', (data.reasoning?.observed || []).join('; '));
  add('Inference', data.reasoning?.inference);
  add('Remaining uncertainty', (data.remainingUncertainty || []).join('; ') || 'Intent not independently verified');
  add('External investigations', (data.externalInvestigations||[]).map(run=>`${run.id}: ${run.queriesUsed} read-only queries; ${run.stopReason}; retrieved ${run.createdAt}; ${run.evidence?.length||0} related records`).join('; ')||'None');
  add('Response actions', (data.responseActions || []).map(a => `${a.action}: ${a.status} by ${a.actor}`).join('; ') || 'None');
  add('Human approvals', (data.humanApprovals || []).map(a => `${a.actor}: ${a.detail}`).join('; ') || 'None');
  add('Analyst notes', data.analystNotes || 'None');
  add('Feedback', (data.feedback || []).map(f => `${f.classification}: ${f.reason}`).join('; ') || 'None');
  add('Learning', `effective threshold ${data.learning?.effectiveDetectionThreshold ?? 'Unavailable'}; confirmed ${data.learning?.feedbackImpact?.confirmedAttacks || 0}; false positives ${data.learning?.feedbackImpact?.falsePositives || 0}`);
  add('Resolution status', data.resolutionStatus);
  add('Recommended follow-up', data.recommendedFollowUp);
  const chunks = []; for (let i = 0; i < lines.length; i += 55) chunks.push(lines.slice(i, i + 55));
  const objs = [], addObj = value => { objs.push(value); return objs.length; }, fontId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'), pageIds = [];
  for (const chunk of chunks) { const ops = ['BT', '/F1 10 Tf', '45 785 Td', '13 TL', ...chunk.flatMap((line, i) => [i ? 'T*' : '', `(${esc(line)}) Tj`]).filter(Boolean), 'ET'].join('\n'), stream = Buffer.from(ops, 'latin1'), contentId = addObj(`<< /Length ${stream.length} >>\nstream\n${ops}\nendstream`); pageIds.push(addObj(`<< /Type /Page /Parent PAGES /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`)); }
  const pagesId = addObj(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`); for (const id of pageIds) objs[id - 1] = objs[id - 1].replace('PAGES', `${pagesId} 0 R`); const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = '%PDF-1.4\n'; const offsets = [0]; for (let i = 0; i < objs.length; i++) { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`; } const xref = Buffer.byteLength(out, 'latin1'); out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`; for (const offset of offsets.slice(1)) out += `${String(offset).padStart(10, '0')} 00000 n \n`; out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(out, 'latin1');
}
