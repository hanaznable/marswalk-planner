import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  CRS,
  divIcon,
  imageOverlay,
  latLngBounds,
  layerGroup,
  map as createMap,
  marker,
  polyline,
  rectangle,
} from 'leaflet'
import type { LatLngBounds, LayerGroup, Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Icon } from '../../../components/ui/Icon'
import {
  cellCenterToMap,
  rasterBounds,
  type MapPoint,
} from '../../datasets/terrainContract'
import { describePosition, type PlacedTarget } from '../../datasets/scienceTargets'
import type { TerrainPackage } from '../../datasets/terrainPackage'
import type { RouteAlternatives, RouteResult, Waypoint } from '../../routing'
import { kindLabel } from '../../science/targetDisplay'
import { elevationToRgba } from '../terrainImage'
import { fromLatLng, placeWaypoint, toLatLng, waypointRoleLabel } from '../waypointPlacement'
import type { DisplayLayersController } from '../../mapLayers/useDisplayLayers'
import { contextLayer, ensureDisplayPanes } from '../../mapLayers/contextLayers'
import { rasterCanvas } from '../../mapLayers/rasterDisplay'
import type { BasemapStatus } from '../useBasemapStatus'
import type { WaypointOrigin } from '../../datasets/waypointOrigin'

interface MapCanvasProps {
  regionId: string
  showGrid: boolean
  terrain: TerrainPackage | null
  waypoints: readonly Waypoint[]
  addMode: boolean
  onPlace: (point: MapPoint) => void
  /** Returns false to reject the move; the marker then snaps back. */
  onRelocate: (id: string, point: MapPoint) => boolean
  /** Computed routes to draw; null when fewer than two waypoints. */
  routes: RouteAlternatives | null
  /** Real orthoimage for the terrain; null draws elevation shading (synthetic only). */
  basemapUrl: string | null
  basemapLabel?: string
  basemapStatus: BasemapStatus
  onBasemapStatus: (status: BasemapStatus) => void
  /** Shown instead of the decorative empty state when there is no terrain. */
  emptyState?: ReactNode
  /** Science targets on covered cells to draw; empty when hidden. */
  targets: readonly PlacedTarget[]
  selectedTargetId: string | null
  onTargetClick: (id: string) => void
  onContextWaypoint: (point: MapPoint, label: string, origin: WaypointOrigin) => void
  displayLayers: DisplayLayersController
}

/**
 * Leaflet renderer. CRS.Simple in local metres from the terrain's south-west
 * corner; the source Mars CRS stays in the terrain manifest.
 */
