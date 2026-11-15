import { Icon } from '../../components/ui/Icon'
import type { TerrainPackage } from '../datasets/terrainPackage'
import { rasterScale } from './rasterDisplay'
import type { ContextDisplay, DisplayLayersController, RasterDisplay } from './useDisplayLayers'
import './style.css'

export function MapLayerControls({ terrain, controller }: { terrain: TerrainPackage | null; controller: DisplayLayersController }) {
  const { settings, state } = controller
  return <>
    {(['elevation', 'slope'] as const).map((kind: RasterDisplay) => {
      const scale = terrain ? rasterScale(terrain, kind) : null
      const active = terrain !== null && settings.raster === kind
      const description = kind === 'elevation' ? 'Surface height (m)' : 'Terrain steepness (°)'
      return <div className="layer-row" key={kind}>
        <span className="layer-icon"><Icon name="mountain" /></span>
        <div>
          <h3>{kind === 'elevation' ? 'Elevation' : 'Slope'}</h3>
          <p>{description}</p>
          <span className={terrain ? `layer-loaded${active ? '' : ' layer-hidden'}` : 'unavailable'} title={terrain ? 'Visibility only; hiding this layer does not change route calculations.' : undefined}>{terrain ? active ? 'SHOWN ON MAP' : 'HIDDEN' : 'AWAITING TERRAIN'}</span>
          {active && scale && <>
            <div className={`display-legend display-legend-${kind}`}>{Number.isFinite(scale.min) ? `${scale.min.toFixed(1)} — ${scale.max.toFixed(1)} ${scale.unit}` : 'No valid samples'}</div>
            <label className="display-opacity">Opacity {Math.round(settings.opacity * 100)}%<input type="range" min="0" max="100" value={Math.round(settings.opacity * 100)} onChange={(event) => controller.setOpacity(Number(event.target.value) / 100)} aria-label={`${kind} layer opacity`} /></label>
          </>}
        </div>
        <button className={`switch${active ? ' on' : ''}`} role="switch" aria-checked={active} aria-label={`Show ${kind} on the map`} disabled={!terrain} onClick={() => controller.setRaster(active ? null : kind)}><span /></button>
      </div>
    })}
    {([
      ['apxs', 'APXS observations', 'Rock chemistry observations'],
      ['traverse', 'Historical traverse', "Curiosity's historical path"],
      ['minerals', 'Mineral finding', 'Tridymite identified in the Buckskin sample'],
    ] as const).map(([kind, title, detail]: readonly [ContextDisplay, string, string]) => <div className="layer-row" key={kind}>
      <span className="layer-icon"><Icon name={kind === 'traverse' ? 'layers' : 'pin'} /></span>
      <div>
        <h3>{title}</h3><p>{detail}</p>
        <span className={state.status === 'ready' ? `layer-loaded${settings[kind] ? '' : ' layer-hidden'}` : 'unavailable'}>{state.status === 'ready' ? settings[kind] ? 'SHOWN ON MAP' : 'HIDDEN' : state.status === 'loading' ? 'LOADING' : state.status === 'error' ? 'LOAD FAILED' : 'NOT AVAILABLE FOR THIS REGION'}</span>
      </div>
      <button className={`switch${settings[kind] && state.status === 'ready' ? ' on' : ''}`} role="switch" aria-checked={settings[kind] && state.status === 'ready'} aria-label={`Show ${title.toLowerCase()} on the map`} disabled={state.status !== 'ready'} onClick={() => controller.toggleContext(kind)}><span /></button>
    </div>)}
    {state.status === 'error' && <div className="display-load-error" role="alert"><p>Context layers could not load: {state.message}</p><button onClick={controller.retry}>Retry context layers</button></div>}
  </>
}
