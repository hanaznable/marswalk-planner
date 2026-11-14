import { useEffect, useRef, useState } from 'react'
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
import type { TerrainPackage } from '../../datasets/terrainPackage'
import type { RouteAlternatives, RouteResult, Waypoint } from '../../routing'
import { elevationToRgba } from '../terrainImage'
import { fromLatLng, toLatLng, waypointRoleLabel } from '../waypointPlacement'

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
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const boundsRef = useRef<LatLngBounds | null>(null)
  const markersRef = useRef<LayerGroup | null>(null)
  const routesRef = useRef<LayerGroup | null>(null)
  const [zoom, setZoom] = useState(0)
  const [zoomRange, setZoomRange] = useState({ min: -2, max: 3 })

  // Latest values for Leaflet event handlers bound once.
  const latest = useRef({ addMode, onPlace, onRelocate, terrain })
  useEffect(() => {
    latest.current = { addMode, onPlace, onRelocate, terrain }
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
    routesRef.current = layerGroup().addTo(map)
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
    }
  }, [])

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
    const { raster } = terrain.manifest
    const extent = rasterBounds(raster)
    const bounds = latLngBounds(
      [0, 0],
      [extent.maxY - extent.minY, extent.maxX - extent.minX],
    )
    boundsRef.current = bounds

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
    const image = imageOverlay(canvas.toDataURL(), bounds, {
      className: 'terrain-image',
      interactive: false,
    }).addTo(map)
    const outline = rectangle(bounds, {
      className: 'terrain-outline',
      fill: false,
      weight: 1,
      interactive: false,
    }).addTo(map)

    const fitted = map.getBoundsZoom(bounds)
    map.setMinZoom(fitted - 1)
    map.setMaxZoom(fitted + 4)
    map.setMaxBounds(bounds.pad(0.5))
    map.fitBounds(bounds, { animate: false })
    setZoomRange({ min: fitted - 1, max: fitted + 4 })
    setZoom(map.getZoom())

    return () => {
      image.remove()
      outline.remove()
    }
  }, [terrain])

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
        terrain.manifest.synthetic && (
          <div className="synthetic-banner" role="note">
            SYNTHETIC DEVELOPMENT TERRAIN <span>·</span> NOT NASA DATA
          </div>
        )
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
            : terrain.manifest.source?.attribution
          : 'EMPTY VIEWPORT · NO BASEMAP LOADED'}
      </div>
    </>
  )
}
