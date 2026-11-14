export const GEMINI_MODEL_DEFAULT = 'gemini-2.5-flash';
export const EMBEDDING_MODEL = 'text-embedding-004';

// Single source of truth for the generation model; GEMINI_MODEL overrides the default.
export function geminiModel(env = process.env) {
  const model = String(env?.GEMINI_MODEL ?? '').trim() || GEMINI_MODEL_DEFAULT;
  if (!/^[A-Za-z0-9._-]+$/.test(model)) throw Object.assign(new Error('Invalid GEMINI_MODEL'), { status: 400 });
  return model;
}

export const geminiGenerateUrl = env => `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel(env)}:generateContent`;
