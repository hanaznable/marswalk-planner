import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { ProfilePoint } from '../evaEstimate'
import { niceTicks, pointAtDistance } from '../profileGeometry'
import { formatDistance } from '../../routing'

interface Series {
  readonly key: 'shortest' | 'slopeAware'
  readonly label: string
  readonly profile: readonly ProfilePoint[] | null
}

interface ElevationProfileChartProps {
  shortest: readonly ProfilePoint[] | null
  slopeAware: readonly ProfilePoint[] | null
  /** True when elevations come from a synthetic development fixture. */
  synthetic: boolean
}

const HEIGHT = 150
const MARGIN = { top: 10, right: 10, bottom: 22, left: 36 }

export function ElevationProfileChart({
  shortest,
  slopeAware,
  synthetic,
}: ElevationProfileChartProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(260)
  const [cursor, setCursor] = useState<number | null>(null)

  useEffect(() => {
    const element = wrapperRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const series: Series[] = [
    { key: 'shortest', label: 'Shortest', profile: shortest },
    { key: 'slopeAware', label: 'Slope-aware', profile: slopeAware },
  ]
  const drawn = series.filter((item) => item.profile && item.profile.length > 1)
  if (drawn.length === 0) return null

  const allPoints = drawn.flatMap((item) => item.profile as ProfilePoint[])
  const maxDistance = Math.max(...allPoints.map((point) => point.distanceMeters))
  const minElevation = Math.min(...allPoints.map((point) => point.elevationMeters))
  const maxElevation = Math.max(...allPoints.map((point) => point.elevationMeters))
  const pad = Math.max((maxElevation - minElevation) * 0.1, 1)
  const yMin = minElevation - pad
  const yMax = maxElevation + pad

  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 10)
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const x = (distance: number) => MARGIN.left + (distance / maxDistance) * plotWidth
  const y = (elevation: number) =>
    MARGIN.top + (1 - (elevation - yMin) / (yMax - yMin)) * plotHeight

  const xTicks = niceTicks(0, maxDistance, 3)
  // Five steps so a ~60 m relief range still gets 3-4 labelled gridlines.
  const yTicks = niceTicks(yMin, yMax, 5)

  const pathFor = (profile: readonly ProfilePoint[]) =>
    profile
      .map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.distanceMeters).toFixed(1)},${y(point.elevationMeters).toFixed(1)}`)
      .join('')

  function moveCursor(event: PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1)
    setCursor(ratio * maxDistance)
  }

  function handleKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const step = maxDistance / 20
    setCursor((current) => {
      const base = current ?? 0
      const next = event.key === 'ArrowRight' ? base + step : base - step
      return Math.min(Math.max(next, 0), maxDistance)
    })
  }

  const readings =
    cursor === null
      ? []
      : drawn.map((item) => ({ ...item, point: pointAtDistance(item.profile as ProfilePoint[], cursor) }))
  const tooltipLeft = cursor === null ? 0 : x(cursor)
  const unit = synthetic ? 'm (synthetic)' : 'm'

  return (
    <figure className="profile-chart">
      <figcaption>
        <span className="eyebrow">ELEVATION PROFILE</span>
        <span className="profile-legend">
          {drawn.map((item) => (
            <span key={item.key}>
              <span className={`legend-swatch ${item.key === 'shortest' ? 'shortest' : 'slope-limited'}`} aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </span>
      </figcaption>
      <div className="profile-plot" ref={wrapperRef}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          tabIndex={0}
          aria-label={`Elevation profile in ${unit} against distance along the route. Use left and right arrow keys to read values.`}
          onKeyDown={handleKey}
          onBlur={() => setCursor(null)}
        >
          {yTicks.map((tick) => (
            <g key={`y${tick}`}>
              <line className="profile-grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
              <text className="profile-axis" x={MARGIN.left - 6} y={y(tick)} dy="0.32em" textAnchor="end">
                {tick}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <text
              key={`x${tick}`}
              className="profile-axis"
              x={x(tick)}
              y={HEIGHT - 6}
              textAnchor={tick === 0 ? 'start' : 'middle'}
            >
              {formatDistance(tick)}
            </text>
          ))}
          {drawn.map((item) => (
            <path
              key={item.key}
              className={`profile-line profile-${item.key}`}
              d={pathFor(item.profile as ProfilePoint[])}
            />
          ))}
          {cursor !== null && (
            <g className="profile-cursor">
              <line x1={x(cursor)} x2={x(cursor)} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} />
              {readings.map(
                (item) =>
                  item.point && (
                    <circle
                      key={item.key}
                      className={`profile-dot profile-${item.key}`}
                      cx={x(item.point.distanceMeters)}
                      cy={y(item.point.elevationMeters)}
                      r={4}
                    />
                  ),
              )}
            </g>
          )}
          <rect
            className="profile-hit"
            x={MARGIN.left}
            y={MARGIN.top}
            width={plotWidth}
            height={plotHeight}
            onPointerMove={moveCursor}
            onPointerLeave={() => setCursor(null)}
          />
        </svg>
        {cursor !== null && (
          <div
            className="profile-tooltip"
            role="status"
            style={{
              left: Math.min(Math.max(tooltipLeft, 70), width - 70),
            }}
          >
            {readings.map(
              (item) =>
                item.point && (
                  <div key={item.key}>
                    <span className={`legend-swatch ${item.key === 'shortest' ? 'shortest' : 'slope-limited'}`} aria-hidden="true" />
                    {item.label}: {Math.round(item.point.elevationMeters)} {unit} at{' '}
                    {formatDistance(item.point.distanceMeters)}
                  </div>
                ),
            )}
          </div>
        )}
      </div>
      <details className="profile-table">
        <summary>Show profile data</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Route</th>
              <th scope="col">Start</th>
              <th scope="col">Lowest</th>
              <th scope="col">Highest</th>
              <th scope="col">End</th>
            </tr>
          </thead>
          <tbody>
            {drawn.map((item) => {
              const points = item.profile as ProfilePoint[]
              const elevations = points.map((point) => point.elevationMeters)
              return (
                <tr key={item.key}>
                  <th scope="row">{item.label}</th>
                  <td>{Math.round(elevations[0])}</td>
                  <td>{Math.round(Math.min(...elevations))}</td>
                  <td>{Math.round(Math.max(...elevations))}</td>
                  <td>{Math.round(elevations[elevations.length - 1])}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p>Elevations in {unit}.</p>
      </details>
    </figure>
  )
}
