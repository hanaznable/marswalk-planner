import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import type { Terrain3DViewProps } from './Terrain3DView'

// Three.js and the scene code load only when the 3D view is first opened.
const Terrain3DView = lazy(() => import('./Terrain3DView'))

interface Terrain3DPanelProps extends Omit<Terrain3DViewProps, 'onFailure'> {
  onUse2D: () => void
}

/** Lazy 3D view with loading, error and no-WebGL states that fall back to the 2D map. */
export function Terrain3DPanel({ onUse2D, ...props }: Terrain3DPanelProps) {
  const [failure, setFailure] = useState<{ terrain: Terrain3DViewProps['terrain']; message: string } | null>(null)
  const message = failure?.terrain === props.terrain ? failure.message : null
  if (message) return <Unavailable message={message} onUse2D={onUse2D} />
  return (
    <ViewErrorBoundary
      key={props.terrain.manifest.id}
      fallback={(error) => <Unavailable message={error} onUse2D={onUse2D} />}
    >
      <Suspense
        fallback={
          <div className="map-empty-state terrain-status" role="status">
            <span className="eyebrow">LOADING 3D VIEW</span>
          </div>
        }
      >
        <Terrain3DView {...props} onFailure={(text) => setFailure({ terrain: props.terrain, message: text })} />
      </Suspense>
    </ViewErrorBoundary>
  )
}

function Unavailable({ message, onUse2D }: { message: string; onUse2D: () => void }) {
  return (
    <div className="map-empty-state terrain-status terrain3d-status" role="alert">
      <span className="eyebrow">3D VIEW UNAVAILABLE</span>
      <p className="terrain-error">{message}</p>
      <p>Your plan is unchanged and the 2D map still works.</p>
      <button className="retry-button" onClick={onUse2D}>
        Use the 2D map
      </button>
    </div>
  )
}

class ViewErrorBoundary extends Component<
  { children: ReactNode; fallback: (message: string) => ReactNode },
  { message: string | null }
> {
  state = { message: null as string | null }

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : 'The 3D view failed to start.' }
  }

  render() {
    return this.state.message ? this.props.fallback(this.state.message) : this.props.children
  }
}
