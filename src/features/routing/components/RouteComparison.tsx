import { Icon } from '../../../components/ui/Icon'
import { waypointRoleLabel } from '../../map/waypointPlacement'
import type { RouteResult, Waypoint } from '../model/types'
import { describeFailure, formatDistance, type RouteSummary } from '../routeStats'
import type { RoutePlan } from '../useRoutePlan'

interface RouteComparisonProps {
  plan: RoutePlan | null
  waypoints: readonly Waypoint[]
  maxSlopeDegrees: number
}

const formatMetres = (value: number | null) =>
  value === null ? '—' : `${Math.round(value)} m`

export function RouteComparison({ plan, waypoints, maxSlopeDegrees }: RouteComparisonProps) {
  const roleOf = (id: string) => {
    const index = waypoints.findIndex((waypoint) => waypoint.id === id)
    return index === -1 ? id : waypointRoleLabel(index, waypoints.length)
  }

  if (!plan) {
    return (
      <div className="route-summary">
        <span className="eyebrow">ROUTE COMPARISON</span>
        <div className="summary-note">
          <Icon name="info" size={13} />
          <span>Place a start and a destination to compare routes.</span>
        </div>
      </div>
    )
  }

  const { alternatives, distanceSummary, terrainSummary } = plan
  const rows: [string, (summary: RouteSummary) => string][] = [
    ['Distance', (s) => formatDistance(s.distanceMeters)],
    ['Elevation gain', (s) => formatMetres(s.elevationGainMeters)],
    ['Elevation loss', (s) => formatMetres(s.elevationLossMeters)],
  ]

  return (
    <div className="route-summary">
      <span className="eyebrow">ROUTE COMPARISON</span>
      <table className="route-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Measure</span>
            </th>
            <th scope="col">
              <span className="legend-swatch shortest" aria-hidden="true" /> Shortest
            </th>
            <th scope="col">
              <span className="legend-swatch slope-limited" aria-hidden="true" /> Slope ≤{' '}
              {maxSlopeDegrees}°
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value(distanceSummary)}</td>
              <td>{value(terrainSummary)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Duration</th>
            <td>—</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>

      {alternatives.identical && (
        <p className="route-note">Both profiles give the same route.</p>
      )}
      <FailureList title="Shortest" result={alternatives.distance} roleOf={roleOf} />
      <FailureList title="Slope-limited" result={alternatives.terrain} roleOf={roleOf} />

      <div className="summary-note">
        <Icon name="info" size={13} />
        <span>
          Planar grid distances on the loaded terrain. EVA duration is not
          calculated yet.
        </span>
      </div>
    </div>
  )
}

function FailureList({
  title,
  result,
  roleOf,
}: {
  title: string
  result: RouteResult
  roleOf: (id: string) => string
}) {
  const failed = result.legs.filter((leg) => leg.status === 'failed')
  if (failed.length === 0) return null
  return (
    <div className="route-failures" role="status">
      <strong>{title}: no complete route</strong>
      <ul>
        {failed.map((leg) => (
          <li key={`${leg.kind}-${leg.fromId}-${leg.toId}`}>
            {roleOf(leg.fromId)} → {roleOf(leg.toId)}
            {leg.kind === 'return' ? ' (return)' : ''}:{' '}
            {leg.status === 'failed' ? describeFailure(leg.reason, roleOf) : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
