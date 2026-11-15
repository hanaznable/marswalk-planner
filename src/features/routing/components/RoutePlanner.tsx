import { DEFAULT_OXYGEN_KG, OXYGEN_RANGE, OXYGEN_RATE_KG_PER_HOUR, OXYGEN_RESERVE_MINUTES, OXYGEN_SOURCES, type OxygenAlternatives } from '../../eva/oxygenBudget'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../../components/ui/Icon'
import {
  cellCenterToMap,
  toLocalMetres,
  type RasterGrid,
} from '../../datasets/terrainContract'
import { waypointName, waypointRoleLabel } from '../../map/waypointPlacement'
import type { Waypoint } from '../model/types'
import type { RoutePlan } from '../useRoutePlan'
import { RouteComparison } from './RouteComparison'
import type { EvaAssumptions } from '../../eva/evaEstimate'
import type { EvaPlan } from '../../eva/useEvaPlan'

interface RoutePlannerProps {
  oxygen?: OxygenAlternatives | null
  /** Null until a terrain package is loaded. */
  raster: RasterGrid | null
  waypoints: readonly Waypoint[]
  addMode: boolean
  onToggleAddMode: () => void
  onRemove: (id: string) => void
  onReorder: (id: string, toIndex: number) => void
  onClear: () => void
  plan: RoutePlan | null
  maxSlopeDegrees: number
  onMaxSlopeChange: (degrees: number) => void
  slopePenalty: number
  onSlopePenaltyChange: (penalty: number) => void
  eva: EvaPlan | null
  evaAssumptions: EvaAssumptions
  onEvaAssumptionsChange: (assumptions: EvaAssumptions) => void
  synthetic: boolean
  returnToStart: boolean
  onReturnToStartChange: (value: boolean) => void
  /** True when a terrain is loaded and at least one waypoint is placed. */
  exportAvailable: boolean
  onOpenReport: () => void
  onDownloadJson: () => void
}

