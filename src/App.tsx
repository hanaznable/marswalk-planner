import { useCallback, useMemo, useState } from 'react'
import { AppHeader } from './components/layout/AppHeader'
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
import { MissionLibrary, type MissionStatus } from './features/missions/MissionLibrary'
import { checkCompatibility, createMissionRecord, type MissionRecord } from './features/missions/missionRecord'
import { useMissionLibrary } from './features/missions/useMissionLibrary'
import './App.css'

const NO_TARGETS: readonly PlacedTarget[] = []

function App() {
  const [regionId, setRegionId] = useState(regions[0].id)
  const [viewMode, setViewMode] = useState<ViewMode>('2d')
  const [showGrid, setShowGrid] = useState(false)
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

  // Named missions (browser-local library).
  const library = useMissionLibrary()
  const [activeMission, setActiveMission] = useState<{ id: string; name: string; terrainId: string } | null>(null)
  const [pendingMission, setPendingMission] = useState<MissionRecord | null>(null)
  const [missionStatus, setMissionStatus] = useState<MissionStatus | null>(null)
  // A saved mission is "open" only while its own terrain is shown.
  const openMission = terrain && activeMission?.terrainId === terrain.manifest.id ? activeMission : null

  // Opening may switch region. The mission is applied once that region's terrain
  // and science targets have settled: a guarded state update during render
  // (React's "adjust state when inputs change" pattern), so routes are planned
  // from the restored inputs on the next render without an extra effect pass.
  if (pendingMission) {
    if (terrainState.status === 'error' || terrainState.status === 'none') {
      setPendingMission(null)
      setMissionStatus({
        tone: 'error',
        text: `"${pendingMission.name}" was not opened: the terrain for its region is not available.`,
      })
    } else if (terrainState.status === 'ready' && targets.status !== 'loading') {
      const opened = terrainState.terrain
      const result = checkCompatibility(pendingMission, opened, targets.status === 'ready' ? targets.collection : null)
      setPendingMission(null)
      if (!result.ok) {
        setMissionStatus({ tone: 'error', text: `"${pendingMission.name}" was not opened.`, details: result.reasons })
      } else {
        const { settings, selectedTargetId: savedTarget } = pendingMission
        waypoints.restore(opened.manifest.id, result.waypoints, result.origins)
        setMaxSlopeDegrees(settings.maxSlopeDegrees)
        setSlopePenalty(settings.slopePenalty)
        setReturnToStart(settings.returnToStart)
        setEvaAssumptions({ walkingSpeedKmh: settings.walkingSpeedKmh, stopMinutes: settings.stopMinutes })
        const known = targets.status === 'ready' && targets.inside.some(({ target }) => target.id === savedTarget)
        setSelectedTargetId(known ? savedTarget : null)
        setAddMode(false)
        setActiveMission({ id: pendingMission.id, name: pendingMission.name, terrainId: opened.manifest.id })
        setMissionStatus({
          tone: result.warnings.length > 0 ? 'warning' : 'info',
          text: `Opened "${pendingMission.name}". Routes and estimates were recalculated.`,
          details: result.warnings,
        })
      }
    }
  }

  const startOpening = (record: MissionRecord) => {
    const target = regions.find((item) => item.id === record.regionId)
    if (!target) {
      setMissionStatus({ tone: 'error', text: `"${record.name}" was not opened: its region (${record.regionId}) no longer exists.` })
      return
    }
    setMissionStatus(null)
    setRegionId(target.id)
    setPendingMission(record)
  }

  const saveMission = (name: string, asNew: boolean) => {
    if (!terrain) return
    const id = !asNew && openMission ? openMission.id : crypto.randomUUID()
    let record: MissionRecord
    try {
      record = createMissionRecord(
        {
          name,
          regionId,
          terrain,
          scienceTargets: targets.status === 'ready' ? targets.collection : null,
          waypoints: waypoints.waypoints,
          origins: waypoints.origins,
          settings: { maxSlopeDegrees, slopePenalty, returnToStart, ...evaAssumptions },
          selectedTargetId,
        },
        id,
        new Date(),
      )
    } catch (error) {
      setMissionStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
      return
    }
    const result = library.save(record)
    if (!result.ok) {
      setMissionStatus({ tone: 'error', text: `"${record.name}" was not saved. ${result.message}` })
      return
    }
    setActiveMission({ id: record.id, name: record.name, terrainId: terrain.manifest.id })
    setMissionStatus({ tone: 'info', text: `Saved "${record.name}" in this browser.` })
  }

  const deleteMission = (record: MissionRecord) => {
    const error = library.remove(record.id)
    if (error) {
      setMissionStatus({ tone: 'error', text: `"${record.name}" was not deleted. ${error}` })
      return
    }
    if (activeMission?.id === record.id) setActiveMission(null)
    setMissionStatus({ tone: 'info', text: `Deleted "${record.name}". The plan on the map is unchanged.` })
  }

  const importMission = async (file: File) => {
    const result = await library.importFile(file)
    setMissionStatus(
      result.ok
        ? { tone: 'info', text: `Imported "${result.record.name}". Open it to load it on the map.` }
        : { tone: 'error', text: result.message },
    )
  }

  return (
    <div className={`app-shell${expanded ? ' map-expanded' : ''}`}>
      <a className="skip-link" href="#map-viewport">
        Skip to map
      </a>
      <AppHeader regionId={regionId} onRegionChange={setRegionId} />
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
          missionLibrary={
            <MissionLibrary
              missions={library.missions}
              active={openMission}
              canSave={terrain !== null && waypoints.waypoints.length > 0}
              saveHint={
                !terrain
                  ? 'Load terrain to save a mission.'
                  : waypoints.waypoints.length === 0
                    ? 'Place at least one waypoint to save a mission.'
                    : 'Saves the waypoints, science selections and route settings with the terrain version.'
              }
              hasPlan={waypoints.waypoints.length > 0}
              status={missionStatus}
              skipped={library.skipped}
              storageError={library.storageError}
              opening={pendingMission !== null}
              onSave={saveMission}
              onOpen={startOpening}
              onExport={library.exportFile}
              onDelete={deleteMission}
              onImport={(file) => void importMission(file)}
            />
          }
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
