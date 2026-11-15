import { useState } from 'react'
import { downloadJson } from '../../lib/downloadJson'
import {
  browserStorage,
  importedCopy,
  loadLibrary,
  removeMission,
  storeLibrary,
  upsertMission,
} from './missionStore'
import { MissionFormatError, missionFileName, missionFileSizeError, parseMissionRecord, type MissionRecord } from './missionRecord'

export type LibraryResult = { readonly ok: true; readonly record: MissionRecord } | { readonly ok: false; readonly message: string }

/** The saved-mission list for this browser, kept in sync with storage. */
export function useMissionLibrary() {
  const [storage] = useState(browserStorage)
  const [initial] = useState(() => loadLibrary(storage))
  const [missions, setMissions] = useState<MissionRecord[]>(initial.missions)

  /** Writes first; the list only changes when storage accepted it. */
  const commit = (next: MissionRecord[]): string | null => {
    const error = storeLibrary(storage, next)
    if (!error) setMissions(next)
    return error
  }

  return {
    missions,
    skipped: initial.skipped,
    storageError: initial.error,
    save(record: MissionRecord): LibraryResult {
      const error = commit(upsertMission(missions, record))
      return error ? { ok: false, message: error } : { ok: true, record }
    },
    remove(id: string): string | null {
      return commit(removeMission(missions, id))
    },
    exportFile(record: MissionRecord) {
      downloadJson(missionFileName(record), record)
    },
    async importFile(file: File): Promise<LibraryResult> {
      const sizeError = missionFileSizeError(file.name, file.size)
      if (sizeError) return { ok: false, message: sizeError }
      let input: unknown
      try {
        input = JSON.parse(await file.text())
      } catch {
        return { ok: false, message: `${file.name} is not a JSON file.` }
      }
      let record: MissionRecord
      try {
        record = parseMissionRecord(input)
      } catch (error) {
        const detail = error instanceof MissionFormatError ? error.issues.join('; ') : String(error)
        return { ok: false, message: `${file.name} could not be imported: ${detail}.` }
      }
      const copy = importedCopy(missions, record, () => crypto.randomUUID())
      const error = commit(upsertMission(missions, copy))
      return error ? { ok: false, message: error } : { ok: true, record: copy }
    },
  }
}
export type MissionLibraryController = ReturnType<typeof useMissionLibrary>
