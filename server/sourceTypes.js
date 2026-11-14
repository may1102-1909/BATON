export const SOURCE_TYPES = ['commit', 'pull_request', 'issue', 'branch', 'decision', 'blocker', 'task_comment', 'memory', 'interview'];

// Legacy writers (MCP, older GitHub sync, database names) are mapped explicitly; anything else is rejected.
const ALIASES = {
  mcp_decision: 'decision', mcp_blocker: 'blocker', pr: 'pull_request', context: 'memory', change: 'memory',
  bootstrap: 'memory', note: 'memory', github_evidence: 'memory', evidence: 'memory',
};

export const isSourceType = value => SOURCE_TYPES.includes(value);

export function normalizeSourceType(value) {
  const type = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return isSourceType(type) ? type : ALIASES[type] ?? null;
}

export class SourceTypeError extends Error {
  constructor(value) {
    super(`Unsupported source type "${String(value).slice(0, 40)}"; use one of ${SOURCE_TYPES.join(', ')}`);
    this.name = 'SourceTypeError';
    this.status = 400;
  }
}

export function requireSourceType(value) {
  const type = normalizeSourceType(value);
  if (!type) throw new SourceTypeError(value);
  return type;
}
