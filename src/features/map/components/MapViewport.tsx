import type { PlacedTarget } from '../../datasets/scienceTargets'
import type { MapPoint } from '../../datasets/terrainContract'
import type { MarsRegion } from '../../datasets/types'
import type { RouteAlternatives, Waypoint } from '../../routing'
import { gridSpacing } from '../mapGrid'
import { useState } from 'react'
import { Terrain3DPanel } from '../../terrain3d/Terrain3DPanel'
import { Icon } from '../../../components/ui/Icon'
import type { ViewMode } from '../types'
import type { TerrainState } from '../useTerrainSource'
import { MapCanvas } from './MapCanvas'
import type { DisplayLayersController } from '../../mapLayers/useDisplayLayers'
import type { SurfaceImageryController } from '../../mapLayers/useSurfaceImagery'
import type { BasemapController } from '../useBasemapStatus'
import type { WaypointOrigin } from '../../datasets/waypointOrigin'

interface MapViewportProps {
  region: MarsRegion
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  showGrid: boolean
  onGridChange: (value: boolean) => void
  expanded: boolean
  onExpand: () => void
  terrainState: TerrainState
  waypoints: readonly Waypoint[]
  addMode: boolean
  notice: string | null
  onPlace: (point: MapPoint) => void
  onRelocate: (id: string, point: MapPoint) => boolean
  routes: RouteAlternatives | null
  targets: readonly PlacedTarget[]
  selectedTargetId: string | null
  onTargetClick: (id: string) => void
  onContextWaypoint: (point: MapPoint, label: string, origin: WaypointOrigin) => void
  displayLayers: DisplayLayersController
  surfaceImagery: SurfaceImageryController
  basemap: BasemapController
}

