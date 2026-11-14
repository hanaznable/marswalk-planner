import { useRef, useState, type FormEvent } from 'react'
import { MAX_NAME_LENGTH, normaliseName, type MissionRecord } from './missionRecord'

export interface MissionStatus {
  readonly tone: 'info' | 'warning' | 'error'
  readonly text: string
  readonly details?: readonly string[]
}

interface MissionLibraryProps {
  missions: readonly MissionRecord[]
  /** Library entry currently open in the planner, if any. */
  active: { readonly id: string; readonly name: string } | null
  canSave: boolean
  saveHint: string
  /** True when opening another mission would replace waypoints on the map. */
  hasPlan: boolean
  status: MissionStatus | null
  skipped: number
  storageError: string | null
  opening: boolean
  onSave: (name: string, asNew: boolean) => void
  onOpen: (record: MissionRecord) => void
  onExport: (record: MissionRecord) => void
  onDelete: (record: MissionRecord) => void
  onImport: (file: File) => void
}

const savedLabel = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }) + ' UTC'

/** Save, reopen, export and import named missions (browser-local). */
export function MissionLibrary(props: MissionLibraryProps) {
  const { missions, active, canSave, status } = props
  const [draft, setDraft] = useState<{ forId: string | null; name: string }>({ forId: active?.id ?? null, name: active?.name ?? '' })
  // Follow the open mission's name until the user types something else.
  const name = draft.forId === (active?.id ?? null) ? draft.name : (active?.name ?? '')
  const [confirm, setConfirm] = useState<{ id: string; action: 'open' | 'delete' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const storageReady = props.storageError === null
  const valid = normaliseName(name).length > 0

  const save = (asNew: boolean) => (event?: FormEvent) => {
    event?.preventDefault()
    if (!valid || !canSave || !storageReady) return
    props.onSave(name, asNew)
    setDraft({ forId: null, name: '' })
  }

  const open = (record: MissionRecord) => {
    if (props.hasPlan && record.id !== active?.id && !(confirm?.id === record.id && confirm.action === 'open')) {
      setConfirm({ id: record.id, action: 'open' })
      return
    }
    setConfirm(null)
    props.onOpen(record)
  }

  const remove = (record: MissionRecord) => {
    if (!(confirm?.id === record.id && confirm.action === 'delete')) {
      setConfirm({ id: record.id, action: 'delete' })
      return
    }
    setConfirm(null)
    props.onDelete(record)
  }

  return (
    <div className="mission-library">
      <div className="section-heading">
        <h2>Saved missions</h2>
      </div>
      <p className="panel-description">
        Missions are saved in this browser only. Export a JSON file to keep a copy or share it.
      </p>

      {props.storageError && (
        <p className="mission-status error" role="alert">
          {props.storageError}
        </p>
      )}

      <form className="mission-save" onSubmit={save(active === null)}>
        <label htmlFor="mission-name">Mission name</label>
        <input
          id="mission-name"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. Pahrump ridge traverse"
          onChange={(event) => setDraft({ forId: active?.id ?? null, name: event.target.value })}
          disabled={!storageReady}
        />
        <div className="export-buttons">
          {active && (
            <button type="submit" disabled={!canSave || !valid || !storageReady}>
              Save changes
            </button>
          )}
          <button type={active ? 'button' : 'submit'} onClick={active ? save(true) : undefined} disabled={!canSave || !valid || !storageReady}>
            {active ? 'Save as new' : 'Save mission'}
          </button>
        </div>
        <p className="setting-hint">{props.saveHint}</p>
      </form>

      {status && (
        <div className={`mission-status ${status.tone}`} role={status.tone === 'error' ? 'alert' : 'status'}>
          <p>{status.text}</p>
          {status.details && status.details.length > 0 && (
            <ul>
              {status.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {missions.length === 0 ? (
        <p className="mission-empty">No saved missions yet.</p>
      ) : (
        <ul className="mission-list" aria-label="Saved missions">
          {missions.map((record) => {
            const isActive = record.id === active?.id
            const confirming = confirm?.id === record.id ? confirm.action : null
            return (
              <li key={record.id} className={`mission-item${isActive ? ' active' : ''}`}>
                <div className="mission-item-name">
                  {record.name}
                  {isActive && <span className="mission-open-tag">OPEN</span>}
                </div>
                <div className="mission-item-meta">
                  {record.terrain.title} · {record.waypoints.length} waypoint
                  {record.waypoints.length === 1 ? '' : 's'} · saved {savedLabel(record.savedAt)}
                </div>
                <div className="mission-item-actions">
                  <button onClick={() => open(record)} disabled={props.opening}>
                    {confirming === 'open' ? 'Replace current plan' : isActive ? 'Reopen' : 'Open'}
                  </button>
                  <button onClick={() => props.onExport(record)}>Export JSON</button>
                  <button className={confirming === 'delete' ? 'danger' : ''} onClick={() => remove(record)}>
                    {confirming === 'delete' ? 'Confirm delete' : 'Delete'}
                  </button>
                  {confirming && (
                    <button onClick={() => setConfirm(null)} aria-label={`Cancel for ${record.name}`}>
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {props.skipped > 0 && (
        <p className="setting-hint">
          {props.skipped} stored {props.skipped === 1 ? 'entry was' : 'entries were'} unreadable and left out.
        </p>
      )}

      <div className="mission-import">
        <button onClick={() => fileRef.current?.click()} disabled={!storageReady}>
          Import mission JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) props.onImport(file)
          }}
        />
        <p className="setting-hint">
          Missions open only on the same terrain package and grid they were planned on. Routes and
          estimates are recalculated when a mission opens.
        </p>
      </div>
    </div>
  )
}
