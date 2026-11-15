import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { formatDuration } from '../../eva/evaEstimate'
import { formatDistance } from '../../routing'
import { kindLabel, outsideReason, solSummary } from '../../science/targetDisplay'
import type { MissionReport, ReportRoute } from './missionReport'

interface MissionReportDialogProps {
  report: MissionReport
  onClose: () => void
  onDownloadJson: () => void
}

const metres = (value: number | null) => (value === null ? '—' : `${Math.round(value)} m`)
const coordinate = (value: number) => value.toFixed(1)

/**
 * Printable mission report. Rendered outside the app shell so the print
 * stylesheet can print it alone (Print / Save as PDF in the browser).
 */
export function MissionReportDialog({ report, onClose, onDownloadJson }: MissionReportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.classList.add('report-open')
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('report-open')
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const generated = new Date(report.generatedAt)
  const { terrain, assumptions, routes, scienceTargets } = report

  return createPortal(
    <div className="report-backdrop">
      <div
        className="report-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="report-actions">
          <button onClick={() => window.print()}>Print / Save as PDF</button>
          <button onClick={onDownloadJson}>Download JSON</button>
          <button onClick={onClose} aria-label="Close mission report">
            Close
          </button>
        </div>

        <article className="report-page">
          <header>
            <p className="report-eyebrow">MARSWALK PLANNER - MISSION REPORT</p>
            <h1 id="report-title">{terrain.title}</h1>
            <p className="report-meta">
              Generated {generated.toUTCString()}
              {terrain.synthetic && <strong> - SYNTHETIC TERRAIN, NOT NASA DATA</strong>}
            </p>
          </header>

          <section>
            <h2>Important</h2>
            <ul>
              {report.disclaimers.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Terrain</h2>
            <dl className="report-facts">
              <dt>Source</dt>
              <dd>
                {terrain.source ? (
                  <>
                    HiRISE {terrain.source.productId} ({terrain.source.attribution}) —{' '}
                    <a href={terrain.source.url}>{terrain.source.url}</a>
                  </>
                ) : (
                  'None (synthetic development terrain)'
                )}
              </dd>
              <dt>Projection</dt>
              <dd>{terrain.crsName}</dd>
              <dt>Routing grid</dt>
              <dd>{terrain.cellSizeMeters} m cells</dd>
            </dl>
            <h3>Limitations</h3>
            <ul>
              {terrain.limitations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Planning assumptions</h2>
            <dl className="report-facts">
              <dt>Max slope (slope-aware route)</dt>
              <dd>{assumptions.maxSlopeDegrees}°</dd>
              <dt>Slope penalty</dt>
              <dd>{assumptions.slopePenalty}</dd>
              <dt>Walking speed</dt>
              <dd>{assumptions.walkingSpeedKmh} km/h</dd>
              <dt>Time per stop</dt>
              <dd>{assumptions.stopMinutes} min</dd>
              <dt>Return to start</dt>
              <dd>{assumptions.returnToStart ? 'Yes' : 'No'}</dd>
            </dl>
          </section>

          <section>
            <h2>Waypoints</h2>
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Role</th>
                  <th scope="col">Name</th>
                  <th scope="col">East / North (local m)</th>
                  <th scope="col">Source CRS x / y (m)</th>
                  <th scope="col">Elevation</th>
                </tr>
              </thead>
              <tbody>
                {report.waypoints.map((waypoint) => (
                  <tr key={waypoint.id}>
                    <td>{waypoint.order}</td>
                    <td>{waypoint.role}</td>
                    <td>
                      {waypoint.label}
                      {waypoint.scienceTargetId && <span className="report-tag"> - science target</span>}
                    </td>
                    <td>
                      {Math.round(waypoint.localMetres.east)} / {Math.round(waypoint.localMetres.north)}
                    </td>
                    <td>
                      {coordinate(waypoint.sourceCrs.x)} / {coordinate(waypoint.sourceCrs.y)}
                    </td>
                    <td>{metres(waypoint.elevationMeters)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {scienceTargets && <ScienceTargetsSection targets={scienceTargets} />}

          <SelectedObservations waypoints={report.waypoints} />
          <section>
            <h2>Routes</h2>
            {routes ? (
              <>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Measure</th>
                      <th scope="col">Shortest</th>
                      <th scope="col">Slope-aware</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ['Distance', (r: ReportRoute) => formatDistance(r.distanceMeters)],
                        ['Elevation gain', (r: ReportRoute) => metres(r.elevationGainMeters)],
                        ['Elevation loss', (r: ReportRoute) => metres(r.elevationLossMeters)],
                        ['EVA duration', (r: ReportRoute) => formatDuration(r.duration?.totalMinutes ?? null)],
                      ] as const
                    ).map(([label, value]) => (
                      <tr key={label}>
                        <th scope="row">{label}</th>
                        <td>{value(routes.shortest)}</td>
                        <td>{value(routes.slopeAware)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {routes.identical && <p>Both profiles give the same route.</p>}
                {[routes.shortest, routes.slopeAware].map((route) => (
                  <div key={route.profile} className="report-legs">
                    <h3>{route.profile === 'shortest' ? 'Shortest route' : 'Slope-aware route'} — legs</h3>
                    <ol>
                      {route.legs.map((leg, index) => (
                        <li key={index}>
                          {leg.from} → {leg.to}
                          {leg.kind === 'return' ? ' (return)' : ''}:{' '}
                          {leg.status === 'ok' ? formatDistance(leg.distanceMeters) : `no route — ${leg.failure}`}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </>
            ) : (
              <p>Add a start and a destination to plan routes.</p>
            )}
          </section>
        </article>
      </div>
    </div>,
    document.body,
  )
}

function SelectedObservations({ waypoints }: { waypoints: MissionReport['waypoints'] }) {
  const selected = waypoints.filter((waypoint) => waypoint.provenance)
  if (selected.length === 0) return null
  return <section className="report-observations">
    <h2>Selected observations and mineral findings</h2>
    {selected.map((waypoint) => {
      const origin = waypoint.provenance!
      return <div key={waypoint.id} className="report-target">
        <h3>{origin.name} - waypoint {waypoint.order}</h3>
        <p>{origin.kind} - {origin.mission}{origin.measurementSol !== null ? ` - measurement sol ${origin.measurementSol}` : ''}</p>
        <p>{origin.description}</p>
        <p>Source rover-position proxy: {coordinate(origin.position.x)}, {coordinate(origin.position.y)} m in the terrain CRS. Positional uncertainty not stated.</p>
        {origin.locationRelation === 'relocated' && <p><strong>This waypoint was moved from the source cell; these references describe the original observation, not its new location.</strong></p>}
        {origin.reviewFlags.length > 0 && <p>Source review flags: {origin.reviewFlags.join('; ')}</p>}
        <p>Source record: {origin.recordId}</p>
        {origin.sourceSha256 && <p>Source snapshot SHA-256: {origin.sourceSha256}</p>}
        <ul>{origin.sources.map((source) => <li key={source.url + source.provides}><a href={source.url}>{source.attribution}</a> - {source.provides}</li>)}</ul>
      </div>
    })}
  </section>
}

function ScienceTargetsSection({ targets }: { targets: NonNullable<MissionReport['scienceTargets']> }) {
  const visited = targets.targets.filter((target) => target.visitedByWaypoints.length > 0)
  const notVisited = targets.targets.filter(
    (target) => target.coverage === 'covered' && target.visitedByWaypoints.length === 0,
  )
  const outside = targets.targets.filter((target) => target.coverage !== 'covered')
  return (
    <section className="report-science">
      <h2>Science targets</h2>
      {targets.synthetic && (
        <p>
          <strong>Synthetic development targets: made-up, not NASA data.</strong>
        </p>
      )}
      {visited.length === 0 ? (
        <p>No waypoint is placed on a science target.</p>
      ) : (
        <div className="report-targets">
          {visited.map((target) => {
            const sols = solSummary(target)
            return (
              <div key={target.id} className="report-target">
                <h3>
                  {target.name}{' '}
                  <span className="report-tag">
                    {kindLabel(target.kind)}
                    {target.mission ? ` - ${target.mission}` : ''} - waypoint{' '}
                    {target.visitedByWaypoints.join(', ')}
                  </span>
                </h3>
                <p>
                  <strong>Position:</strong> {target.positionNote}. Source CRS x / y{' '}
                  {coordinate(target.position.x)} / {coordinate(target.position.y)} m.
                </p>
                {sols && <p>{sols}</p>}
                <p>{target.description}</p>
                {target.sources.length > 0 && (
                  <ul>
                    {target.sources.map((source) => (
                      <li key={`${source.url}#${source.provides}`}>
                        {source.provides}: {source.attribution} — <a href={source.url}>{source.url}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
      {notVisited.length > 0 && (
        <p>
          <strong>Also on this terrain, not visited:</strong>{' '}
          {notVisited.map((target) => target.name).join(', ')}.
        </p>
      )}
      {outside.length > 0 && (
        <p>
          <strong>Outside this terrain (not routable):</strong>{' '}
          {outside.map((target) => `${target.name} (${outsideReason(target.coverage === 'noData' ? 'noData' : 'outsideTerrain').toLowerCase()})`).join(', ')}.
        </p>
      )}
    </section>
  )
}
