const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const DAY_MONTH = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b(?:,?\\s+(\\d{4})\\b)?`, 'gi');
const MONTH_DAY = new RegExp(`\\b${MONTH}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4})\\b)?`, 'gi');
const SLASH = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g;
const DEADLINE_WORDS = /\b(due|deadline|moved?|moving|pushed?|postpone[ds]?|delay(?:ed)?|slip(?:ped)?|reschedul\w*|extend\w*|ship\w*|releas\w*|launch\w*|target\w*|until|by|now|new date|shifted|rolled)\b/i;
const PRIOR_VALUE = /\b(from|was|originally|previously|instead of|not|than)\W*$/i;

const pad = number => String(number).padStart(2, '0');

function toIso(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? `${year}-${pad(month)}-${pad(day)}` : null;
}

// Relative dates ("tomorrow", "next Friday") are never parsed; ambiguous d/m vs m/d forms are skipped.
export function extractDates(text, defaultYear = new Date().getUTCFullYear()) {
  const body = String(text ?? '');
  const found = [];
  const add = (match, iso) => iso && found.push({ iso, index: match.index, raw: match[0] });
  const year = value => (value ? (value.length === 2 ? 2000 + Number(value) : Number(value)) : defaultYear);
  for (const match of body.matchAll(ISO)) add(match, toIso(Number(match[1]), Number(match[2]), Number(match[3])));
  for (const match of body.matchAll(DAY_MONTH)) add(match, toIso(year(match[3]), MONTHS.indexOf(match[2].slice(0, 3).toLowerCase()) + 1, Number(match[1])));
  for (const match of body.matchAll(MONTH_DAY)) add(match, toIso(year(match[3]), MONTHS.indexOf(match[1].slice(0, 3).toLowerCase()) + 1, Number(match[2])));
  for (const match of body.matchAll(SLASH)) {
    const [a, b] = [Number(match[1]), Number(match[2])];
    if (a > 12 && b <= 12) add(match, toIso(year(match[3]), b, a));
    else if (b > 12 && a <= 12) add(match, toIso(year(match[3]), a, b));
  }
  return found.sort((x, y) => x.index - y.index).filter((item, index, list) => !list.slice(0, index).some(other => item.index < other.index + other.raw.length && other.index < item.index + item.raw.length));
}

export function dueDate(task) {
  const value = String(task?.due_at ?? '');
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString().slice(0, 10);
}

function deadlineMentions(text, defaultYear) {
  const body = String(text ?? '');
  return extractDates(body, defaultYear).filter(item => {
    const before = body.slice(Math.max(0, item.index - 48), item.index);
    return DEADLINE_WORDS.test(`${before} ${body.slice(item.index + item.raw.length, item.index + item.raw.length + 24)}`) && !PRIOR_VALUE.test(before.slice(-16));
  });
}

const excerptAround = (text, item) => String(text).slice(Math.max(0, item.index - 60), item.index + item.raw.length + 40).replace(/\s+/g, ' ').trim();
const label = (type, kind) => kind === 'comment' ? 'Task comment' : type === 'decision' ? 'Decision' : type === 'blocker' ? 'Blocker' : 'Memory';

// Pure and deterministic: flags open tasks whose due date disagrees with a deadline date mentioned in related text.
export function detectConflicts({ tasks = [], comments = [], memories = [], sources = [] } = {}) {
  const notes = [...new Map([...memories, ...sources].filter(item => item?.id && !item.metadata?.conflict_subject && item.type !== 'task_comment').map(item => [item.id, item])).values()];
  const conflicts = [];
  for (const task of tasks) {
    const due = dueDate(task);
    if (!due || ['done', 'cancelled'].includes(task.status)) continue;
    const title = String(task.title ?? '').trim();
    const year = Number(due.slice(0, 4));
    const related = [
      ...comments.filter(comment => comment.task_id === task.id).map(comment => ({ kind: 'comment', id: comment.id, type: 'task_comment', text: comment.content })),
      ...notes.filter(note => note.metadata?.task_id === task.id || (title.length >= 4 && String(note.content ?? '').toLowerCase().includes(title.toLowerCase())))
        .map(note => ({ kind: 'source', id: note.id, type: note.type, text: note.content })),
    ];
    const sides = [];
    for (const item of related) {
      const other = deadlineMentions(item.text, year).find(mention => mention.iso !== due);
      if (!other || sides.some(side => side.ref_id === item.id)) continue;
      sides.push({ ref_type: item.kind, ref_id: item.id, label: label(item.type, item.kind), date: other.iso, excerpt: excerptAround(item.text, other) });
    }
    if (!sides.length) continue;
    const subject = `the deadline for "${title || 'untitled task'}"`;
    conflicts.push({
      id: `task_deadline:${task.id}`, kind: 'task_deadline', task_id: task.id, subject,
      summary: `Sources disagree about ${subject}: the task is due ${due}, but ${sides.map(side => `${side.label.toLowerCase()} says ${side.date}`).join('; ')}. No winner was chosen.`,
      sides: [{ ref_type: 'task', ref_id: task.id, label: 'Task due date', date: due, excerpt: `${title || 'Task'} is due ${due}` }, ...sides],
    });
  }
  return conflicts;
}
