import { useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Icon } from '../../components/ui/Icon'
import type { MarsRegion } from '../datasets/types'
import type { TerrainState } from '../map/useTerrainSource'

function terrainLabel(state: TerrainState): string {
  switch (state.status) {
    case 'loading':
      return `Loading ${state.dataset.title}…`
    case 'error':
      return 'Failed to load'
    case 'none':
      return 'No package for this region'
    case 'ready':
      return state.terrain.manifest.synthetic
        ? 'Synthetic (not NASA data)'
        : `${state.terrain.manifest.title} (HiRISE DTM)`
  }
}

export function MissionPanel({
  region,
  terrainState,
  routePlanner,
}: {
  region: MarsRegion
  terrainState: TerrainState
  routePlanner: ReactNode
}) {
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
        {routePlanner}
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
            <dt>Terrain</dt>
            <dd>{terrainLabel(terrainState)}</dd>
          </div>
          <div>
            <dt>Science targets</dt>
            <dd>Not included yet</dd>
          </div>
          <div>
            <dt>Surface conditions</dt>
            <dd>Not available</dd>
          </div>
        </dl>
        <p className="info-notice">
          {terrainState.status === 'ready' && !terrainState.terrain.manifest.synthetic
            ? 'Prototype HiRISE terrain: positions are not verified to absolute accuracy, and routes are not safety assessments. See the data catalog for all limitations.'
            : 'No mission observations, verified coordinates, or safety assessments are available.'}
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
        <ReadinessItem
          label="NASA terrain"
          ready={terrainState.status === 'ready' && !terrainState.terrain.manifest.synthetic}
          pending="PENDING"
        />
        <ReadinessItem label="Route planning" ready={terrainState.status === 'ready'} pending="NEEDS TERRAIN" />
        <div className="readiness-item">
          <span className="readiness-pending" />
          Science targets<span>PENDING</span>
        </div>
        <div className="readiness-item">
          <span className="readiness-pending" />
          3D visualization<span>PLANNED</span>
        </div>
      </div>
    </aside>
  )
}

function ReadinessItem({ label, ready, pending }: { label: string; ready: boolean; pending: string }) {
  return (
    <div className="readiness-item">
      {ready ? (
        <span className="readiness-check">
          <Icon name="check" size={12} />
        </span>
      ) : (
        <span className="readiness-pending" />
      )}
      {label}
      <span>{ready ? 'READY' : pending}</span>
    </div>
  )
}
