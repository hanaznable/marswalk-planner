import { useCallback, useMemo, useState } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import { StatusBar } from './components/layout/StatusBar'
import { Icon } from './components/ui/Icon'
import { regions } from './features/datasets/regions'
import { LayersPanel } from './features/map/components/LayersPanel'
import { MapViewport } from './features/map/components/MapViewport'
import { useTerrainSource } from './features/map/useTerrainSource'
import { useWaypoints } from './features/map/useWaypoints'
import { MissionPanel } from './features/mission/MissionPanel'
import { downloadMissionReport } from './features/mission/report/downloadMissionReport'
import { MissionReportDialog } from './features/mission/report/MissionReportDialog'
import { buildMissionReport, type MissionReport } from './features/mission/report/missionReport'
import { RoutePlanner } from './features/routing/components/RoutePlanner'
import { useRoutePlan } from './features/routing/useRoutePlan'
import type { EvaAssumptions } from './features/eva/evaEstimate'
import { useEvaPlan } from './features/eva/useEvaPlan'
import type { ViewMode } from './features/map/types'
import type { PlacedTarget } from './features/datasets/scienceTargets'
import { ScienceTargetBrowser } from './features/science/components/ScienceTargetBrowser'
import { waypointAtCell } from './features/science/targetDisplay'
import { useScienceTargets } from './features/science/useScienceTargets'
import { useDisplayLayers } from './features/mapLayers/useDisplayLayers'
import { useSurfaceImagery } from './features/mapLayers/useSurfaceImagery'
import { placeWaypoint } from './features/map/waypointPlacement'
import type { MapPoint } from './features/datasets/terrainContract'
import type { WaypointOrigin } from './features/datasets/waypointOrigin'
import { useBasemapStatus } from './features/map/useBasemapStatus'
import './App.css'

const NO_TARGETS: readonly PlacedTarget[] = []

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
  // Only a successfully loaded real package is named as the active terrain.
  const dataset = terrainState.status === 'ready' ? terrainState.dataset : null
  const waypoints = useWaypoints(terrain)
  const targets = useScienceTargets(terrain, dataset)
  const displayLayers = useDisplayLayers(terrain, dataset)
  const surfaceImagery = useSurfaceImagery(terrain, dataset)
  const basemap = useBasemapStatus(surfaceImagery.mode === 'rgb' && surfaceImagery.state.status === 'ready'
    ? surfaceImagery.state.url : terrainState.status === 'ready' ? terrainState.basemapUrl : null)
  const [showTargets, setShowTargets] = useState(true)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const placedTargets = targets.status === 'ready' ? targets.inside : NO_TARGETS
  const addTargetWaypoint = ({ target, cell }: PlacedTarget) => {
    if (!waypointAtCell(waypoints.waypoints, cell)) waypoints.addAtCell(cell, target.name)
  }
  const addContextWaypoint = (point: MapPoint, label: string, origin: WaypointOrigin) => {
    if (!terrain) return
    const placement = placeWaypoint(terrain, point)
    if (placement.ok && !waypointAtCell(waypoints.waypoints, placement.cell)) {
      waypoints.addAtCell(placement.cell, label, origin)
    }
  }
  const handleTargetClick = (id: string) => {
    setSelectedTargetId(id)
    // In add mode a target click places a waypoint on it, like a terrain click.
    const placed = placedTargets.find(({ target }) => target.id === id)
    if (addMode && placed) addTargetWaypoint(placed)
  }
  // Scenario assumptions chosen by the user, not certified limits or an energy model.
  const [maxSlopeDegrees, setMaxSlopeDegrees] = useState(20)
  const [slopePenalty, setSlopePenalty] = useState(3)
  const assumptions = useMemo(
    () => ({ maxSlopeDegrees, slopePenalty }),
    [maxSlopeDegrees, slopePenalty],
  )
  const [returnToStart, setReturnToStart] = useState(false)
  const plan = useRoutePlan(terrain, waypoints.waypoints, assumptions, returnToStart)
  const [evaAssumptions, setEvaAssumptions] = useState<EvaAssumptions>({
    walkingSpeedKmh: 2,
    stopMinutes: 15,
  })
  const eva = useEvaPlan(plan, terrain, evaAssumptions)
  const [report, setReport] = useState<MissionReport | null>(null)
  const closeReport = useCallback(() => setReport(null), [])

  // Built on demand so generatedAt is the moment of export.
  const currentReport = () =>
    terrain
      ? buildMissionReport({
          generatedAt: new Date(),
          terrain,
          dataset,
          waypoints: waypoints.waypoints,
          waypointOrigins: waypoints.origins,
          plan,
          eva,
          assumptions: { maxSlopeDegrees, slopePenalty, returnToStart, ...evaAssumptions },
          scienceTargets: targets.status === 'ready' ? targets : null,
        })
      : null

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
        <LayersPanel
          showGrid={showGrid}
          onGridChange={setShowGrid}
          terrainState={terrainState}
          targetsState={targets}
          showTargets={showTargets}
          onShowTargetsChange={setShowTargets}
          displayLayers={displayLayers}
          surfaceImagery={surfaceImagery}
          basemap={basemap}
          targetBrowser={
            <ScienceTargetBrowser
              state={targets}
              selectedId={selectedTargetId}
              onSelect={setSelectedTargetId}
              waypoints={waypoints.waypoints}
              onAddWaypoint={addTargetWaypoint}
            />
          }
        />
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
          targets={showTargets ? placedTargets : NO_TARGETS}
          selectedTargetId={selectedTargetId}
          onTargetClick={handleTargetClick}
          onContextWaypoint={addContextWaypoint}
          displayLayers={displayLayers}
          surfaceImagery={surfaceImagery}
          basemap={basemap}
        />
        <MissionPanel
          region={region}
          terrainState={terrainState}
          targetsState={targets}
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
              eva={eva}
              evaAssumptions={evaAssumptions}
              onEvaAssumptionsChange={setEvaAssumptions}
              synthetic={terrain?.manifest.synthetic ?? false}
              returnToStart={returnToStart}
              onReturnToStartChange={setReturnToStart}
              exportAvailable={terrain !== null && waypoints.waypoints.length > 0}
              onOpenReport={() => setReport(currentReport())}
              onDownloadJson={() => {
                const next = currentReport()
                if (next) downloadMissionReport(next)
              }}
            />
          }
        />
      </main>
      <div className="workspace-note">
        <Icon name="info" size={14} />
        <span>Built for exploration. Grounded in real data.</span>
        <span className="note-detail">
          {dataset
            ? `Terrain: ${dataset.title} (HiRISE, ${dataset.attribution}). Prototype data; ${
                targets.status === 'ready'
                  ? 'science target positions carry the caveats shown with each target.'
                  : 'science targets are not included yet.'
              }`
            : terrain?.manifest.synthetic
              ? 'Synthetic development terrain. Not NASA data.'
              : terrainState.status === 'loading'
                ? 'Loading the terrain package…'
                : terrainState.status === 'error'
                  ? 'The terrain package failed to load; no other terrain is shown in its place.'
                  : 'No terrain package exists for this region yet.'}
        </span>
      </div>
      <StatusBar terrainState={terrainState} />
      {report && (
        <MissionReportDialog
          report={report}
          onClose={closeReport}
          onDownloadJson={() => downloadMissionReport(report)}
        />
      )}
    </div>
  )
}

export default App
