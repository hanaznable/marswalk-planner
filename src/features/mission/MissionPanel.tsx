import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Icon } from '../../components/ui/Icon'
import type { MarsRegion } from '../datasets/types'
import { RoutePlanner } from '../routing/components/RoutePlanner'

export function MissionPanel({ region }: { region: MarsRegion }) {
  const [tab, setTab] = useState<'route' | 'mission'>('route')

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 'route'
        : event.key === 'End'
          ? 'mission'
          : tab === 'route'
            ? 'mission'
            : 'route'
    setTab(next)
    event.currentTarget
      .querySelector<HTMLButtonElement>(`#${next}-tab`)
      ?.focus()
  }

  return (
    <aside
      className="panel mission-panel"
      aria-label="Route planning and mission information"
    >
      <div className="panel-heading">
        <span className="eyebrow">MISSION CONTROL</span>
        <span className="panel-index">02</span>
      </div>
      <div
        className="mission-tabs"
        role="tablist"
        aria-label="Mission panel"
        onKeyDown={handleTabKeyDown}
      >
        <button
          id="route-tab"
          role="tab"
          aria-selected={tab === 'route'}
          aria-controls="route-panel"
          tabIndex={tab === 'route' ? 0 : -1}
          onClick={() => setTab('route')}
        >
          <Icon name="route" size={15} />
          Route planner
        </button>
        <button
          id="mission-tab"
          role="tab"
          aria-selected={tab === 'mission'}
          aria-controls="mission-panel"
          tabIndex={tab === 'mission' ? 0 : -1}
          onClick={() => setTab('mission')}
        >
          <Icon name="info" size={15} />
          Mission info
        </button>
      </div>
      <div
        id="route-panel"
        role="tabpanel"
        aria-labelledby="route-tab"
        tabIndex={0}
        hidden={tab !== 'route'}
      >
        <RoutePlanner />
      </div>
      <div
        id="mission-panel"
        className="mission-info"
        role="tabpanel"
        aria-labelledby="mission-tab"
        tabIndex={0}
        hidden={tab !== 'mission'}
      >
        <div className="section-heading">
          <h2>Mission information</h2>
        </div>
        <p className="panel-description">
          A foundation for future exploration.
        </p>
        <dl>
          <div>
            <dt>Selected region</dt>
            <dd>{region.name}</dd>
          </div>
          <div>
            <dt>Mission assignment</dt>
            <dd>Not configured</dd>
          </div>
          <div>
            <dt>Scientific datasets</dt>
            <dd>Not integrated</dd>
          </div>
          <div>
            <dt>Surface conditions</dt>
            <dd>Not available</dd>
          </div>
        </dl>
        <p className="info-notice">
          Region selection is for workspace navigation. No mission observations,
          coordinates, or safety assessments are available.
        </p>
      </div>
      <div className="mission-bottom">
        <div className="section-heading">
          <span className="eyebrow">WORKSPACE READINESS</span>
          <Icon name="compass" size={15} />
        </div>
        <div className="readiness-item">
          <span className="readiness-check">
            <Icon name="check" size={12} />
          </span>
          Application shell<span>READY</span>
        </div>
        <div className="readiness-item">
          <span className="readiness-pending" />
          NASA datasets<span>PENDING</span>
        </div>
        <div className="readiness-item">
          <span className="readiness-pending" />
          Route planning<span>PLANNED</span>
        </div>
        <div className="readiness-item">
          <span className="readiness-pending" />
          3D visualization<span>PLANNED</span>
        </div>
      </div>
    </aside>
  )
}
