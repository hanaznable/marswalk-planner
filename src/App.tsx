import { useMemo, useState } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import { StatusBar } from './components/layout/StatusBar'
import { Icon } from './components/ui/Icon'
import { regions } from './features/datasets/regions'
import { LayersPanel } from './features/map/components/LayersPanel'
import { MapViewport } from './features/map/components/MapViewport'
import { useTerrainSource } from './features/map/useTerrainSource'
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
  // Real packages load over HTTP; synthetic terrain only when explicitly selected.
  const terrainState = useTerrainSource(region)
  const terrain = terrainState.status === 'ready' ? terrainState.terrain : null
  const dataset = terrainState.status === 'none' ? null : terrainState.dataset
  const waypoints = useWaypoints(terrain)
  // Scenario assumptions chosen by the user, not certified limits or an energy model.
  const [maxSlopeDegrees, setMaxSlopeDegrees] = useState(20)
  const [slopePenalty, setSlopePenalty] = useState(3)
  const assumptions = useMemo(
    () => ({ maxSlopeDegrees, slopePenalty }),
    [maxSlopeDegrees, slopePenalty],
  )
  const [returnToStart, setReturnToStart] = useState(false)
  const plan = useRoutePlan(terrain, waypoints.waypoints, assumptions, returnToStart)

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
        <LayersPanel showGrid={showGrid} onGridChange={setShowGrid} terrainState={terrainState} />
        <MapViewport
          region={region}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showGrid={showGrid}
          expanded={expanded}
          onExpand={() => setExpanded(!expanded)}
          terrainState={terrainState}
          waypoints={waypoints.waypoints}
          addMode={addMode}
          notice={waypoints.notice}
          onPlace={waypoints.place}
          onRelocate={waypoints.relocate}
          routes={plan?.alternatives ?? null}
        />
        <MissionPanel
          region={region}
          terrainState={terrainState}
          routePlanner={
            <RoutePlanner
              raster={terrain?.manifest.raster ?? null}
              waypoints={waypoints.waypoints}
              addMode={addMode}
              onToggleAddMode={() => setAddMode(!addMode)}
              onRemove={waypoints.remove}
              onReorder={waypoints.reorder}
              onClear={waypoints.clear}
              plan={plan}
              maxSlopeDegrees={maxSlopeDegrees}
              onMaxSlopeChange={setMaxSlopeDegrees}
              slopePenalty={slopePenalty}
              onSlopePenaltyChange={setSlopePenalty}
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
          {dataset
            ? `Terrain: ${dataset.title} (HiRISE, ${dataset.attribution}). Prototype data; science targets are not included yet.`
            : terrain?.manifest.synthetic
              ? 'Synthetic development terrain. Not NASA data.'
              : 'No terrain package is loaded for this region.'}
        </span>
      </div>
      <StatusBar terrainState={terrainState} />
    </div>
  )
}

export default App
