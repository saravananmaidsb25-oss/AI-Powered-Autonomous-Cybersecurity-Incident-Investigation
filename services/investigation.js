/** Evidence-first investigation assistant — deterministic, no hallucination. */

export function investigate(question, analysis, scenario, state = {}) {
  const q = question.toLowerCase().trim();
  if (!analysis.events?.length) {
    return {answer: 'Insufficient evidence to determine this reliably.', evidence: [], inference: null, uncertainty: 'No events observed at this historical point.'};
  }

  const ev = analysis.evidence.map(e => e.observation);
  const citations = analysis.evidence.map(e => ({id:e.eventId, observation:e.observation, source:e.source, time:e.time}));
  const observed = analysis.events.map(e => `${e.id}: ${e.action}`);
  const stages = analysis.stages.map(s => s.name).join(' → ');
  const visibleActions = (state.actions || []).filter(a => (a.step ?? Infinity) <= analysis.events.length);

  const templates = [
    {
      test: /what happened first|what came first|first observed|^first\??$/,
      answer: `First observed: ${analysis.events[0].action} (${analysis.events[0].id}) at ${analysis.events[0].timestamp}.`,
    },
    {
      test: /what happened next|what came next|attack sequence|event sequence|event order/,
      answer: `Probable attack sequence:\n${observed.join('\n↓\n')}`,
    },
    {
      test: /what should i investigate next|investigate next|next step|follow.up/,
      answer: `NEXT INVESTIGATION:\n${analysis.gaps.next.map((x,i)=>`${i+1}. ${x}`).join('\n') || 'Review the available telemetry before selecting a follow-up.'}`,
    },
    {
      test: /what happened|summary|explain/,
      answer: `THREAT: ${analysis.stages.at(-1)?.name || 'Under investigation'}\nDISPOSITION: ${analysis.disposition}\nCONFIDENCE: ${Math.round(analysis.confidence * 100)}%\n\nDISPOSITION EVIDENCE:\n${analysis.dispositionReasons.map(x=>`✓ ${x}`).join('\n')}\n\nOBSERVED EVIDENCE:\n${ev.map(x => `✓ ${x}`).join('\n')}\n\nINFERENCE:\nThe observed sequence (${stages}) is consistent with ${analysis.severity.toLowerCase()} priority activity.\n\nUNCERTAINTY:\n${analysis.gaps.unknown.join('; ') || 'Intent remains unverified.'}`,
    },
    {
      test: /sequence|order/,
      answer: `Probable attack sequence:\n${observed.join('\n↓\n')}`,
    },
    {
      test: /account|user/,
      answer: analysis.affected.accounts.length
        ? `Affected accounts: ${analysis.affected.accounts.join(', ')}. Users: ${analysis.affected.users.join(', ') || 'not fully attributed'}.`
        : 'Insufficient evidence to determine affected accounts reliably.',
    },
    {
      test: /device|endpoint/,
      answer: analysis.affected.devices.length
        ? `Observed devices: ${analysis.affected.devices.join(', ')}.`
        : 'Insufficient evidence to determine affected devices reliably.',
    },
    {
      test: /system|server|application|asset|blast|impact/,
      answer: `BLAST RADIUS (observed):\nUsers: ${analysis.affected.users.length}\nAccounts: ${analysis.affected.accounts.length}\nDevices: ${analysis.affected.devices.length}\nServers: ${analysis.affected.servers.join(', ') || 'none'}\nAssets: ${analysis.affected.assets.join(', ') || 'none'}\n\nPotential impact: ${analysis.severity}. Complete exposure unverified.`,
    },
    {
      test: /why.*flag|detect|suspicious/,
      answer: `WHY FLAGGED?\n${(analysis.contextSignals.length ? analysis.contextSignals : ['Single-event anomaly']).map(x => `✓ ${x}`).join('\n')}\n${analysis.mlSignals?.length ? analysis.mlSignals.map(x => `✓ ${x}`).join('\n') : ''}\n\nRisk ${analysis.risk}/100 · Confidence ${Math.round(analysis.confidence * 100)}%`,
    },
    {
      test: /false positive|legitimate|why not/,
      answer: `WHY IT MAY BE LEGITIMATE?\n${analysis.legitimacy.map(x => `○ ${x}`).join('\n')}\n\nThe system preserves uncertainty instead of forcing an attack classification.`,
    },
    {
      test: /evidence|support/,
      answer: `Supporting events: ${analysis.evidence.map(e => e.eventId).join(', ')}.\n\nEvidence chain:\n${analysis.stages.map(s => `${s.name} ← ${s.eventId} (${s.label})`).join('\n')}`,
    },
    {
      test: /risk|priority|high/,
      answer: `RISK SCORE: ${analysis.risk}/100\n\n${analysis.riskFactors.map(f => `+${f.points} ${f.label}`).join('\n')}\n\nTOTAL: ${analysis.risk}`,
    },
    {
      test: /action|response|taken|approve/,
      answer: `ACTIONS TAKEN:\n${visibleActions.length ? visibleActions.map(a => `${a.action}: ${a.status} by ${a.actor}; result: ${a.result}`).join('\n') : 'No response action recorded at this point.'}\n\nPOLICY RECOMMENDATION:\n${analysis.policy.policyId}: ${analysis.policy.decision}. ${analysis.policy.reason}`,
    },
    {
      test: /investigate|follow/,
      answer: `NEXT INVESTIGATION:\n${analysis.gaps.next.map((x,i)=>`${i+1}. ${x}`).join('\n') || 'Review the available telemetry before selecting a follow-up.'}`,
    },
    {
      test: /turning point|counterfactual/,
      answer: analysis.turningPoint
        ? `TURNING POINT: ${analysis.turningPoint.label} (+${analysis.turningPoint.points} risk at ${analysis.turningPoint.eventId}).\n\nCOUNTERFACTUAL (simulated): Removing this event would reduce estimated risk to ${Math.max(0, analysis.risk - analysis.turningPoint.points)}/100. This is analytical simulation, not observed evidence.`
        : 'Insufficient evidence for turning-point analysis at this historical point.',
    },
    {
      test: /gap|unknown|uncertain/,
      answer: `KNOWN:\n${analysis.gaps.known.map(x=>`✓ ${x}`).join('\n')}\n\nUNKNOWN:\n${analysis.gaps.unknown.map(x=>`? ${x}`).join('\n') || '? Intent and full context remain unverified'}`,
    },
  ];

  for (const t of templates) {
    if (t.test.test(q)) {
      return {answer: t.answer, evidence: citations, inference: stages, uncertainty: 'See UNCERTAINTY section in response.'};
    }
  }
  return {answer: 'Insufficient evidence to determine this reliably.', evidence: citations, inference: null, uncertainty: 'Question not answerable from available evidence.'};
}

