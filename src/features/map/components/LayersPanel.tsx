import { useState } from 'react'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../../components/ui/Icon'
import type { ScienceTargetsState } from '../../science/useScienceTargets'
import type { TerrainState } from '../useTerrainSource'
import { MapLayerControls } from '../../mapLayers/MapLayerControls'
import type { DisplayLayersController } from '../../mapLayers/useDisplayLayers'
import type { SurfaceImageryController } from '../../mapLayers/useSurfaceImagery'
import { SurfaceImageryControls, SurfaceImageryDetails } from '../../mapLayers/SurfaceImageryControls'
import type { BasemapController } from '../useBasemapStatus'

interface LayerRow {
  title: string
  description: string
  icon: IconName
  /** Status text when the layer is present; null when it is still awaited. */
  loaded: string | null
  /** Text shown while the layer is not present. */
  pending?: string
  /** Visibility switch for a present layer that can be hidden. */
  toggle?: { on: boolean; onChange: (on: boolean) => void }
}

function targetsRow(
  state: ScienceTargetsState,
  real: boolean,
  showTargets: boolean,
  onShowTargetsChange: (on: boolean) => void,
): LayerRow {
  const onlyDrillProxies = real && state.status === 'ready' && state.collection.targets.length > 0
    && state.collection.targets.every((target) => target.kind === 'drill-site' && target.position.basis === 'rover-position-proxy')
  const base = { title: onlyDrillProxies ? 'Drill proxies' : 'Science targets', icon: 'pin' as const }
  switch (state.status) {
    case 'ready': {
      const { inside, outside, collection } = state
      return {
        ...base,
        description: onlyDrillProxies ? 'Drill-associated rover positions' : `${inside.length} on this terrain${outside.length ? ` - ${outside.length} outside` : ''}`,
        loaded: collection.synthetic
          ? showTargets
            ? 'SYNTHETIC - SHOWN ON MAP'
            : 'SYNTHETIC - HIDDEN'
          : showTargets
            ? 'SHOWN ON MAP'
            : 'HIDDEN',
        toggle: { on: showTargets, onChange: onShowTargetsChange },
      }
    }
    case 'loading':
      return { ...base, description: 'Loading the target collectionâ€¦', loaded: null, pending: 'LOADING' }
    case 'error':
      return { ...base, description: 'The target collection failed to load', loaded: null, pending: 'LOAD FAILED' }
    case 'none':
      return {
        ...base,
        description: real ? 'Not delivered for this package yet' : 'Points of scientific interest',
        loaded: null,
      }
  }
}

function layerRows(state: TerrainState, targets: LayerRow, colorActive: boolean, basemap: BasemapController): LayerRow[] {
  const ready = state.status === 'ready' ? state : null
  const real = ready !== null && !ready.terrain.manifest.synthetic
  return [
    {
      title: 'Surface imagery',
      description: real ? colorActive ? 'Enhanced RGB - registered prototype' : 'HiRISE orthoimage' : 'Orbital image basemap',
      icon: 'image',
      loaded: real && basemap.status === 'ready' ? 'SHOWN ON MAP' : null,
      pending: basemap.status === 'error' ? 'IMAGE LOAD FAILED' : basemap.status === 'loading' ? 'LOADING IMAGE' : undefined,
    },
    targets,
  ]
}

