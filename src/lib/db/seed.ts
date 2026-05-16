/**
 * Seed guard — no-op stubs kept for API compatibility.
 * SupabaseCrud-backed collections persist data durably across deploys.
 * To load demo data use POST /api/data/seed.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _seeded = false;

export function ensureSeeded(): void {
  _seeded = true;
}

export async function seedIfEmpty(): Promise<void> {
  // no-op
}

export function resetSeed(): void {
  // no-op — kept for API compatibility
}
