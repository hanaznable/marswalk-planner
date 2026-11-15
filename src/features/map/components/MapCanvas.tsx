import { RouteLegend } from './RouteLegend'
import type { OxygenAlternatives, OxygenRouteBudget } from '../../eva/oxygenBudget'
import { scienceEvidenceLayer, type ScienceMapOverlay } from '../../scienceSuggestions/mapEvidence'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  CRS,
  control,
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
import { gridSpacing } from '../mapGrid'
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
  oxygen?: OxygenAlternatives | null
  scienceOverlays?: ScienceMapOverlay
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
  oxygen,
  scienceOverlays,
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

  const scienceRef = useRef(scienceOverlays)
  useEffect(() => { scienceRef.current = scienceOverlays })
  const scienceCollection = scienceOverlays?.collection ?? null
  const scienceVisible = scienceOverlays?.visible ?? false
  const scienceEquipment = JSON.stringify(scienceOverlays?.equipmentIds)
  const scienceSelected = JSON.stringify(scienceOverlays?.selectedActivityIds)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !terrain || !scienceCollection || !scienceVisible) return
    const group = scienceEvidenceLayer(terrain, scienceCollection, {
      canAdd: activity => {
        const c = scienceRef.current
        return !!c && !c.selectedActivityIds.includes(activity.id) && activity.requiredEquipmentIds.every(id => c.equipmentIds.includes(id))
      },
      add: activity => scienceRef.current?.onAdd(activity) ?? false,
    }).addTo(map)
    return () => { group.remove() }
  }, [terrain, scienceCollection, scienceVisible, scienceEquipment, scienceSelected])

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
    containerRef.current?.classList.toggle('adding', addMode)
  }, [showGrid, addMode])

  // Route lines: slope-aware solid underneath, shortest dashed on top.
  useEffect(() => {
    const group = routesRef.current
    if (!group) return
    group.clearLayers()
    if (!terrain || !routes) return
    const { raster } = terrain.manifest
    for (const budget of [oxygen?.slopeAware, oxygen?.shortest]) {
      if (!budget || budget.beyondPath.length < 2) continue
      polyline(budget.beyondPath.map(p => toLatLng(raster, p)), { className: 'route-oxygen-excess', color: '#f0c98e', weight: 4, opacity: .9, dashArray: '4 8', interactive: false }).addTo(group)
    }
    const draw = (result: RouteResult, className: string, budget?: OxygenRouteBudget | null) => {
      if (budget && !budget.withinBudget) {
        if (budget.withinPath.length > 1) {
          const points = budget.withinPath.map(p => toLatLng(raster, p))
          polyline(points, { className: 'route-line route-halo', interactive: false }).addTo(group)
          polyline(points, { className, interactive: false }).addTo(group)
        }
        return
      }
      for (const leg of result.legs) {
        if (leg.status !== 'ok' || leg.path.length < 2) continue
        const points = leg.path.map((cell) => toLatLng(raster, cellCenterToMap(raster, cell)))
        // Dark halo keeps the line readable on light and dark terrain alike.
        polyline(points, { className: 'route-line route-halo', interactive: false }).addTo(group)
        polyline(points, { className, interactive: false }).addTo(group)
      }
    }
    draw(routes.terrain, 'route-line route-slope-limited', oxygen?.slopeAware)
    draw(routes.distance, 'route-line route-shortest', oxygen?.shortest)
    const limits = routes.identical ? [['Slope-aware', oxygen?.slopeAware]] as const
      : [['Shortest', oxygen?.shortest], ['Slope-aware', oxygen?.slopeAware]] as const
    for (const [label, budget] of limits) {
      if (!budget?.cutoffPoint) continue
      marker(toLatLng(raster, budget.cutoffPoint), {
        interactive: false, keyboard: false, zIndexOffset: 1400,
        icon: divIcon({ className: 'oxygen-limit-marker', iconSize: [70, 23], iconAnchor: [35, label === 'Shortest' ? -12 : 35], html: `<span title="${label} oxygen reserve boundary">${routes.identical ? 'O2 limit' : label === 'Shortest' ? 'O2 short' : 'O2 slope'}</span>` }),
      }).addTo(group)
    }
    const marked = new Set<string>()
    for (const leg of routes.terrain.legs) {
      if (leg.status !== 'failed') continue
      const from = waypoints.find(w => w.id === leg.fromId)
      const to = waypoints.find(w => w.id === leg.toId)
      if (!from || !to) continue
      const endpoints = [from, to].map(w => toLatLng(raster, cellCenterToMap(raster, w.cell)))
      // A direct diagnostic connector, never an invented traversable path.
      polyline(endpoints, { color: '#101418', weight: 6, opacity: .85, interactive: false }).addTo(group)
      polyline(endpoints, { className: 'route-failed-connector', color: '#ff5757', weight: 3, dashArray: '7 9', interactive: false }).addTo(group)
      for (const waypoint of [from, to]) {
        if (marked.has(waypoint.id)) continue
        marked.add(waypoint.id)
        marker(toLatLng(raster, cellCenterToMap(raster, waypoint.cell)), {
          interactive: false, keyboard: false, zIndexOffset: 1500,
          icon: divIcon({
            className: 'route-broken-link', iconSize: [26, 26], iconAnchor: [-9, 28],
            html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 15-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1M3 2l3 3m12 14 3 3M11 10l2 4"/></svg>',
          }),
        }).addTo(group)
      }
    }
  }, [terrain, routes, waypoints, oxygen])

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

  // Metric lines live in Leaflet's projected frame and scale/pan with terrain.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !terrain || !showGrid) return
    if (!map.getPane('coordinateGrid')) {
      map.createPane('coordinateGrid').style.zIndex = '375'
      map.getPane('coordinateGrid')!.style.pointerEvents = 'none'
    }
    const group = layerGroup().addTo(map)
    const raster = terrain.manifest.raster
    const bounds = rasterBounds(raster)
    const spacing = gridSpacing(raster)
    const draw = (a: MapPoint, b: MapPoint) => polyline([toLatLng(raster, a), toLatLng(raster, b)], {
      pane: 'coordinateGrid', className: 'terrain-grid-line', color: '#c8d8ec', opacity: 0.35, weight: 1, interactive: false,
    }).addTo(group)
    for (let x = bounds.minX; x <= bounds.maxX; x += spacing) draw({ x, y: bounds.minY }, { x, y: bounds.maxY })
    for (let y = bounds.minY; y <= bounds.maxY; y += spacing) draw({ x: bounds.minX, y }, { x: bounds.maxX, y })
    const labels = document.createElement('div')
    labels.className = 'map-coordinate-labels'
    labels.setAttribute('aria-hidden', 'true')
    map.getContainer().append(labels)
    const updateLabels = () => {
      labels.replaceChildren()
      const size = map.getSize()
      const step = Math.max(1, Math.ceil(90 / (spacing * map.getZoomScale(map.getZoom(), 0))))
      const label = (text: string, axis: string, x: number, y: number) => {
        const item = document.createElement('span')
        item.className = `coordinate-label coordinate-${axis}`
        item.textContent = text
        item.style.left = `${x}px`
        item.style.top = `${y}px`
        labels.append(item)
      }
      let index = 0
      for (let x = bounds.minX; x <= bounds.maxX; x += spacing, index++) {
        const pt = map.latLngToContainerPoint(toLatLng(raster, { x, y: bounds.minY }))
        if (index % step === 0 && pt.x > 70 && pt.x < size.x - 45) label(`E ${Math.round(x - bounds.minX)} m`, 'east', pt.x, 6)
      }
      index = 0
      for (let y = bounds.minY; y <= bounds.maxY; y += spacing, index++) {
        const pt = map.latLngToContainerPoint(toLatLng(raster, { x: bounds.minX, y }))
        if (index % step === 0 && pt.y > 40 && pt.y < size.y - 90) label(`N ${Math.round(y - bounds.minY)} m`, 'north', 6, pt.y)
      }
    }
    map.on('move zoom resize', updateLabels)
    updateLabels()
    return () => { map.off('move zoom resize', updateLabels); labels.remove(); group.remove() }
  }, [terrain, showGrid])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !terrain) return
    // CRS.Simple.distance is Euclidean in our local metre frame, not Earth geodesy.
    const scale = control.scale({ imperial: false, metric: true, maxWidth: 120, position: 'bottomleft' }).addTo(map)
    return () => { scale.remove() }
  }, [terrain])

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
      {!terrain && emptyState}
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
      <RouteLegend routes={routes} oxygen={oxygen} />
      <div className="map-attribution">
        {terrain
          ? terrain.manifest.synthetic
            ? 'SYNTHETIC GRID - LOCAL METRES'
            : `HIRISE ${terrain.manifest.source?.productId} - ${terrain.manifest.source?.attribution} - LOCAL METRES`
          : 'NO TERRAIN LOADED'}
      </div>
    </>
  )
}
