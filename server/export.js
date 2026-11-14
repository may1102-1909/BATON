const SECTION_TITLES = {
  decisions: 'Decisions', unfinished_work: 'Unfinished work', risks: 'Risks', dependencies: 'Dependencies', next_actions: 'Next actions',
};
const SKIP_NOTE = 'Outgoing member skipped this question';
const oneLine = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const day = value => (value ? new Date(value).toISOString().slice(0, 10) : null);

// Emails are never exported: participants appear by GitHub login, falling back to a short member reference.
function person(members, userId) {
  if (!userId) return 'Unassigned';
  const member = members.find(item => item.user_id === userId);
  return member?.github_login ? `@${member.github_login}` : `Member ${String(userId).slice(0, 8)}`;
}

function sourceLabel(source) {
  const meta = source.metadata && typeof source.metadata === 'object' ? source.metadata : {};
  const title = oneLine(meta.title) || (meta.number ? `#${meta.number}` : '') || oneLine(meta.name) || oneLine(source.content).slice(0, 80) || 'untitled';
  return `${source.type} · ${title.slice(0, 120)}${source.url ? ` — ${source.url}` : ''}`;
}

export function handoverMarkdown({ detail, organization, members = [] }) {
  const { handover, sources = [], questions = [] } = detail;
  const claims = (detail.claims ?? []).filter(claim => claim.status !== 'rejected' && claim.note !== SKIP_NOTE);
  const byId = new Map(sources.map(source => [source.id, source]));
  const numbers = new Map();
  const cite = ids => (ids ?? []).filter(id => byId.has(id)).map(id => {
    if (!numbers.has(id)) numbers.set(id, numbers.size + 1);
    return `[S${numbers.get(id)}]`;
  }).join(' ');

  const lines = [`# Handover${organization?.name ? ` — ${oneLine(organization.name)}` : ''}`, ''];
  lines.push(`- **Outgoing:** ${person(members, handover.leaver_id)}`, `- **Incoming:** ${person(members, handover.incoming_id)}`, `- **Status:** ${handover.status}`);
  for (const [label, value] of [['Created', handover.created_at], ['Approved', handover.approved_at], ['Acknowledged', handover.acknowledged_at]]) if (day(value)) lines.push(`- **${label}:** ${day(value)}`);
  if (handover.generation_mode) lines.push(`- **Generation mode:** ${handover.generation_mode}`);
  lines.push('');

  for (const [section, title] of Object.entries(SECTION_TITLES)) {
    const items = claims.filter(claim => claim.section === section);
    if (!items.length) continue;
    lines.push(`## ${title}`, '');
    for (const claim of items) lines.push(`- ${oneLine(claim.text)} _(${claim.confidence ?? 'inferred'})_ ${cite(claim.source_ids)}`.trimEnd());
    lines.push('');
  }

  const resolved = (detail.conflicts ?? []).filter(conflict => conflict.resolved);
  if (resolved.length) {
    lines.push('## Resolved conflicts', '');
    for (const conflict of resolved) {
      lines.push(`- **${oneLine(conflict.subject)}** — ${oneLine(conflict.resolution)} ${cite([...(conflict.sides ?? []).map(side => side.source_id), conflict.chosen_source_id])}`.trimEnd());
    }
    lines.push('');
  }

  const answered = questions.filter(question => !question.asked_by && question.status === 'answered' && oneLine(question.answer));
  if (answered.length) {
    lines.push('## Exit interview', '');
    for (const question of answered) {
      const risk = question.risk_label ?? question.risk;
      lines.push(`### ${oneLine(question.question_text)}${risk ? ` _(${risk} risk)_` : ''}`, '', `${oneLine(question.answer)} ${cite(question.source_ids)}`.trimEnd(), '');
    }
  }

  const gaps = questions.filter(question => !question.asked_by && ['skipped', 'open'].includes(question.status));
  if (gaps.length) {
    lines.push('## Known gaps', '');
    for (const question of gaps) lines.push(`- ${oneLine(question.question_text)} _(${question.status === 'skipped' ? 'skipped by the outgoing member' : 'unanswered'})_ ${cite(question.source_ids)}`.trimEnd());
    lines.push('');
  }

  if (numbers.size) {
    lines.push('## Sources', '');
    for (const [id, number] of numbers) lines.push(`- [S${number}] ${sourceLabel(byId.get(id))}`);
    lines.push('');
  }
  return lines.join('\n');
}
