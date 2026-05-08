import { createHash } from 'crypto';

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

export function hashQuestionText(text: string): string {
  return createHash('sha256').update(normalizeText(text)).digest('hex');
}

export function generateReference(prefix = 'EDU'): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}
