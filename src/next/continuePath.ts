// Where to go after signing in. Only an address on this site counts ("/founders"), never another
// site ("//evil.example", "https://…"), so a crafted sign-in link can't send someone elsewhere.
export function safeContinuePath(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}
