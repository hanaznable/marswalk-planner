import type { SurfaceImageryController } from './useSurfaceImagery'

export function SurfaceImageryControls({ controller }: { controller: SurfaceImageryController }) {
  const { state, mode } = controller
  if (state.status === 'none') return null
  return <section className="surface-imagery-controls" aria-label="Surface imagery style">
    <div className="surface-imagery-choice" role="group" aria-label="Basemap style">
      <button aria-pressed={mode === 'grayscale' || state.status !== 'ready'} onClick={() => controller.setMode('grayscale')}>Grayscale</button>
      <button aria-pressed={mode === 'rgb' && state.status === 'ready'} disabled={state.status !== 'ready'} onClick={() => controller.setMode('rgb')}>Enhanced RGB</button>
    </div>
    {state.status === 'loading' && <p role="status">Checking RGB imagery… Grayscale remains available.</p>}
    {state.status === 'error' && <div role="alert"><p>RGB unavailable: {state.message}</p><button onClick={controller.retry}>Retry RGB imagery</button></div>}
  </section>
}

/** Source information belongs in Data sources rather than the layer controls. */
export function SurfaceImageryDetails({ controller }: { controller: SurfaceImageryController }) {
  const { state } = controller
  if (state.status !== 'ready') return null
  return <details className="surface-imagery-controls">
    <summary>Enhanced RGB source and limitations</summary>
      <p>{state.manifest.colorCoverage}. {state.manifest.colorMeaning}.</p>
      <p>{state.manifest.registration}.</p>
      <a href={state.manifest.source.url} target="_blank" rel="noreferrer">{state.manifest.source.productId} - source ↗</a>
  </details>
}