export function MapViewport({
  region,
  viewMode,
  onViewModeChange,
  showGrid,
  onGridChange,
  expanded,
  onExpand,
  terrainState,
  waypoints,
  addMode,
  notice,
  onPlace,
  onRelocate,
  routes,
  targets,
  selectedTargetId,
  onTargetClick,
  onContextWaypoint,
  displayLayers,
  surfaceImagery,
  basemap,
}: MapViewportProps) {
  const terrain = terrainState.status === 'ready' ? terrainState.terrain : null
  const title = terrain ? terrain.manifest.title : region.name
  // A view setting, kept here so it survives switching between 2D and 3D.
  const [verticalScale, setVerticalScale] = useState(1)
  const rgb = surfaceImagery.mode === 'rgb' && surfaceImagery.state.status === 'ready' ? surfaceImagery.state.manifest : null
  const imageFootprint = rgb ? rgb.image : (terrain?.manifest.basemap ?? null)
  const imageLabel = !terrain
    ? ''
    : terrain.manifest.synthetic
      ? 'Synthetic terrain coloured by elevation (not NASA data)'
      : rgb
        ? `${rgb.title}: ${rgb.colorMeaning}. ${rgb.registration}.`
        : terrain.manifest.source
          ? `HiRISE orthoimage (grayscale), ${terrain.manifest.source.attribution}`
          : 'Terrain surface'
  const context = displayLayers.state.status === 'ready' ? displayLayers.state.context : null
  // The terrain's standing caveat, stated once, next to the map title.
  const caveat =
    terrainState.status === 'ready'
      ? terrainState.terrain.manifest.synthetic
        ? { tone: 'warning', text: 'Synthetic terrain - not NASA data' }
        : { tone: 'note', text: 'Prototype data - position not verified' }
      : terrainState.status === 'loading'
        ? { tone: 'note', text: 'Loading terrain…' }
        : terrainState.status === 'error'
          ? { tone: 'danger', text: 'Terrain failed to load' }
          : { tone: 'note', text: 'No terrain package' }
  return (
    <section
      className="map-viewport"
      id="map-viewport"
      aria-label={`${title} map viewport`}
      tabIndex={-1}
    >
      <div className="viewport-topbar">
        <div className="viewport-title">
          <span className="viewport-planet">Mars</span>
          <span className="breadcrumb-slash" aria-hidden="true">/</span>
          <strong>{title}</strong>
          <span className={`map-caveat ${caveat.tone}`} role="note">
            {caveat.text}
          </span>
        </div>
        <div className="viewport-actions">
          {viewMode === '2d' && showGrid && terrain && <span className="grid-spacing" title="Coordinates are local metres east and north from the terrain's south-west corner.">
            Grid: {gridSpacing(terrain.manifest.raster)} m / Routing: {terrain.manifest.raster.geoTransform[1]} m
          </span>}
          {viewMode === '2d' && <button className="icon-button" aria-label="Viewport grid" aria-pressed={showGrid} disabled={!terrain} onClick={() => onGridChange(!showGrid)} title="Grid">
            <Icon name="grid" size={16} />
          </button>}
          <div className="view-switcher segmented" role="group" aria-label="Viewport mode">
            <button
              aria-pressed={viewMode === '2d'}
              className={viewMode === '2d' ? 'selected' : ''}
              onClick={() => onViewModeChange('2d')}
            >
              <Icon name="grid" size={14} />
              2D map
            </button>
            <button
              aria-pressed={viewMode === '3d'}
              className={viewMode === '3d' ? 'selected' : ''}
              onClick={() => onViewModeChange('3d')}
            >
              <Icon name="cube" size={14} />
              3D terrain
            </button>
          </div>
          <button
            className="icon-button"
            onClick={onExpand}
            aria-label={expanded ? 'Restore workspace panels' : 'Expand viewport'}
            aria-expanded={expanded}
            title={expanded ? 'Show panels' : 'Hide panels'}
          >
            <Icon name={expanded ? 'collapse' : 'expand'} size={16} />
          </button>
        </div>
      </div>
      <div className="map-stage">
        {viewMode === '2d' ? (
          <MapCanvas
            regionId={region.id}
            showGrid={showGrid}
            terrain={terrain}
            waypoints={waypoints}
            addMode={addMode}
            onPlace={onPlace}
            onRelocate={onRelocate}
            routes={routes}
            basemapUrl={basemap.url}
            basemapStatus={basemap.status}
            onBasemapStatus={basemap.report}
            basemapLabel={surfaceImagery.mode === 'rgb' && surfaceImagery.state.status === 'ready' ? 'HiRISE enhanced RGB: relative registration, partial color coverage' : undefined}
            emptyState={<TerrainStatusPanel state={terrainState} regionName={region.name} />}
            targets={targets}
            selectedTargetId={selectedTargetId}
            onTargetClick={onTargetClick}
            onContextWaypoint={onContextWaypoint}
            displayLayers={displayLayers}
          />
        ) : terrain ? (
          <Terrain3DPanel
            terrain={terrain}
            imageUrl={basemap.url}
            imageFootprint={imageFootprint}
            imageLabel={imageLabel}
            raster={displayLayers.settings.raster}
            rasterOpacity={displayLayers.settings.opacity}
            waypoints={waypoints}
            routes={routes}
            targets={targets}
            selectedTargetId={selectedTargetId}
            onTargetClick={onTargetClick}
            context={context}
            showApxs={displayLayers.settings.apxs}
            showTraverse={displayLayers.settings.traverse}
            showMinerals={displayLayers.settings.minerals}
            verticalScale={verticalScale}
            onVerticalScaleChange={setVerticalScale}
            onUse2D={() => onViewModeChange('2d')}
          />
        ) : (
          <TerrainStatusPanel state={terrainState} regionName={region.name} />
        )}
        {viewMode === '3d' && addMode && (
          <div className="map-notice below-toolbar" role="status">
            Waypoints are placed and moved in the 2D map
          </div>
        )}
        {viewMode === '2d' && (addMode || notice) && (
          <div className={`map-notice${notice ? ' warning' : ''}`} role="status">
            {notice ??
              (targets.length > 0
                ? 'Click the terrain or a science target to place a waypoint'
                : 'Click the terrain to place a waypoint')}
          </div>
        )}
      </div>
    </section>
  )
}

function TerrainStatusPanel({ state, regionName }: { state: TerrainState; regionName: string }) {
  if (state.status === 'ready') return null
  return (
    <div className="map-empty-state terrain-status" role={state.status === 'error' ? 'alert' : 'status'}>
      {state.status === 'loading' && (
        <>
          <span className="eyebrow">LOADING TERRAIN</span>
          <h2>{state.dataset.title}</h2>
          <p>Downloading the elevation, slope and basemap package…</p>
        </>
      )}
      {state.status === 'error' && (
        <>
          <span className="eyebrow">TERRAIN COULD NOT BE LOADED</span>
          <h2>{state.dataset.title}</h2>
          <p className="terrain-error">{state.message}</p>
          <p>No other terrain is shown in its place.</p>
          <button className="retry-button" onClick={state.retry}>
            Try again
          </button>
        </>
      )}
      {state.status === 'none' && (
        <>
          <span className="eyebrow">NO TERRAIN PACKAGE</span>
          <h2>{regionName}</h2>
          <p>
            No validated terrain package exists for this region yet, so there is
            nothing to plan on here.
          </p>
        </>
      )}
    </div>
  )
}