export function securityBriefing(analyses, pendingApprovals) {
  const active = analyses.filter(a => a.detected);
  const critical = active.filter(a => a.severity === 'Critical');
  const assets = [...new Set(active.flatMap(a => a.affected.assets))];
  const types = active.flatMap(a => a.events.map(e => e.type));
  const count = type => types.filter(x => x === type).length;
  const emergingPatterns = [
    count('auth_failure') ? `${count('auth_failure')} authentication anomaly sequence(s)` : null,
    count('sensitive_access') ? `${count('sensitive_access')} sensitive-access event(s)` : null,
    count('outbound_transfer') ? `${count('outbound_transfer')} unusual outbound-transfer event(s)` : null,
  ].filter(Boolean);
  const priorities = [
    ...active.filter(a => ['Critical', 'High'].includes(a.severity)).map(a => `Investigate ${a.severity.toLowerCase()} risk ${a.risk}/100 with ${a.evidence.length} supporting event(s)`),
    pendingApprovals ? `Review ${pendingApprovals} pending response decision(s)` : null,
    count('outbound_transfer') ? 'Verify outbound destination ownership and exposure scope' : null,
  ].filter(Boolean);
  return {
    activeIncidents: active.length,
    criticalIncidents: critical.length,
    affectedAssets: assets,
    pendingApprovals,
    emergingPatterns,
    priorities,
    label: 'Evidence-derived administrator briefing (deterministic analysis)',
  };
}
