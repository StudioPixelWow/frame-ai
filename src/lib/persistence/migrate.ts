/**
 * PixelFrameAI — Schema Version Migration
 *
 * Upgrades any persisted state version to the current version.
 * Called on every project load, before loadProjectState() processes the data.
 *
 * Rules:
 * - Never remove fields — mark them optional and stop reading them.
 * - Write a migration step for every version bump.
 * - Migrations run in sequence: v1 → v2 → v3 → ... → current.
 */

import {
  CURRENT_SCHEMA_VERSION,
  type ProjectPersistedState,
} from "@/types/persistence";

/**
 * Upgrade any persisted state version to the current schema.
 *
 * @param raw  The raw wizard_state from the DB (unknown shape/version).
 * @returns    A ProjectPersistedState at the current schemaVersion.
 * @throws     If the state is newer than the current client version.
 */
export function migratePersistedState(raw: unknown): ProjectPersistedState {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid persisted state: expected an object");
  }

  let state = raw as Record<string, unknown>;

  const version = (state.schemaVersion as number) ?? 1;

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Persisted state version ${version} is newer than client version ${CURRENT_SCHEMA_VERSION}. Please refresh the page.`,
    );
  }

  // v1 → v2: speechLanguage was called speechLang
  if (version === 1) {
    state = {
      ...state,
      speechLanguage: (state as any).speechLang ?? null,
      schemaVersion: 2,
    };
    delete state.speechLang;
  }

  // v2 → v3: segmentStatus added (was absent in v2)
  if ((state.schemaVersion as number) === 2) {
    state = {
      ...state,
      segmentStatus: state.segmentStatus ?? {},
      schemaVersion: 3,
    };
  }

  // Add future migrations here:
  // if ((state.schemaVersion as number) === 3) {
  //   state = { ...state, newField: defaultValue, schemaVersion: 4 };
  // }

  return state as unknown as ProjectPersistedState;
}

/**
 * Check whether a persisted state needs migration.
 */
export function needsMigration(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return true;
  const version = (raw as Record<string, unknown>).schemaVersion as number;
  return !version || version < CURRENT_SCHEMA_VERSION;
}
