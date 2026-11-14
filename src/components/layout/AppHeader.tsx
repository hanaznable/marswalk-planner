import { regions } from '../../features/datasets/regions'
import { Icon } from '../ui/Icon'

interface AppHeaderProps {
  regionId: string
  onRegionChange: (id: string) => void
}

export function AppHeader({ regionId, onRegionChange }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark">
          <Icon name="planet" size={30} />
        </span>
        <span>
          MARSWALK<span className="brand-secondary">PLANNER</span>
        </span>
        <span className="version">v0.1</span>
      </div>
      <div className="header-divider" />
      <label className="region-picker">
        <span className="eyebrow">EXPLORATION REGION</span>
        <span className="region-select">
          <Icon name="pin" size={15} />
          <select
            value={regionId}
            onChange={(event) => onRegionChange(event.target.value)}
            aria-label="Exploration region"
          >
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </span>
      </label>
      <div className="header-program">
        <span className="program-mark">✳</span>
        <span>
          NASA SPACE APPS<span>CHALLENGE 2026 · PROJECT CONCEPT</span>
        </span>
      </div>
    </header>
  )
}