export function LayersPanel({
  terrainState,
  targetsState,
  showTargets,
  onShowTargetsChange,
  targetBrowser,
  scienceLayers,
  scienceLayersActive = false,
  displayLayers,
  surfaceImagery,
  basemap,
}: {
  terrainState: TerrainState
  targetsState: ScienceTargetsState
  showTargets: boolean
  onShowTargetsChange: (value: boolean) => void
  /** Target list and details, shown under the layer list. */
  targetBrowser: ReactNode
  scienceLayers?: ReactNode
  scienceLayersActive?: boolean
  displayLayers: DisplayLayersController
  surfaceImagery: SurfaceImageryController
  basemap: BasemapController
}) {
  const [section, setSection] = useState<'layers' | 'datasets'>('layers')
  const realTerrain = terrainState.status === 'ready' && !terrainState.terrain.manifest.synthetic
  const rows = layerRows(
    terrainState,
    targetsRow(targetsState, realTerrain, showTargets, onShowTargetsChange),
    surfaceImagery.mode === 'rgb' && surfaceImagery.state.status === 'ready',
    basemap,
  )
  const activeCount = rows.filter((row) => row.loaded && (row.toggle?.on ?? true)).length
    + (terrainState.status === 'ready' && displayLayers.settings.raster ? 1 : 0)
    + (displayLayers.state.status === 'ready' ? Number(displayLayers.settings.apxs) + Number(displayLayers.settings.traverse) : 0)
    + Number(scienceLayersActive)
  const dataset = terrainState.status === 'none' ? null : terrainState.dataset
  const datasetLoaded = terrainState.status === 'ready' && dataset !== null

  return (
    <aside
      className="panel layers-panel"
      aria-label="Map layers and navigation"
    >
      <div className="panel-tabs segmented" role="group" aria-label="Left panel sections">
        <button
          className={section === 'layers' ? 'selected' : ''}
          aria-pressed={section === 'layers'}
          onClick={() => setSection('layers')}
        >
          <Icon name="layers" size={14} />
          Layers
        </button>
        <button
          className={section === 'datasets' ? 'selected' : ''}
          aria-pressed={section === 'datasets'}
          onClick={() => setSection('datasets')}
        >
          <Icon name="database" size={14} />
          Data sources<span className="count">{datasetLoaded ? 1 : 0}</span>
        </button>
      </div>
      {section === 'layers' ? (
        <>
          <div className="section-heading">
            <h2>Map layers</h2>
            <span className="active-layer-count">{activeCount} active</span>
          </div>
          <div className="layer-list">
            {rows.map((layer) => (
              <div className={`layer-row${layer.title !== 'Surface imagery' ? ' target-layer-row' : ''}`} key={layer.title}>
                <span className="layer-icon">
                  <Icon name={layer.icon} />
                </span>
                <div>
                  <h3>{layer.title}</h3>
                  <p>{layer.description}</p>
                  {layer.loaded ? (
                    <span className={`layer-loaded${layer.toggle && !layer.toggle.on ? ' layer-hidden' : ''}`}>{layer.loaded}</span>
                  ) : (
                    <span className="unavailable">{layer.pending ?? 'AWAITING DATA'}</span>
                  )}
                  {layer.title === 'Surface imagery' && <SurfaceImageryControls controller={surfaceImagery} />}
                </div>
                {layer.toggle ? (
                  <button
                    className={`switch${layer.toggle.on ? ' on' : ''}`}
                    role="switch"
                    aria-checked={layer.toggle.on}
                    aria-label={`Show ${layer.title.toLowerCase()} on the map`}
                    onClick={() => layer.toggle?.onChange(!layer.toggle.on)}
                  >
                    <span />
                  </button>
                ) : (
                  !layer.loaded && (
                    <button
                      className="switch"
                      role="switch"
                      aria-checked={false}
                      aria-label={`${layer.title}: awaiting data`}
                      disabled
                      title="Requires an integrated NASA dataset"
                    >
                      <span />
                    </button>
                  )
                )}
                {layer.title !== 'Surface imagery' && showTargets && targetsState.status !== 'none' && (
                  <details className="target-filter">
                    <summary>{layer.title === 'Drill proxies' ? 'Drill sites' : 'Browse targets'}</summary>
                    {targetBrowser}
                  </details>
                )}
              </div>
            ))}
            <MapLayerControls terrain={terrainState.status === 'ready' ? terrainState.terrain : null} controller={displayLayers} hideMinerals />
            {scienceLayers}
          </div>

        </>
      ) : (
        <div className="catalog-view">
          <div className="section-heading">
            <h2>Data sources</h2>
            <span className="small-label">{datasetLoaded ? '1 terrain package' : '0 terrain packages'}</span>
          </div>
          {dataset && terrainState.status === 'ready' ? (
            <div className="catalog-entry">
              <h3>{dataset.title}</h3>
              <dl>
                <div>
                  <dt>Source</dt>
                  <dd>
                    <a href={dataset.sourceUrl} target="_blank" rel="noreferrer">
                      {terrainState.terrain.manifest.source?.productId}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Credit</dt>
                  <dd>{dataset.attribution}</dd>
                </div>
                <div>
                  <dt>Projection</dt>
                  <dd>{dataset.coordinateReferenceSystem}</dd>
                </div>
                <div>
                  <dt>Routing grid</dt>
                  <dd>
                    {terrainState.terrain.manifest.raster.width} Ã—{' '}
                    {terrainState.terrain.manifest.raster.height} cells,{' '}
                    {terrainState.terrain.manifest.raster.geoTransform[1]} m
                  </dd>
                </div>
              </dl>
              <details className="dataset-methods">
                <summary>Methods and limitations</summary>
                <ul className="limitations">
                  {(dataset.dataSourceNotes ?? dataset.limitations).map(note => <li key={note}>{note}</li>)}
                </ul>
              </details>
              <h4>Imagery and observations</h4>
              <SurfaceImageryDetails controller={surfaceImagery} />
              {displayLayers.state.status === 'ready' && <p className="panel-description">
                APXS: {displayLayers.state.context.observations.length} historical measurements.
              </p>}
            </div>
          ) : (
            <>
              <div className="catalog-icon">
                <Icon name="database" size={28} />
              </div>
              <h3>
                {terrainState.status === 'loading'
                  ? 'Loading terrain packageâ€¦'
                  : terrainState.status === 'error'
                    ? 'Terrain package failed to load'
                    : terrainState.status === 'ready'
                      ? 'Synthetic development terrain'
                      : 'No datasets for this region'}
              </h3>
              <p>
                {terrainState.status === 'ready'
                  ? 'Synthetic terrain - not NASA data.'
                  : terrainState.status === 'error'
                    ? 'Source details are unavailable because the terrain could not load.'
                    : terrainState.status === 'loading'
                      ? 'Loading source details.'
                      : 'No data package is loaded.'}
              </p>
            </>
          )}

        </div>
      )}
    </aside>
  )
}
