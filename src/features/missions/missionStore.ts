/**
 * Browser-local mission library. Missions live in this browser's storage only;
 * JSON export is the way to keep or share a copy. Storage can be missing,
 * blocked, full or hand-edited, so every access is guarded and invalid entries
 * are skipped and reported rather than breaking the app.
 */
import { MissionFormatError, parseMissionRecord, type MissionRecord } from './missionRecord'

export const LIBRARY_KEY = 'marswalk.missions.v1'

/** The subset of the Web Storage API the library uses (injectable for tests). */
export type MissionStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface LibraryLoad {
  readonly missions: MissionRecord[]
  /** Stored entries that could not be read and were left out. */
  readonly skipped: number
  /** Set when storage itself is unavailable. */
  readonly error: string | null
}

export function browserStorage(): MissionStorage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function loadLibrary(storage: MissionStorage | null): LibraryLoad {
  if (!storage) return { missions: [], skipped: 0, error: 'Browser storage is not available, so missions cannot be saved here.' }
  let text: string | null
  try {
    text = storage.getItem(LIBRARY_KEY)
  } catch {
    return { missions: [], skipped: 0, error: 'Browser storage is blocked, so missions cannot be saved here.' }
  }
  if (text === null) return { missions: [], skipped: 0, error: null }
  let entries: unknown
  try {
    entries = JSON.parse(text)
  } catch {
    return { missions: [], skipped: 1, error: null }
  }
  if (!Array.isArray(entries)) return { missions: [], skipped: 1, error: null }
  const missions: MissionRecord[] = []
  let skipped = 0
  const seen = new Set<string>()
  for (const entry of entries) {
    try {
      const record = parseMissionRecord(entry)
      if (seen.has(record.id)) throw new MissionFormatError(['duplicate id'])
      seen.add(record.id)
      missions.push(record)
    } catch {
      skipped++
    }
  }
  return { missions, skipped, error: null }
}

/** Returns an error message, or null when the library was written. */
export function storeLibrary(storage: MissionStorage | null, missions: readonly MissionRecord[]): string | null {
  if (!storage) return 'Browser storage is not available.'
  try {
    storage.setItem(LIBRARY_KEY, JSON.stringify(missions))
    return null
  } catch (error) {
    const quota = error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)
    return quota
      ? 'Browser storage is full. Export or delete missions, then try again.'
      : 'The mission could not be written to browser storage.'
  }
}

/** Adds or replaces by id; the most recently saved mission comes first. */
export function upsertMission(missions: readonly MissionRecord[], record: MissionRecord): MissionRecord[] {
  return [record, ...missions.filter((mission) => mission.id !== record.id)]
}

export function removeMission(missions: readonly MissionRecord[], id: string): MissionRecord[] {
  return missions.filter((mission) => mission.id !== id)
}

/** An imported copy never overwrites a library entry: a clashing id gets a new one. */
export function importedCopy(missions: readonly MissionRecord[], record: MissionRecord, newId: () => string): MissionRecord {
  return missions.some((mission) => mission.id === record.id) ? { ...record, id: newId() } : record
}
