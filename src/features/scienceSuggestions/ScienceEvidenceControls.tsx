import { Icon } from '../../components/ui/Icon'

export function ScienceEvidenceControls({ available, visible, disabled, toggle }: {
  available: boolean
  visible: boolean
  disabled: boolean
  toggle: () => void
}) {
  const active = available && visible && !disabled
  return <div className="layer-row">
    <span className="layer-icon"><Icon name="pin" /></span>
    <div>
      <h3>Science missions</h3>
      <p>Investigation sites and orbital candidates</p>
      <span className={available ? `layer-loaded${active ? '' : ' layer-hidden'}` : 'unavailable'}>
        {disabled ? '2D VIEW ONLY' : available ? active ? 'SHOWN ON MAP' : 'HIDDEN' : 'NOT AVAILABLE'}
      </span>
    </div>
    <button className={`switch${active ? ' on' : ''}`} role="switch" aria-label="Show science missions on the map" aria-checked={active} disabled={!available || disabled} onClick={toggle}><span /></button>
  </div>
}
