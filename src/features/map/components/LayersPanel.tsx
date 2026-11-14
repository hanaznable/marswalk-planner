import { useState } from 'react'
import { Icon, type IconName } from '../../../components/ui/Icon'
import { datasetRegistry } from '../../datasets/registry'

const plannedLayers: { title: string; description: string; icon: IconName }[] =
  [
    {
      title: 'Surface imagery',
      description: 'Orbital image basemap',
      icon: 'image',
    },
    {
      title: 'Elevation model',
      description: 'Surface topography',
      icon: 'mountain',
    },
    {
      title: 'Science targets',
      description: 'Points of scientific interest',
      icon: 'pin',
    },
  ]

export function LayersPanel({
  showGrid,
  onGridChange,
}: {
  showGrid: boolean
  onGridChange: (value: boolean) => void
}) {
  const [section, setSection] = useState<'layers' | 'datasets'>('layers')

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
          Data catalog<span className="count">{datasetRegistry.length}</span>
        </button>
      </nav>
      {section === 'layers' ? (
        <>
          <div className="section-heading">
            <h2>Map layers</h2>
            <span className="small-label">0 ACTIVE</span>
          </div>
          <p className="panel-description">
            Build a clearer picture of the surface.
          </p>
          <div className="layer-list">
            {plannedLayers.map((layer) => (
              <div className="layer-row" key={layer.title}>
                <span className="layer-icon">
                  <Icon name={layer.icon} />
                </span>
                <div>
                  <h3>{layer.title}</h3>
                  <p>{layer.description}</p>
                  <span className="unavailable">AWAITING DATA</span>
                </div>
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
            <span className="small-label">0 LOADED</span>
          </div>
          <div className="catalog-icon">
            <Icon name="database" size={28} />
          </div>
          <h3>No datasets connected</h3>
          <p>
            Real NASA mission assets and their source information will appear
            here once integrated.
          </p>
          <span className="tag">INTEGRATION PENDING</span>
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
