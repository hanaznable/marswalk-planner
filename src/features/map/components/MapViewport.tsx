import type { MapPoint } from '../../datasets/terrainContract'
import type { TerrainPackage } from '../../datasets/terrainPackage'
import type { MarsRegion } from '../../datasets/types'
import type { Waypoint } from '../../routing'
import { TerrainPlaceholder } from '../../terrain/components/TerrainPlaceholder'
import { Icon } from '../../../components/ui/Icon'
import type { ViewMode } from '../types'
import { MapCanvas } from './MapCanvas'

interface MapViewportProps {
  region: MarsRegion
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  showGrid: boolean
  expanded: boolean
  onExpand: () => void
  terrain: TerrainPackage | null
  waypoints: readonly Waypoint[]
  addMode: boolean
  notice: string | null
  onPlace: (point: MapPoint) => void
  onRelocate: (id: string, point: MapPoint) => boolean
}

export function MapViewport({
  region,
  viewMode,
  onViewModeChange,
  showGrid,
  expanded,
  onExpand,
  terrain,
  waypoints,
  addMode,
  notice,
  onPlace,
  onRelocate,
}: MapViewportProps) {
  return (
    <section
      className="map-viewport"
      id="map-viewport"
      aria-label={`${region.name} map viewport`}
      tabIndex={-1}
    >
      <div className="viewport-topbar">
        <div className="viewport-title">
          <Icon name="planet" size={17} />
          <span>MARS</span>
          <span className="breadcrumb-slash">/</span>
          <strong>{region.name}</strong>
        </div>
        <span className="map-preview-label">
          {terrain?.manifest.synthetic ? 'SYNTHETIC PREVIEW' : 'DATA PREVIEW'}
        </span>
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
          />
        ) : (
          <TerrainPlaceholder />
        )}
        {viewMode === '2d' && (addMode || notice) && (
          <div className={`map-notice${notice ? ' warning' : ''}`} role="status">
            {notice ?? 'Click the terrain to place a waypoint'}
          </div>
        )}
        <div className="view-switcher" role="group" aria-label="Viewport mode">
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
            3D terrain<span className="soon-label">SOON</span>
          </button>
        </div>
        <button
          className="expand-button icon-button"
          onClick={onExpand}
          aria-label={expanded ? 'Restore workspace panels' : 'Expand viewport'}
          aria-expanded={expanded}
        >
          <Icon name={expanded ? 'collapse' : 'expand'} size={17} />
        </button>
        <div className="viewport-corner corner-tl" aria-hidden="true" />
        <div className="viewport-corner corner-tr" aria-hidden="true" />
        <div className="viewport-corner corner-bl" aria-hidden="true" />
        <div className="viewport-corner corner-br" aria-hidden="true" />
      </div>
      <div className="viewport-bottom">
        <span>
          <span className="hollow-dot" />{' '}
          {viewMode === '2d' ? '2D MAP VIEW' : '3D PLACEHOLDER'}
        </span>
        <span>
          {viewMode === '2d'
            ? 'DRAG TO PAN · SCROLL TO ZOOM'
            : 'RENDERING NOT IMPLEMENTED'}
        </span>
      </div>
    </section>
  )
}
