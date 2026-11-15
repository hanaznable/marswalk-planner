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

      <button
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
      <p className="availability-note">
        {!raster
          ? 'Available once terrain is loaded'
          : addMode
            ? 'Click the map to place points. Drag markers to move them.'
            : 'Drag markers on the map to adjust them.'}
      </p>
      {waypoints.length > 0 && (
        <button className="clear-waypoints" onClick={onClear}>
          Clear all waypoints
        </button>
      )}

      <div className="route-settings">
        <span className="eyebrow">PLANNING ASSUMPTIONS</span>
        <label className="setting-row">
          <span>Max slope</span>
          <input
            type="range"
            min={5}
            max={45}
            step={1}
            value={maxSlopeDegrees}
            onChange={(event) => onMaxSlopeChange(Number(event.target.value))}
            aria-describedby="slope-hint"
          />
          <output>{maxSlopeDegrees}°</output>
        </label>
        <p id="slope-hint" className="setting-hint">
          Applies to the slope-aware route only. A scenario assumption, not a
          certified astronaut safety limit.
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
          How strongly the slope-aware route avoids steep ground. 0 = shortest
          within the limit. Planning heuristic, not an energy model.
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
            aria-describedby="eva-hint"
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
            aria-describedby="eva-hint"
          />
          <output>{evaAssumptions.stopMinutes} min</output>
        </label>
        <p id="eva-hint" className="setting-hint">
          Scenario assumptions for the EVA estimate, not measured astronaut
          performance.
        </p>
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
