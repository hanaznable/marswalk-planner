import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlacedTarget } from '../datasets/scienceTargets'
import type { RasterGrid } from '../datasets/terrainContract'
import type { TerrainPackage } from '../datasets/terrainPackage'
import type { MapContext } from '../mapLayers/context'
import { rasterCanvas } from '../mapLayers/rasterDisplay'
import type { RasterDisplay } from '../mapLayers/useDisplayLayers'
import type { RouteAlternatives, Waypoint } from '../routing'
import { TerrainRenderer, type Readout } from './terrainRenderer'
import './terrain3d.css'

export interface Terrain3DViewProps {
  terrain: TerrainPackage
  /** The image the 2D map shows (orthoimage or validated enhanced RGB); null for none. */
  imageUrl: string | null
  /** Footprint of that image in the source CRS. */
  imageFootprint: RasterGrid | null
  imageLabel: string
  raster: RasterDisplay | null
  rasterOpacity: number
  waypoints: readonly Waypoint[]
  routes: RouteAlternatives | null
  targets: readonly PlacedTarget[]
  selectedTargetId: string | null
  onTargetClick: (id: string) => void
  context: MapContext | null
  showApxs: boolean
  showTraverse: boolean
  showMinerals: boolean
  verticalScale: number
  onVerticalScaleChange: (scale: number) => void
  /** Called when WebGL is unavailable or lost; the viewport offers the 2D map. */
  onFailure: (message: string) => void
}

/** Offered vertical exaggerations; 1 is physically faithful and the default. */
const VERTICAL_SCALES = [1, 2, 3, 5] as const

const number = (value: number, digits: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/**
 * 3D terrain view. Lazy-loaded so the 2D planner never downloads Three.js.
 * Read-only: it shows the planner's waypoints and routes but never edits them.
 */
export default function Terrain3DView(props: Terrain3DViewProps) {
  const { terrain, imageUrl, imageFootprint, raster, rasterOpacity, verticalScale } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<TerrainRenderer | null>(null)
  const [readout, setReadout] = useState<Readout | null>(null)
  const [imageFailed, setImageFailed] = useState<string | null>(null)
  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
  })

  // One renderer per mount. Strict Mode mounts twice; each cleanup fully disposes.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let renderer: TerrainRenderer
    try {
      renderer = new TerrainRenderer(container, {
        onTargetClick: (id) => latest.current.onTargetClick(id),
        onReadout: setReadout,
        onImageError: () => setImageFailed(latest.current.imageUrl),
        onContextLost: () => latest.current.onFailure('The graphics context was lost.'),
      })
    } catch {
      latest.current.onFailure('WebGL is not available in this browser.')
      return
    }
    rendererRef.current = renderer
    return () => {
      rendererRef.current = null
      renderer.dispose()
    }
  }, [])

  useEffect(() => {
    try {
      rendererRef.current?.setTerrain(terrain)
    } catch (error) {
      latest.current.onFailure(error instanceof Error ? error.message : String(error))
    }
  }, [terrain])

  // Without an image (synthetic terrain) the surface is coloured by elevation.
  const fallback = useMemo(() => (imageUrl ? null : rasterCanvas(terrain, 'elevation')), [terrain, imageUrl])
  useEffect(() => {
    rendererRef.current?.setImage(imageUrl, imageFootprint, fallback)
  }, [terrain, imageUrl, imageFootprint, fallback])

  const overlayCanvas = useMemo(() => (raster ? rasterCanvas(terrain, raster) : null), [terrain, raster])
  useEffect(() => {
    rendererRef.current?.setRasterOverlay(overlayCanvas, rasterOpacity)
  }, [terrain, overlayCanvas, rasterOpacity])

  useEffect(() => {
    rendererRef.current?.setVerticalScale(verticalScale)
  }, [terrain, verticalScale])

  const { waypoints, routes, targets, selectedTargetId, context, showApxs, showTraverse, showMinerals } = props
  useEffect(() => {
    rendererRef.current?.setOverlays({ waypoints, routes, targets, selectedTargetId, context, showApxs, showTraverse, showMinerals })
  }, [terrain, waypoints, routes, targets, selectedTargetId, context, showApxs, showTraverse, showMinerals])

  return (
    <div className="terrain3d">
      <div className="terrain3d-stage" ref={containerRef} />
      <div className="terrain3d-toolbar" role="group" aria-label="3D view controls">
        <button type="button" onClick={() => rendererRef.current?.resetView()}>
          Reset view
        </button>
        <label>
          Vertical scale
          <select
            value={verticalScale}
            onChange={(event) => props.onVerticalScaleChange(Number(event.target.value))}
          >
            {VERTICAL_SCALES.map((scale) => (
              <option key={scale} value={scale}>
                {scale}×{scale === 1 ? ' (true scale)' : ' (exaggerated)'}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="terrain3d-info">
        <p>
          <strong>View only.</strong> Add and move waypoints in the 2D map.
        </p>
        <p>
          {props.imageLabel}
          {verticalScale !== 1 && ` · heights exaggerated ${verticalScale}× for display only`}
        </p>
        {imageFailed !== null && imageFailed === imageUrl && (
          <p className="terrain3d-warning" role="alert">
            The image could not be applied to the terrain; showing the plain surface.
          </p>
        )}
        <p className="terrain3d-readout" aria-live="off">
          {readout
            ? `E ${number(readout.east, 0)} m · N ${number(readout.north, 0)} m · ${
                readout.elevation === null ? 'no elevation data' : `${number(readout.elevation, 1)} m`
              } · slope ${readout.slope === null ? '—' : `${number(readout.slope, 1)}°`}`
            : 'Point at the terrain to read elevation and slope.'}
        </p>
      </div>
    </div>
  )
}
