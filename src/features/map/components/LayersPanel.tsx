import { useState } from 'react'
import { Icon, type IconName } from '../../../components/ui/Icon'
import type { TerrainState } from '../useTerrainSource'

interface LayerRow {
  title: string
  description: string
  icon: IconName
  /** Status text when the layer is present; null when it is still awaited. */
  loaded: string | null
}

function layerRows(state: TerrainState): LayerRow[] {
  const ready = state.status === 'ready' ? state : null
  const real = ready !== null && !ready.terrain.manifest.synthetic
  return [
    {
      title: 'Surface imagery',
      description: real ? 'HiRISE orthoimage' : 'Orbital image basemap',
      icon: 'image',
      loaded: real && ready.basemapUrl ? 'SHOWN ON MAP' : null,
    },
    {
      title: 'Elevation and slope',
      description: real ? '5 m grid from the HiRISE DTM' : 'Surface topography',
      icon: 'mountain',
      loaded: ready ? (real ? 'USED FOR ROUTING' : 'SYNTHETIC · ROUTING') : null,
    },
    {
      title: 'Science targets',
      description: real ? 'Not included in this package' : 'Points of scientific interest',
      icon: 'pin',
      loaded: null,
    },
  ]
}

export function LayersPanel({
  showGrid,
  onGridChange,
  terrainState,
}: {
  showGrid: boolean
  onGridChange: (value: boolean) => void
  terrainState: TerrainState
}) {
  const [section, setSection] = useState<'layers' | 'datasets'>('layers')
  const rows = layerRows(terrainState)
  const activeCount = rows.filter((row) => row.loaded).length
  const dataset = terrainState.status === 'none' ? null : terrainState.dataset
  const datasetLoaded = terrainState.status === 'ready' && dataset !== null

  return (
    <aside
      className="panel layers-panel"
      aria-label="Map layers and navigation"
    >
      <div className="panel-heading">
        <span className="eyebrow">EXPLORER</span>
        <span className="panel-index">01</span>
      </div>
      <nav className="explorer-nav" aria-label="Explorer sections">
        <button
          className={section === 'layers' ? 'nav-item active' : 'nav-item'}
          aria-pressed={section === 'layers'}
          onClick={() => setSection('layers')}
        >
          <Icon name="layers" />
          Map layers
          <Icon name="chevron" size={14} />
        </button>
        <button
          className={section === 'datasets' ? 'nav-item active' : 'nav-item'}
          aria-pressed={section === 'datasets'}
          onClick={() => setSection('datasets')}
        >
          <Icon name="database" />
          Data catalog<span className="count">{datasetLoaded ? 1 : 0}</span>
        </button>
      </nav>
      {section === 'layers' ? (
        <>
          <div className="section-heading">
            <h2>Map layers</h2>
            <span className="small-label">{activeCount} ACTIVE</span>
          </div>
          <p className="panel-description">
            Build a clearer picture of the surface.
          </p>
          <div className="layer-list">
            {rows.map((layer) => (
              <div className="layer-row" key={layer.title}>
                <span className="layer-icon">
                  <Icon name={layer.icon} />
                </span>
                <div>
                  <h3>{layer.title}</h3>
                  <p>{layer.description}</p>
                  {layer.loaded ? (
                    <span className="layer-loaded">{layer.loaded}</span>
                  ) : (
                    <span className="unavailable">AWAITING DATA</span>
                  )}
                </div>
                {!layer.loaded && (
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
                )}
              </div>
            ))}
          </div>
          <div className="section-heading overlay-heading">
            <h2>Display overlays</h2>
          </div>
          <div className="grid-row">
            <Icon name="grid" />
            <div>
              <h3>Viewport grid</h3>
              <p>Visual guide · no coordinates</p>
            </div>
            <button
              className={`switch${showGrid ? ' on' : ''}`}
              role="switch"
              aria-checked={showGrid}
              aria-label="Viewport grid"
              onClick={() => onGridChange(!showGrid)}
            >
              <span />
            </button>
          </div>
        </>
      ) : (
        <div className="catalog-view">
          <div className="section-heading">
            <h2>Data catalog</h2>
            <span className="small-label">{datasetLoaded ? 1 : 0} LOADED</span>
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
                    {terrainState.terrain.manifest.raster.width} ×{' '}
                    {terrainState.terrain.manifest.raster.height} cells,{' '}
                    {terrainState.terrain.manifest.raster.geoTransform[1]} m
                  </dd>
                </div>
              </dl>
              <h4>Prototype limitations</h4>
              <ul className="limitations">
                {dataset.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div className="catalog-icon">
                <Icon name="database" size={28} />
              </div>
              <h3>
                {terrainState.status === 'loading'
                  ? 'Loading terrain package…'
                  : terrainState.status === 'error'
                    ? 'Terrain package failed to load'
                    : terrainState.status === 'ready'
                      ? 'Synthetic development terrain'
                      : 'No datasets for this region'}
              </h3>
              <p>
                {terrainState.status === 'ready'
                  ? 'Made-up hills for development. Not NASA data.'
                  : 'Real NASA assets and their source information appear here once loaded.'}
              </p>
            </>
          )}
        </div>
      )}
      <div className="sidebar-bottom">
        <div className="data-notice">
          <Icon name="database" />
          <div>
            <h3>Real science. Real sources.</h3>
            <p>
              No NASA datasets are loaded yet. Map layers will become available
              as data is integrated.
            </p>
          </div>
        </div>
        <details className="workspace-help">
          <summary>
            <Icon name="info" size={15} />
            About this workspace
            <Icon name="plus" size={14} />
          </summary>
          <p>
            This is the initial application shell. Pan and zoom the empty 2D
            viewport, choose a region, or preview the 3D placeholder. Routing
            and scientific measurements are not implemented.
          </p>
        </details>
      </div>
    </aside>
  )
}
