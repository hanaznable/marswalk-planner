import { useEffect, useRef } from 'react'
import type { PlacedTarget } from '../../datasets/scienceTargets'
import type { Waypoint } from '../../routing'
import { kindLabel, outsideReason, solSummary, waypointAtCell } from '../targetDisplay'
import type { ScienceTargetsState } from '../useScienceTargets'

interface ScienceTargetBrowserProps {
  state: ScienceTargetsState
  selectedId: string | null
  onSelect: (id: string | null) => void
  waypoints: readonly Waypoint[]
  onAddWaypoint: (placed: PlacedTarget) => void
}

/** Target list, details of the selected target, and targets outside the terrain. */
export function ScienceTargetBrowser({
  state,
  selectedId,
  onSelect,
  waypoints,
  onAddWaypoint,
}: ScienceTargetBrowserProps) {
  if (state.status === 'loading') {
    return <p className="target-status" role="status">Loading science targets…</p>
  }
  if (state.status === 'error') {
    return (
      <div className="target-status target-error" role="alert">
        <p>Science targets could not be loaded: {state.message}</p>
        <p>No targets are shown in their place.</p>
        {state.retry && (
          <button className="retry-button" onClick={state.retry}>
            Try again
          </button>
        )}
      </div>
    )
  }
  if (state.status === 'none') return null

  const { collection, inside, outside } = state
  const selected = inside.find((placed) => placed.target.id === selectedId) ?? null

  return (
    <div className="target-browser">
      {collection.synthetic && (
        <p className="target-synthetic" role="note">
          SYNTHETIC TARGETS - NOT NASA DATA
        </p>
      )}
      {inside.length === 0 ? (
        <p className="target-status">No targets fall on covered terrain.</p>
      ) : (
        <ul className="target-list" aria-label="Science targets on this terrain">
          {inside.map(({ target }) => (
            <li key={target.id}>
              <button
                className="target-item"
                aria-pressed={target.id === selectedId}
                onClick={() => onSelect(target.id === selectedId ? null : target.id)}
              >
                <span className="target-swatch" aria-hidden="true" />
                <span className="target-name">{target.name}</span>
                <span className="target-kind">{kindLabel(target.kind)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <TargetDetails
          placed={selected}
          existing={waypointAtCell(waypoints, selected.cell)}
          onAddWaypoint={() => onAddWaypoint(selected)}
        />
      )}
      {outside.length > 0 && (
        <details className="target-outside">
          <summary>Outside this terrain ({outside.length})</summary>
          <p>Not shown on the map and not usable as waypoints.</p>
          <ul>
            {outside.map(({ target, reason }) => (
              <li key={target.id}>
                <span>{target.name}</span>
                <span className="target-kind">{outsideReason(reason)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function TargetDetails({
  placed,
  existing,
  onAddWaypoint,
}: {
  placed: PlacedTarget
  existing: Waypoint | null
  onAddWaypoint: () => void
}) {
  const { target } = placed
  const sols = solSummary(target)
  const ref = useRef<HTMLElement>(null)
  // A target picked on the map may have its card below the panel's fold.
  useEffect(() => {
    const filter = ref.current?.closest<HTMLDetailsElement>('details.target-filter')
    if (filter) filter.open = true
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [target.id])
  return (
    <section ref={ref} className="target-details" aria-label={`Details: ${target.name}`}>
      <h3>{target.name}</h3>
      <p className="target-kind">
        {kindLabel(target.kind)}
        {target.mission ? ` - ${target.mission}` : ''}
      </p>
      {sols && <p className="target-meta">{sols}</p>}
      <p className="target-description">{target.description.replace(' This marker uses an associated rover position, not the exact drill-hole location.', '')}</p>
      {target.sources.length > 0 && (
        <>
          <h4>Sources</h4>
          <ul className="target-sources">
            {target.sources.map((source) => (
              <li key={`${source.url}#${source.provides}`}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.attribution}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <button className="target-add" onClick={onAddWaypoint} disabled={existing !== null}>
        {existing ? `Already a waypoint (${existing.label})` : 'Add as waypoint'}
      </button>
    </section>
  )
}
