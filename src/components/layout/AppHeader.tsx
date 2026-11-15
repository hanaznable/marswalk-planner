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
          POLARIS <span className="brand-module">Module</span>
        </h1>
      </div>
      <label className="region-picker">
        <span className="region-label">Region</span>
        <span className="region-select">
          <Icon name="pin" size={14} />
          <select value={regionId} onChange={(event) => onRegionChange(event.target.value)}>
            <optgroup label="Gale Crater">
              <option value="gale-pahrump-hills">Pahrump Hills</option>
            </optgroup>
          </select>
          <Icon name="chevron" size={12} />
        </span>
      </label>
    </header>
  )
}
