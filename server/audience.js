import { filesOf } from './risk.js';

export const FUNCTION_ROLES = ['backend', 'frontend', 'infra', 'data', 'design', 'product'];
export const ALL_AUDIENCE = 'all';

const RULES = [
  ['infra', /(^|\/)(infra|infrastructure|terraform|k8s|kubernetes|helm|ansible|deploy|ops|\.github\/workflows)(\/|$)|(^|\/)(dockerfile|docker-compose[^/]*)$|\.tf$/i],
  ['frontend', /(^|\/)(components|pages|styles|public|ui)(\/|$)|\.(jsx|tsx|css|scss)$/i],
  ['backend', /(^|\/)(server|api|supabase|migrations|mcp-server)(\/|$)/i],
  ['data', /(^|\/)(analytics|etl|warehouse|notebooks)(\/|$)/i],
];

export const audienceForPath = path => RULES.find(([, pattern]) => pattern.test(String(path ?? '')))?.[0] ?? null;

export function cleanAudience(value) {
  const list = (Array.isArray(value) ? value : typeof value === 'string' ? [value] : [])
    .map(item => String(item).trim().toLowerCase()).filter(item => item === ALL_AUDIENCE || FUNCTION_ROLES.includes(item));
  return list.length && !list.includes(ALL_AUDIENCE) ? [...new Set(list)] : [ALL_AUDIENCE];
}

// A source is restricted only when every touched path belongs to one function; mixed or unknown paths stay open.
export function audienceFromPaths(paths) {
  const tags = new Set((paths ?? []).map(audienceForPath));
  return tags.size === 1 && !tags.has(null) ? [...tags] : [ALL_AUDIENCE];
}

export const audienceOf = source => {
  const raw = source?.audience ?? source?.metadata?.audience;
  return raw ? cleanAudience(raw) : audienceFromPaths(filesOf(source ?? {}));
};
export const canSee = (audience, role) => !role || audience.includes(ALL_AUDIENCE) || audience.includes(role);
