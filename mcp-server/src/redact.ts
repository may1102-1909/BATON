/**
 * Baton Secret & Token Redaction Module
 * Client-side sanitization using regex signatures and Shannon entropy calculation.
 */

// Common high-risk patterns
const SECRET_PATTERNS: { name: string; pattern: RegExp; replacement: string }[] = [
  // JSON Web Tokens (JWT)
  {
    name: 'JWT',
    pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
    replacement: '[REDACTED_JWT]'
  },
  // OpenAI API Keys (legacy and project-scoped)
  {
    name: 'OPENAI_API_KEY',
    pattern: /sk-(?:proj-)?[a-zA-Z0-9_-]{32,}/g,
    replacement: '[REDACTED_OPENAI_KEY]'
  },
  // GitHub Personal Access & OAuth Tokens
  {
    name: 'GITHUB_TOKEN',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,255}/g,
    replacement: '[REDACTED_GITHUB_TOKEN]'
  },
  // AWS Access Key ID
  {
    name: 'AWS_ACCESS_KEY',
    pattern: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    replacement: '[REDACTED_AWS_KEY]'
  },
  // Stripe API Keys
  {
    name: 'STRIPE_SECRET_KEY',
    pattern: /(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{24,}/g,
    replacement: '[REDACTED_STRIPE_KEY]'
  },
  // Slack Tokens
  {
    name: 'SLACK_TOKEN',
    pattern: /xox[baprs]-[0-9a-zA-Z-]{10,48}/g,
    replacement: '[REDACTED_SLACK_TOKEN]'
  },
  // RSA/EC/PGP Private Keys
  {
    name: 'PRIVATE_KEY',
    pattern: /-----BEGIN(?: [A-Z0-9_-]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z0-9_-]+)? PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]'
  },
  // Connection Strings with passwords
  {
    name: 'DB_CONNECTION_STRING',
    pattern: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^:\s]+:([^@\s]+)@[^\s]+/gi,
    replacement: '[REDACTED_DB_CREDENTIALS]'
  },
  // Generic key-value assignments for secrets
  {
    name: 'KEY_VALUE_SECRET',
    pattern: /(?:api[_-]?key|secret(?:[_-]?key)?|auth(?:[_-]?token)?|password|access[_-]?token)\s*[:=]\s*["']?([a-zA-Z0-9_\-\.\/+=]{16,})["']?/gi,
    replacement: '$1: "[REDACTED_SECRET]"'
  }
];

/**
 * Calculate Shannon Entropy of a string to detect randomized high-entropy tokens.
 */
export function calculateShannonEntropy(str: string): number {
  if (!str || str.length === 0) return 0;

  const frequencies = new Map<string, number>();
  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }

  let entropy = 0;
  const len = str.length;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Scan a word for potential high-entropy secret token (length >= 20, entropy >= 4.5).
 */
export function isHighEntropyToken(word: string): boolean {
  // Strip common punctuation
  const cleaned = word.replace(/^[^\w]+|[^\w]+$/g, '');
  if (cleaned.length < 24) return false;

  // Check character diversity (letters, numbers, special characters)
  const hasUpper = /[A-Z]/.test(cleaned);
  const hasLower = /[a-z]/.test(cleaned);
  const hasDigit = /[0-9]/.test(cleaned);

  const diversity = (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) + (hasDigit ? 1 : 0);
  if (diversity < 2) return false;

  const entropy = calculateShannonEntropy(cleaned);
  // High randomness threshold (standard base64/hex tokens typically > 4.5)
  return entropy >= 4.5;
}

/**
 * Redact secrets from a single string value.
 */
export function redactString(text: string): string {
  if (typeof text !== 'string') return text;

  let redacted = text;

  // 1. Apply regex pattern replacements
  for (const rule of SECRET_PATTERNS) {
    redacted = redacted.replace(rule.pattern, rule.replacement);
  }

  // 2. Scan individual words for high-entropy tokens not caught by explicit rules
  const words = redacted.split(/\s+/);
  const sanitizedWords = words.map((w) => {
    if (w.startsWith('[REDACTED_')) return w;
    if (isHighEntropyToken(w)) {
      return '[REDACTED_HIGH_ENTROPY_TOKEN]';
    }
    return w;
  });

  return sanitizedWords.join(' ');
}

/**
 * Recursively redact secrets across any object, array, or scalar value.
 */
export function redactData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return redactString(data) as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactData(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Check if key itself indicates a sensitive value
      const lowerKey = key.toLowerCase();
      const isSensitiveKey =
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('auth');

      if (isSensitiveKey && typeof value === 'string' && value.length > 0) {
        result[key] = '[REDACTED_SECRET_KEY_VALUE]';
      } else {
        result[key] = redactData(value);
      }
    }
    return result as unknown as T;
  }

  return data;
}
