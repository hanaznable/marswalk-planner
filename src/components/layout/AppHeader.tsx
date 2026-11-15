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
        <h1 className="brand-name">
          Polaris <span className="brand-module">Module</span>
        </h1>
        <span className="brand-subtitle">Mars EVA route planner</span>
      </div>
      <label className="region-picker">
        <span className="region-label">Region</span>
        <span className="region-select">
          <Icon name="pin" size={14} />
          <select value={regionId} onChange={(event) => onRegionChange(event.target.value)}>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={12} />
        </span>
      </label>
      <p className="header-context">Prototype · 2026 NASA Space Apps Challenge</p>
    </header>
  )
}
