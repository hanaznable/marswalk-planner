import { useMemo, useState } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import { StatusBar } from './components/layout/StatusBar'
import { Icon } from './components/ui/Icon'
import { regions } from './features/datasets/regions'
import { LayersPanel } from './features/map/components/LayersPanel'
import { MapViewport } from './features/map/components/MapViewport'
import { createSyntheticTerrain } from './features/map/fixtures/syntheticTerrain'
import { useWaypoints } from './features/map/useWaypoints'
import { MissionPanel } from './features/mission/MissionPanel'
import { RoutePlanner } from './features/routing/components/RoutePlanner'
import { useRoutePlan } from './features/routing/useRoutePlan'
import type { ViewMode } from './features/map/types'
import './App.css'

function App() {
  const [regionId, setRegionId] = useState(regions[0].id)
  const [viewMode, setViewMode] = useState<ViewMode>('2d')
  const [showGrid, setShowGrid] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [addMode, setAddMode] = useState(false)
  const region = regions.find((item) => item.id === regionId) ?? regions[0]
  // Synthetic development terrain until Developer B delivers a real package.
  const terrain = useMemo(() => createSyntheticTerrain(), [])
  const waypoints = useWaypoints(terrain)
  // Scenario assumption chosen by the user, not a certified limit.
  const [maxSlopeDegrees, setMaxSlopeDegrees] = useState(20)
  const [returnToStart, setReturnToStart] = useState(false)
  const plan = useRoutePlan(terrain, waypoints.waypoints, maxSlopeDegrees, returnToStart)

  return (
    <div className={`app-shell${expanded ? ' map-expanded' : ''}`}>
      <a className="skip-link" href="#map-viewport">
        Skip to map
      </a>
      <AppHeader regionId={regionId} onRegionChange={setRegionId} />
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">
            MISSION WORKSPACE <span>/</span> MARS
          </p>
          <h1>
            Surface exploration<span className="title-dot">.</span>
          </h1>
        </div>
        <div className="workspace-state">
          <span className="status-dot" /> Workspace initialized{' '}
          <span className="tag">PREVIEW</span>
        </div>
      </div>
      <main className="workspace" aria-label="Mars exploration workspace">
        <LayersPanel showGrid={showGrid} onGridChange={setShowGrid} />
        <MapViewport
          region={region}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showGrid={showGrid}
          expanded={expanded}
          onExpand={() => setExpanded(!expanded)}
          terrain={terrain}
          waypoints={waypoints.waypoints}
          addMode={addMode}
          notice={waypoints.notice}
          onPlace={waypoints.place}
          onRelocate={waypoints.relocate}
          routes={plan?.alternatives ?? null}
        />
        <MissionPanel
          region={region}
          routePlanner={
            <RoutePlanner
              raster={terrain.manifest.raster}
              waypoints={waypoints.waypoints}
              addMode={addMode}
              onToggleAddMode={() => setAddMode(!addMode)}
              onRemove={waypoints.remove}
              onReorder={waypoints.reorder}
              onClear={waypoints.clear}
              plan={plan}
              maxSlopeDegrees={maxSlopeDegrees}
              onMaxSlopeChange={setMaxSlopeDegrees}
              returnToStart={returnToStart}
              onReturnToStartChange={setReturnToStart}
            />
          }
        />
      </main>
      <div className="workspace-note">
        <Icon name="info" size={14} />
        <span>Built for exploration. Grounded in real data.</span>
        <span className="note-detail">
          NASA mission datasets will be connected in a future integration.
        </span>
      </div>
      <StatusBar />
    </div>
  )
}

export default App