export function MapCanvas({
  regionId,
  showGrid,
  terrain,
  waypoints,
  addMode,
  onPlace,
  onRelocate,
  routes,
  basemapUrl,
  basemapLabel,
  basemapStatus,
  onBasemapStatus,
  emptyState,
  targets,
  selectedTargetId,
  onTargetClick,
  onContextWaypoint,
  displayLayers,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const boundsRef = useRef<LatLngBounds | null>(null)
  const fittedTerrainRef = useRef<TerrainPackage | null>(null)
  const markersRef = useRef<LayerGroup | null>(null)
  const routesRef = useRef<LayerGroup | null>(null)
  const targetsRef = useRef<LayerGroup | null>(null)
  const [zoom, setZoom] = useState(0)
  const [zoomRange, setZoomRange] = useState({ min: -2, max: 3 })
  const basemapFailed = basemapUrl !== null && basemapStatus === 'error'

  // Latest values for Leaflet event handlers bound once.
  const latest = useRef({ addMode, onPlace, onRelocate, onTargetClick, onContextWaypoint, terrain, waypoints })
  useEffect(() => {
    latest.current = { addMode, onPlace, onRelocate, onTargetClick, onContextWaypoint, terrain, waypoints }
  })

  useEffect(() => {
    if (!containerRef.current) return
    const map = createMap(containerRef.current, {
      crs: CRS.Simple,
      center: [0, 0],
      zoom: 0,
      minZoom: -2,
      maxZoom: 3,
      zoomSnap: 0.5,
      zoomControl: false,
      attributionControl: false,
    })
    mapRef.current = map
    ensureDisplayPanes(map)
    routesRef.current = layerGroup().addTo(map)
    // Targets sit under waypoint markers, so a waypoint on a target stays draggable.
    targetsRef.current = layerGroup().addTo(map)
    markersRef.current = layerGroup().addTo(map)
    map.on('zoomend', () => setZoom(map.getZoom()))
    map.on('click', (event) => {
      const { addMode: adding, onPlace: place, terrain: pkg } = latest.current
      if (adding && pkg) place(fromLatLng(pkg.manifest.raster, event.latlng))
    })
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      markersRef.current = null
      routesRef.current = null
      targetsRef.current = null
      fittedTerrainRef.current = null
    }
  }, [])

  // Display-only layers use the existing source-to-local coordinate adapter.
  // Visibility changes never re-fit the map or alter the terrain arrays.
  const activeRaster = displayLayers.settings.raster
  const rasterOpacity = displayLayers.settings.opacity
  const rasterImage = useRef<ReturnType<typeof imageOverlay> | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !terrain || !activeRaster) return
    const { raster } = terrain.manifest
    const extent = rasterBounds(raster)
    const bounds = latLngBounds(toLatLng(raster, { x: extent.minX, y: extent.minY }), toLatLng(raster, { x: extent.maxX, y: extent.maxY }))
    const canvas = rasterCanvas(terrain, activeRaster)
    const overlay = imageOverlay(canvas.toDataURL('image/png'), bounds, { pane: 'dataRaster', interactive: false, className: 'map-raster-overlay', alt: `${activeRaster} data overlay` }).addTo(map)
    rasterImage.current = overlay
    return () => { overlay.remove(); rasterImage.current = null }
  }, [terrain, activeRaster])
  useEffect(() => { rasterImage.current?.setOpacity(rasterOpacity) }, [terrain, activeRaster, rasterOpacity])

  const context = displayLayers.state.status === 'ready' ? displayLayers.state.context : null
  const { apxs, traverse, minerals } = displayLayers.settings
  useEffect(() => {
    const map = mapRef.current
    if (!map || !terrain || !context) return
    const groups = ([['apxs', apxs], ['traverse', traverse], ['minerals', minerals]] as const)
      .filter(([, visible]) => visible)
      .map(([kind]) => contextLayer(terrain, context, kind, {
        existingAt: (point) => {
          const placement = placeWaypoint(terrain, point)
          if (!placement.ok) return null
          return latest.current.waypoints.find((waypoint) => waypoint.cell.row === placement.cell.row && waypoint.cell.col === placement.cell.col)?.label ?? null
        },
        add: (point, label, origin) => {
          if (latest.current.terrain === terrain) latest.current.onContextWaypoint(point, label, origin)
        },
      }).addTo(map))
    return () => { for (const group of groups) group.remove() }
  }, [terrain, context, apxs, traverse, minerals])

  // Science target markers (covered cells only; splitByCoverage drops the rest).
  useEffect(() => {
    const group = targetsRef.current
    if (!group) return
    group.clearLayers()
    if (!terrain) return
    const { raster } = terrain.manifest
    for (const { target, cell } of targets) {
      const selected = target.id === selectedTargetId
      const item = marker(toLatLng(raster, cellCenterToMap(raster, cell)), {
        icon: divIcon({
          className: `target-marker${selected ? ' selected' : ''}`,
          html: '<span></span>',
          iconSize: [18, 18],
        }),
        title: `${target.name} (${kindLabel(target.kind)}). ${describePosition(target)}.`,
        alt: target.name,
        zIndexOffset: selected ? 100 : 0,
      })
      item.on('click', () => latest.current.onTargetClick(target.id))
      item.addTo(group)
    }
  }, [terrain, targets, selectedTargetId])

  // Bring a target selected from the list into view.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !terrain || !selectedTargetId) return
    const placed = targets.find(({ target }) => target.id === selectedTargetId)
    if (!placed) return
    const { raster } = terrain.manifest
    map.panInside(toLatLng(raster, cellCenterToMap(raster, placed.cell)), { padding: [60, 60] })
  }, [terrain, targets, selectedTargetId])

  useEffect(() => {
    containerRef.current?.classList.toggle('with-grid', showGrid)
    containerRef.current?.classList.toggle('adding', addMode)
  }, [showGrid, addMode])

  // Route lines: slope-aware solid underneath, shortest dashed on top.
  useEffect(() => {
    const group = routesRef.current
    if (!group) return
    group.clearLayers()
    if (!terrain || !routes) return
    const { raster } = terrain.manifest
    const draw = (result: RouteResult, className: string) => {
      for (const leg of result.legs) {
        if (leg.status !== 'ok' || leg.path.length < 2) continue
        const points = leg.path.map((cell) => toLatLng(raster, cellCenterToMap(raster, cell)))
        // Dark halo keeps the line readable on light and dark terrain alike.
        polyline(points, { className: 'route-line route-halo', interactive: false }).addTo(group)
        polyline(points, { className, interactive: false }).addTo(group)
      }
    }
    draw(routes.terrain, 'route-line route-slope-limited')
    draw(routes.distance, 'route-line route-shortest')
  }, [terrain, routes])

  // Terrain image, extent outline, and zoom limits.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !terrain) return
    const { raster, basemap } = terrain.manifest
    const extent = rasterBounds(raster)
    const toBounds = (box: ReturnType<typeof rasterBounds>) =>
      latLngBounds(
        toLatLng(raster, { x: box.minX, y: box.minY }),
        toLatLng(raster, { x: box.maxX, y: box.maxY }),
      )
    const bounds = toBounds(extent)
    boundsRef.current = bounds

    let image
    let active = true
    const loaded = () => { if (active) onBasemapStatus('ready') }
    const failed = () => { if (active) onBasemapStatus('error') }
    if (basemapUrl && basemap) {
      // Real orthoimage on its own footprint (same as the grid, finer pixels).
      image = imageOverlay(basemapUrl, toBounds(rasterBounds(basemap)), {
        pane: 'baseSurface',
        className: 'terrain-image basemap-image',
        interactive: false,
        alt: basemapLabel ?? `HiRISE orthoimage of ${terrain.manifest.title}`,
      })
      onBasemapStatus('loading')
      image.on('load', loaded)
      image.on('error', failed)
    } else {
      // Synthetic fixture only: display-only elevation shading.
      const canvas = document.createElement('canvas')
      canvas.width = raster.width
      canvas.height = raster.height
      canvas
        .getContext('2d')
        ?.putImageData(
          new ImageData(elevationToRgba(terrain.elevation), raster.width, raster.height),
          0,
          0,
        )
      image = imageOverlay(canvas.toDataURL(), bounds, {
        pane: 'baseSurface',
        className: 'terrain-image',
        interactive: false,
      })
    }
    image.addTo(map)
    const outline = rectangle(bounds, {
      className: 'terrain-outline',
      fill: false,
      weight: 1,
      interactive: false,
    }).addTo(map)

    if (fittedTerrainRef.current !== terrain) {
      const fitted = map.getBoundsZoom(bounds)
      map.setMinZoom(fitted - 1)
      map.setMaxZoom(fitted + 4)
      map.setMaxBounds(bounds.pad(0.5))
      map.fitBounds(bounds, { animate: false })
      setZoomRange({ min: fitted - 1, max: fitted + 4 })
      setZoom(map.getZoom())
      fittedTerrainRef.current = terrain
    }

    return () => {
      active = false
      image.off('load', loaded)
      image.off('error', failed)
      image.remove()
      outline.remove()
      boundsRef.current = null
    }
  }, [terrain, basemapUrl, basemapLabel, onBasemapStatus])

  useEffect(() => {
    if (boundsRef.current) mapRef.current?.fitBounds(boundsRef.current, { animate: false })
  }, [regionId])

  // Waypoint markers: rebuilt whenever the list changes.
  useEffect(() => {
    const group = markersRef.current
    if (!group) return
    group.clearLayers()
    if (!terrain) return
    const { raster } = terrain.manifest
    waypoints.forEach((waypoint, index) => {
      const role = waypointRoleLabel(index, waypoints.length)
      const kind = role === 'Start' ? 'start' : role === 'Destination' ? 'destination' : 'stop'
      const text = kind === 'start' ? 'S' : kind === 'destination' ? 'D' : String(index)
      const position = toLatLng(raster, cellCenterToMap(raster, waypoint.cell))
      const item = marker(position, {
        icon: divIcon({
          className: `waypoint-marker waypoint-${kind}`,
          html: `<span>${text}</span>`,
          iconSize: [24, 24],
        }),
        draggable: true,
        title: `${role}: ${waypoint.label}. Drag to move.`,
        alt: role,
      })
      item.on('dragend', () => {
        const accepted = latest.current.onRelocate(
          waypoint.id,
          fromLatLng(raster, item.getLatLng()),
        )
        if (!accepted) item.setLatLng(position)
      })
      item.addTo(group)
    })
  }, [terrain, waypoints])

  return (
    <>
      <div
        ref={containerRef}
        // Static on purpose: Leaflet adds its own classes to this element, and a
        // changing className would make React overwrite them. State classes are
        // toggled in an effect instead.
        className="map-canvas"
        aria-label={
          terrain
            ? `2D map of ${terrain.manifest.title}. Use arrow keys to pan, plus and minus to zoom.`
            : 'Empty 2D map. No terrain loaded. Use arrow keys to pan, plus and minus to zoom.'
        }
      />
      {terrain ? (
        terrain.manifest.synthetic ? (
          <div className="synthetic-banner" role="note">
            SYNTHETIC DEVELOPMENT TERRAIN <span>·</span> NOT NASA DATA
          </div>
        ) : (
          <div className="synthetic-banner prototype-banner" role="note">
            HIRISE PROTOTYPE TERRAIN <span>·</span> POSITION NOT VERIFIED
          </div>
        )
      ) : emptyState ? (
        emptyState
      ) : (
        <div className="map-empty-state">
          <div className="orbital-illustration" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="planet-grid">
              <span />
              <span />
              <span />
            </div>
            <span className="orbit-point" />
            <span className="illustration-cross cross-one">+</span>
            <span className="illustration-cross cross-two">+</span>
          </div>
          <span className="eyebrow">THE SURFACE IS JUST THE BEGINNING</span>
          <h2>
            A world of possibilities.
            <br />
            <span>Ready to explore.</span>
          </h2>
          <p>
            Your mission starts with a map. NASA surface
            <br className="desktop-break" /> datasets will bring this workspace to
            life.
          </p>
          <div className="empty-state-tag">
            <span className="status-dot" /> AWAITING DATA INTEGRATION
          </div>
        </div>
      )}
      <div
        className="map-zoom-controls"
        role="group"
        aria-label="2D map navigation"
      >
        <button
          aria-label="Zoom in"
          disabled={zoom >= zoomRange.max}
          onClick={() => mapRef.current?.zoomIn()}
        >
          <Icon name="plus" />
        </button>
        <span className="zoom-label" aria-live="polite">
          Z{Math.round(zoom - zoomRange.min)}
        </span>
        <button
          aria-label="Zoom out"
          disabled={zoom <= zoomRange.min}
          onClick={() => mapRef.current?.zoomOut()}
        >
          <Icon name="minus" />
        </button>
        <div className="control-divider" />
        <button
          aria-label="Reset viewport"
          onClick={() => {
            if (boundsRef.current) mapRef.current?.fitBounds(boundsRef.current)
            else mapRef.current?.setView([0, 0], 0)
          }}
        >
          <Icon name="target" />
        </button>
      </div>
      {basemapFailed && (
        <div className="map-notice warning basemap-error" role="alert">
          The HiRISE basemap image could not be loaded. Terrain data and routing
          still work.
        </div>
      )}
      {routes && (
        <div className="route-legend" aria-label="Route legend">
          <span>
            <span className="legend-swatch shortest" aria-hidden="true" /> Shortest
          </span>
          <span>
            <span className="legend-swatch slope-limited" aria-hidden="true" /> Slope-aware
          </span>
        </div>
      )}
      <div className="map-attribution">
        {terrain
          ? terrain.manifest.synthetic
            ? 'SYNTHETIC GRID · LOCAL METRES'
            : `HIRISE ${terrain.manifest.source?.productId} · ${terrain.manifest.source?.attribution} · LOCAL METRES`
          : 'NO TERRAIN LOADED'}
      </div>
    </>
  )
}
