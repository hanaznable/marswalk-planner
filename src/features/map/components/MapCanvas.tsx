import { useEffect, useRef, useState } from 'react'
import { CRS, map as createMap } from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Icon } from '../../../components/ui/Icon'

/** Empty renderer only. CRS.Simple is a non-geographic placeholder, not a Mars CRS. */
export function MapCanvas({
  regionId,
  showGrid,
}: {
  regionId: string
  showGrid: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const [zoom, setZoom] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const map = createMap(containerRef.current, {
      crs: CRS.Simple,
      center: [0, 0],
      zoom: 0,
      minZoom: -2,
      maxZoom: 3,
      zoomControl: false,
      attributionControl: false,
    })
    mapRef.current = map
    map.on('zoomend', () => setZoom(map.getZoom()))
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    mapRef.current?.setView([0, 0], 0, { animate: false })
  }, [regionId])

  return (
    <>
      <div
        ref={containerRef}
        className={`map-canvas${showGrid ? ' with-grid' : ''}`}
        aria-label="Empty 2D map. No terrain or geographic coordinates loaded. Use arrow keys to pan, plus and minus to zoom."
      />
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
      <div
        className="map-zoom-controls"
        role="group"
        aria-label="2D map navigation"
      >
        <button
          aria-label="Zoom in"
          disabled={zoom >= 3}
          onClick={() => mapRef.current?.zoomIn()}
        >
          <Icon name="plus" />
        </button>
        <span className="zoom-label" aria-live="polite">
          Z{zoom}
        </span>
        <button
          aria-label="Zoom out"
          disabled={zoom <= -2}
          onClick={() => mapRef.current?.zoomOut()}
        >
          <Icon name="minus" />
        </button>
        <div className="control-divider" />
        <button
          aria-label="Reset viewport"
          onClick={() => mapRef.current?.setView([0, 0], 0)}
        >
          <Icon name="target" />
        </button>
      </div>
      <div className="map-attribution">
        EMPTY VIEWPORT <span>·</span> NO BASEMAP LOADED
      </div>
    </>
  )
}
