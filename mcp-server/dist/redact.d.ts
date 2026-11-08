/**
 * Baton Secret & Token Redaction Module
 * Client-side sanitization using regex signatures and Shannon entropy calculation.
 */
/**
 * Calculate Shannon Entropy of a string to detect randomized high-entropy tokens.
 */
export declare function calculateShannonEntropy(str: string): number;
/**
 * Scan a word for potential high-entropy secret token (length >= 20, entropy >= 4.5).
 */
export declare function isHighEntropyToken(word: string): boolean;
/**
 * Redact secrets from a single string value.
 */
export declare function redactString(text: string): string;
/**
 * Recursively redact secrets across any object, array, or scalar value.
 */
export declare function redactData<T>(data: T): T;
