export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

