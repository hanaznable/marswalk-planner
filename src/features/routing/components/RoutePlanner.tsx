import { Icon } from '../../../components/ui/Icon'
import {
  cellCenterToMap,
  toLocalMetres,
  type RasterGrid,
} from '../../datasets/terrainContract'
import { waypointRoleLabel } from '../../map/waypointPlacement'
import type { Waypoint } from '../model/types'

interface RoutePlannerProps {
  /** Null until a terrain package is loaded. */
  raster: RasterGrid | null
  waypoints: readonly Waypoint[]
  addMode: boolean
  onToggleAddMode: () => void
  onRemove: (id: string) => void
  onReorder: (id: string, toIndex: number) => void
  onClear: () => void
}

export function RoutePlanner({
  raster,
  waypoints,
  addMode,
  onToggleAddMode,
  onRemove,
  onReorder,
  onClear,
}: RoutePlannerProps) {
  return (
    <div className="route-planner">
      <div className="section-heading">
        <h2>Your next expedition</h2>
        <span className="tag">DRAFT</span>
      </div>
      <p className="panel-description">Every discovery starts with a plan.</p>

      {waypoints.length === 0 ? (
        <div className="route-empty">
          <div className="route-diagram" aria-hidden="true">
            <span className="route-node" />
            <span className="route-dash" />
            <Icon name="pin" size={25} />
          </div>
          <h3>No route planned yet</h3>
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
                </span>
                <span className="waypoint-position">
                  {local
                    ? `E ${Math.round(local.x)} m · N ${Math.round(local.y)} m`
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
          ? 'Available after map data integration'
          : addMode
            ? 'Click the map to place points. Drag markers to move them.'
            : 'Drag markers on the map to adjust them.'}
      </p>
      {waypoints.length > 0 && (
        <button className="clear-waypoints" onClick={onClear}>
          Clear all waypoints
        </button>
      )}

      <div className="route-summary">
        <span className="eyebrow">ROUTE SUMMARY</span>
        <dl>
          <div>
            <dt>Waypoints</dt>
            <dd>{waypoints.length || '—'}</dd>
          </div>
          <div>
            <dt>Total distance</dt>
            <dd>—</dd>
          </div>
          <div>
            <dt>Estimated duration</dt>
            <dd>—</dd>
          </div>
        </dl>
        <div className="summary-note">
          <Icon name="info" size={13} />
          <span>Route calculation is not connected yet.</span>
        </div>
      </div>
    </div>
  )
}
