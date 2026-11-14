import { Icon } from '../../../components/ui/Icon'

/** Intentionally independent of the 2D renderer; no Three.js runtime yet. */
export function TerrainPlaceholder() {
  return (
    <div className="terrain-placeholder">
      <span className="terrain-icon">
        <Icon name="cube" size={52} />
      </span>
      <span className="eyebrow">A NEW PERSPECTIVE</span>
      <h2>The next dimension.</h2>
      <p>
        3D terrain visualization is planned.
        <br />A real elevation dataset will be required
        <br />
        before rendering the Martian surface.
      </p>
      <span className="empty-state-tag">3D RENDERING NOT IMPLEMENTED</span>
    </div>
  )
}
