const rules = [
  /-----BEGIN(?: [A-Z0-9_-]+)* PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z0-9_-]+)* PRIVATE KEY-----/g,
  /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}|(?:AKIA|ASIA)[A-Z0-9]{16}|(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g,
  /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@]+:[^\s@]+@[^\s]+/gi,
  /\b(?:api[_-]?key|secret(?:[_-]?key)?|authorization|auth[_-]?token|password|access[_-]?token)\s*[:=]\s*["']?[^\s,"';}]+["']?/gi,
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
];
export function redactString(value) {
  let text = String(value);
  for (const pattern of rules) text = text.replace(pattern, '[REDACTED]');
  return text.replace(/\b[A-Za-z0-9_+/=-]{28,}\b/g, (word) => {
    // Preserve hashes used as evidence identifiers, not opaque credentials.
    if (/^[a-f0-9]{32,64}$/i.test(word) || !/[A-Z]/.test(word) || !/[a-z]/.test(word) || !/[0-9]/.test(word)) return word;
    const frequencies = [...word].reduce((counts, char) => (counts[char] = (counts[char] || 0) + 1, counts), {});
    const entropy = Object.values(frequencies).reduce((sum, n) => sum - n / word.length * Math.log2(n / word.length), 0);
    return entropy >= 4.5 ? '[REDACTED]' : word;
  });
}
export function redactData(value) {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(redactData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /(?:password|secret|token|api[_-]?key|authorization|private[_-]?key)/i.test(key) ? '[REDACTED]' : redactData(item)]));
  return value;
}
