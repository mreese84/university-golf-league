// Readable, permanent IDs for people and chapters

// "José Núñez Jr." -> "jose-nunez-jr"
export function slugify(text: string) {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // drop accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// A new person's ID from their name, with -2, -3… when it's taken ("mark-reese", "mark-reese-2")
export function personIdFor(name: string, taken: Iterable<string>) {
  const used = new Set(taken);
  const base = slugify(name) || 'person';
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

// Words the app's addresses use, which a chapter's address can't be (/admin, /me, /profiles/…)
const RESERVED = new Set([
  'admin', 'api', 'assets', 'badges', 'envs', 'finish-sign-in', 'guide', 'history', 'join', 'login', 'me', 'move-over',
  'new', 'next', 'players', 'profiles', 'request', 'signin', 'superlatives',
]);

// A chapter's ID is its address: /founders. It starts with a letter, so it never looks like an old
// trip address (/2026-columbia/guide).
export function isValidChapterId(id: string) {
  return /^[a-z][a-z0-9-]{1,39}$/.test(id) && !id.endsWith('-') && !RESERVED.has(id);
}

// A new chapter's address from its name ("Austin Crew" -> "austin-crew"): starts with a letter, at
// most 40 characters, never one of the app's words, and unique (-2, -3… when taken)
export function chapterIdFor(name: string, taken: Iterable<string>) {
  const used = new Set(taken);
  let base = slugify(name).slice(0, 34).replace(/-+$/, '');
  if (!/^[a-z]/.test(base)) base = `chapter-${base}`.replace(/-+$/, '');
  if (!isValidChapterId(base)) base = `${base}-chapter`;
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}
