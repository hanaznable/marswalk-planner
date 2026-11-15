import { useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Icon } from '../../components/ui/Icon'
const TABS = ['route', 'science', 'library', 'mission'] as const
type Tab = (typeof TABS)[number]

export function MissionPanel({
  missionInfo,
  routePlanner,
  missionLibrary,
  scienceSuggestions,
}: {
  missionInfo: ReactNode
  routePlanner: ReactNode
  missionLibrary: ReactNode
  scienceSuggestions: ReactNode
}) {
  const [tab, setTab] = useState<Tab>('route')

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = TABS.indexOf(tab)
    const next =
      event.key === 'Home'
        ? TABS[0]
        : event.key === 'End'
          ? TABS[TABS.length - 1]
          : TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
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
          <Icon name="route" size={14} />
          Route
        </button>
        <button id="science-tab" role="tab" aria-selected={tab === 'science'} aria-controls="science-panel" tabIndex={tab === 'science' ? 0 : -1} onClick={() => setTab('science')}>
          <Icon name="flask" size={14} />
          Science
        </button>
        <button
          id="library-tab"
          role="tab"
          aria-selected={tab === 'library'}
          aria-controls="library-panel"
          tabIndex={tab === 'library' ? 0 : -1}
          onClick={() => setTab('library')}
        >
          <Icon name="database" size={14} />
          Missions
        </button>
        <button
          id="mission-tab"
          role="tab"
          aria-selected={tab === 'mission'}
          aria-controls="mission-panel"
          tabIndex={tab === 'mission' ? 0 : -1}
          onClick={() => setTab('mission')}
        >
          <Icon name="info" size={14} />
          Info
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
      <div id="science-panel" role="tabpanel" aria-labelledby="science-tab" tabIndex={0} hidden={tab !== 'science'}>{scienceSuggestions}</div>
      <div
        id="library-panel"
        role="tabpanel"
        aria-labelledby="library-tab"
        tabIndex={0}
        hidden={tab !== 'library'}
      >
        {missionLibrary}
      </div>
      <div
        id="mission-panel"
        className="mission-info"
        role="tabpanel"
        aria-labelledby="mission-tab"
        tabIndex={0}
        hidden={tab !== 'mission'}
      >
        {missionInfo}
      </div>
    </aside>
  )
}