export function RoutePlanner({
  oxygen,
  raster,
  waypoints,
  addMode,
  onToggleAddMode,
  onRemove,
  onReorder,
  onClear,
  plan,
  maxSlopeDegrees,
  onMaxSlopeChange,
  slopePenalty,
  onSlopePenaltyChange,
  eva,
  evaAssumptions,
  onEvaAssumptionsChange,
  synthetic,
  returnToStart,
  onReturnToStartChange,
  exportAvailable,
  onOpenReport,
  onDownloadJson,
}: RoutePlannerProps) {
  // Clearing every waypoint asks first. The prompt closes by itself if the list
  // empties some other way (removing the last point, switching region).
  const [confirmingClear, setConfirmingClear] = useState(false)
  if (confirmingClear && waypoints.length === 0) setConfirmingClear(false)
  const clearButton = useRef<HTMLButtonElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (confirmingClear) cancelButton.current?.focus()
  }, [confirmingClear])
  const count = waypoints.length

  return (
    <div className="route-planner">
      <div className="section-heading">
        <h2>Waypoints</h2>
        {waypoints.length > 0 && <span className="small-label">{waypoints.length}</span>}
      </div>

      {waypoints.length === 0 ? (
        <div className="route-empty">
          <p>
            Add a start point, then a destination. Points in between become
            stops.
          </p>
        </div>
      ) : (
        <ol className="waypoint-list" aria-label="Waypoints in order">
          {waypoints.map((waypoint, index) => {
            const role = waypointRoleLabel(index, waypoints.length)
            const local = raster
              ? toLocalMetres(raster, cellCenterToMap(raster, waypoint.cell))
              : null
            return (
              <li key={waypoint.id} className="waypoint-item">
                <span className={`waypoint-role role-${role.split(' ')[0].toLowerCase()}`}>
                  {role}
                  {waypointName(waypoint) && (
                    <span className="waypoint-name"> - {waypointName(waypoint)}</span>
                  )}
                </span>
                <span className="waypoint-position">
                  {local
                    ? `E ${Math.round(local.x)} m - N ${Math.round(local.y)} m`
                    : `Cell ${waypoint.cell.row}, ${waypoint.cell.col}`}
                </span>
                <span className="waypoint-actions">
                  <button
                    aria-label={`Move ${role} up`}
                    disabled={index === 0}
                    onClick={() => onReorder(waypoint.id, index - 1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${role} down`}
                    disabled={index === waypoints.length - 1}
                    onClick={() => onReorder(waypoint.id, index + 1)}
                  >
                    ↓
                  </button>
                  <button
                    aria-label={`Remove ${role}`}
                    onClick={() => onRemove(waypoint.id)}
                  >
                    <Icon name="minus" size={13} />
                  </button>
                </span>
              </li>
            )
          })}
        </ol>
      )}

      <div className="add-waypoint-row">
        <button
          ref={addButton}
          className={`add-waypoint${addMode ? ' active' : ''}`}
          disabled={!raster}
          aria-pressed={addMode}
          onClick={onToggleAddMode}
        >
          <Icon name={addMode ? 'check' : 'plus'} size={16} />
          {addMode
            ? 'Done placing'
            : waypoints.length === 0
              ? 'Add first waypoint'
              : 'Add waypoints'}
          <Icon name={raster ? 'pin' : 'lock'} size={13} />
        </button>
        <button
          ref={clearButton}
          className="clear-waypoints"
          aria-label="Clear all waypoints"
          title={count === 0 ? 'No waypoints to clear' : 'Clear all waypoints'}
          disabled={count === 0}
          aria-expanded={confirmingClear}
          onClick={() => setConfirmingClear(true)}
        >
          <Icon name="trash" size={17} />
        </button>
      </div>
      {confirmingClear && (
        <div
          className="clear-confirm"
          role="alertdialog"
          aria-labelledby="clear-confirm-title"
          aria-describedby="clear-confirm-text"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setConfirmingClear(false)
              clearButton.current?.focus()
            }
          }}
        >
          <strong id="clear-confirm-title">
            {count === 1 ? 'Delete the waypoint?' : `Delete all ${count} waypoints?`}
          </strong>
          <p id="clear-confirm-text">
            The routes and estimates for them are cleared too. Saved missions are
            not affected.
          </p>
          <div className="clear-confirm-actions">
            <button
              className="danger"
              onClick={() => {
                onClear()
                setConfirmingClear(false)
                // The trash button is disabled once the list is empty.
                addButton.current?.focus()
              }}
            >
              {count === 1 ? 'Delete' : 'Delete all'}
            </button>
            <button ref={cancelButton} onClick={() => { setConfirmingClear(false); clearButton.current?.focus() }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <p className="availability-note">
        {!raster
          ? 'Available once terrain is loaded'
          : addMode
            ? 'Click the map to place points. Drag markers to move them.'
            : 'Drag markers on the map to adjust them.'}
      </p>

      <div className="route-settings">
        <h2 className="route-section-title">Planning assumptions</h2>
        <label className="setting-row">
          <span>Max slope</span>
          <input
            type="range"
            min={5}
            max={45}
            step={1}
            value={maxSlopeDegrees}
            onChange={(event) => onMaxSlopeChange(Number(event.target.value))}
            aria-describedby="max-slope-description"
          />
          <output>{maxSlopeDegrees}°</output>
        </label>
        <p id="max-slope-description" className="setting-hint">
          The slope-aware route avoids terrain steeper than this limit.
        </p>

        <label className="setting-row">
          <span>Slope penalty</span>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={slopePenalty}
            onChange={(event) => onSlopePenaltyChange(Number(event.target.value))}
            aria-describedby="penalty-hint"
          />
          <output>{slopePenalty}</output>
        </label>
        <p id="penalty-hint" className="setting-hint">
          How strongly the slope-aware route avoids steep ground.
        </p>
        <label className="setting-row">
          <span>Walking speed</span>
          <input
            type="range"
            min={0.5}
            max={5}
            step={0.1}
            value={evaAssumptions.walkingSpeedKmh}
            onChange={(event) =>
              onEvaAssumptionsChange({ ...evaAssumptions, walkingSpeedKmh: Number(event.target.value) })
            }
          />
          <output>{evaAssumptions.walkingSpeedKmh.toFixed(1)} km/h</output>
        </label>
        <label className="setting-row">
          <span>Time per stop</span>
          <input
            type="range"
            min={0}
            max={120}
            step={5}
            value={evaAssumptions.stopMinutes}
            onChange={(event) =>
              onEvaAssumptionsChange({ ...evaAssumptions, stopMinutes: Number(event.target.value) })
            }
          />
          <output>{evaAssumptions.stopMinutes} min</output>
        </label>

        <label className="setting-row">
          <span>Oxygen tank</span>
          <input type="range" min={OXYGEN_RANGE[0]} max={OXYGEN_RANGE[1]} step={0.01} value={evaAssumptions.oxygenCapacityKg ?? DEFAULT_OXYGEN_KG} onChange={event => onEvaAssumptionsChange({ ...evaAssumptions, oxygenCapacityKg: Number(event.target.value) })} aria-describedby="oxygen-hint" />
          <output>{(evaAssumptions.oxygenCapacityKg ?? DEFAULT_OXYGEN_KG).toFixed(2)} kg</output>
        </label>
        <p id="oxygen-hint" className="setting-hint">Per astronaut - EMU primary reference: 0.54 kg</p>
        <details className="oxygen-method"><summary>Oxygen model and sources</summary>
          <p>NASA Mars closed-loop scenario: {OXYGEN_RATE_KG_PER_HOUR} kg/hour, including metabolism and leakage. A {OXYGEN_RESERVE_MINUTES} min planning reserve is held back.</p>
          <p>Budget = tank oxygen - rate x (walking + stops + reserve). No refills; emergency oxygen is excluded. This estimates oxygen only, not safe EVA endurance or a guaranteed return.</p>
          {OXYGEN_SOURCES.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}
        </details>
        <label className="setting-row checkbox">
          <input
            type="checkbox"
            checked={returnToStart}
            onChange={(event) => onReturnToStartChange(event.target.checked)}
          />
          <span>Return to start</span>
        </label>
      </div>

      <RouteComparison
        oxygen={oxygen}
        plan={plan}
        waypoints={waypoints}
        maxSlopeDegrees={maxSlopeDegrees}
        slopePenalty={slopePenalty}
        eva={eva}
        evaAssumptions={evaAssumptions}
        synthetic={synthetic}
      />

      <div className="route-export">
        <span className="eyebrow">EXPORT</span>
        <div className="export-buttons">
          <button disabled={!exportAvailable} onClick={onOpenReport}>
            Mission report
          </button>
          <button disabled={!exportAvailable} onClick={onDownloadJson}>
            Download JSON
          </button>
        </div>
        <p className="setting-hint">
          {exportAvailable
            ? 'Includes sources, assumptions, waypoints, both routes and limitations.'
            : 'Load terrain and place a waypoint to export.'}
        </p>
      </div>
    </div>
  )
}
