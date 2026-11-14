import { describe, expect, it } from 'vitest'
import { parseScienceTargets, splitByCoverage } from '../../datasets/scienceTargets'
import { parseTerrainManifest } from '../../datasets/terrainContract'
import { createTerrainPackage, elevationAt } from '../../datasets/terrainPackage'
import type { DatasetMetadata } from '../../datasets/types'
import { elevationProfile, estimateDuration } from '../../eva/evaEstimate'
import type { EvaPlan } from '../../eva/useEvaPlan'
import { planAlternatives, summarizeRoute, terrainPackageToGrid, type Waypoint } from '../../routing'
import type { RoutePlan } from '../../routing/useRoutePlan'
import { buildMissionReport, missionReportFileName, type MissionReportInput } from './missionReport'

// Synthetic fixture: a 3 x 1 strip of 10 m cells, not NASA data. Middle cell is 30 degrees.
function strip(synthetic: boolean) {
  return createTerrainPackage(
    parseTerrainManifest({
      contractVersion: 1,
      id: 'test-strip',
      title: 'Test strip',
      synthetic,
      source: synthetic ? null : { productId: 'P1', url: 'https://example.org/p1', attribution: 'Test credit' },
      crs: { name: 'Test CRS', wkt: 'LOCAL_CS["test"]' },
      raster: { width: 3, height: 1, geoTransform: [1000, 10, 0, 2010, 0, -10] },
      layers: {
        elevation: { url: 'e.f32', dataType: 'float32' },
        slope: { url: 's.f32', dataType: 'float32' },
      },
    }),
    { elevation: Float32Array.from([10, 14, 12]), slope: Float32Array.from([0, 30, 0]) },
  )
}

const dataset: DatasetMetadata = {
  id: 'test-strip',
  title: 'Test strip',
  regionId: 'test',
  sourceUrl: 'https://example.org/p1',
  attribution: 'Test credit',
  coordinateReferenceSystem: 'Test CRS',
  processedAssetUrl: 'data/test/manifest.json',
  limitations: ['Test limitation.'],
  scienceTargetsUrl: null,
}

const start: Waypoint = { id: 'wp-1', label: 'Point 1', cell: { row: 0, col: 0 } }
const end: Waypoint = { id: 'wp-2', label: 'Point 2', cell: { row: 0, col: 2 } }
const assumptions = {
  maxSlopeDegrees: 20,
  slopePenalty: 3,
  returnToStart: false,
  walkingSpeedKmh: 1.2,
  stopMinutes: 10,
}

function input(overrides: Partial<MissionReportInput> = {}): MissionReportInput {
  const terrain = overrides.terrain ?? strip(false)
  const waypoints = overrides.waypoints ?? [start, end]
  const alternatives = planAlternatives(
    terrainPackageToGrid(terrain),
    { waypoints, returnToStart: assumptions.returnToStart },
    { maxSlopeDegrees: assumptions.maxSlopeDegrees, slopePenalty: assumptions.slopePenalty },
  )
  const elevation = (cell: Waypoint['cell']) => elevationAt(terrain, cell)
  const plan: RoutePlan = {
    alternatives,
    distanceSummary: summarizeRoute(alternatives.distance, elevation),
    terrainSummary: summarizeRoute(alternatives.terrain, elevation),
  }
  const eva: EvaPlan = {
    shortest: {
      duration: estimateDuration(alternatives.distance, assumptions),
      profile: elevationProfile(alternatives.distance, elevation, 10),
    },
    slopeAware: {
      duration: estimateDuration(alternatives.terrain, assumptions),
      profile: elevationProfile(alternatives.terrain, elevation, 10),
    },
  }
  return {
    generatedAt: new Date('2026-11-14T18:05:00Z'),
    terrain,
    dataset,
    waypoints,
    plan,
    eva,
    assumptions,
    scienceTargets: null,
    ...overrides,
  }
}

// Made-up targets on the strip, not NASA data: one on the start cell, one on
// the middle cell, one east of the strip.
function targetsOn(terrain: ReturnType<typeof strip>, synthetic: boolean) {
  const target = (id: string, x: number, basis: string) => ({
    id,
    name: `Target ${id}`,
    kind: 'drill-site',
    position: { x, y: 2005, uncertaintyMeters: null, basis },
    mission: synthetic ? null : 'MSL Curiosity',
    activitySol: synthetic ? null : 780,
    positionSol: synthetic ? null : 779,
    description: 'Made-up target for tests.',
    sources: synthetic
      ? []
      : [{ url: 'https://example.org/src', attribution: 'Test', provides: 'rover position' }],
  })
  const collection = parseScienceTargets({
    contractVersion: 1,
    id: 'test-targets',
    terrainPackageId: 'test-strip',
    terrainManifestSha256: 'c'.repeat(64),
    synthetic,
    targets: [
      target('a', 1005, 'rover-position-proxy'),
      target('b', 1015, 'target-location'),
      target('c', 2000, 'target-location'),
    ],
  })
  return { collection, ...splitByCoverage(collection, terrain) }
}

describe('buildMissionReport science targets', () => {
  const terrain = strip(false)

  it('is null when no targets are loaded', () => {
    const report = buildMissionReport(input())
    expect(report.scienceTargets).toBeNull()
    expect(report.disclaimers.join(' ')).not.toMatch(/Science target/)
  })

  it('links a waypoint to the target on its cell', () => {
    const report = buildMissionReport(input({ terrain, scienceTargets: targetsOn(terrain, false) }))
    expect(report.waypoints.map((waypoint) => waypoint.scienceTargetId)).toEqual(['a', null])
  })

  it('records every target with coverage, visits, caveat and sources', () => {
    const report = buildMissionReport(input({ terrain, scienceTargets: targetsOn(terrain, false) }))
    expect(report.scienceTargets?.collectionId).toBe('test-targets')
    expect(report.scienceTargets?.synthetic).toBe(false)
    const [a, b, c] = report.scienceTargets?.targets ?? []
    expect(a).toEqual({
      id: 'a',
      name: 'Target a',
      kind: 'drill-site',
      coverage: 'covered',
      visitedByWaypoints: [1],
      position: { x: 1005, y: 2005, uncertaintyMeters: null, basis: 'rover-position-proxy' },
      positionNote: 'Rover position associated with this target (proxy), not the exact location',
      mission: 'MSL Curiosity',
      activitySol: 780,
      positionSol: 779,
      description: 'Made-up target for tests.',
      sources: [{ url: 'https://example.org/src', attribution: 'Test', provides: 'rover position' }],
    })
    expect(b).toMatchObject({ coverage: 'covered', visitedByWaypoints: [] })
    expect(c).toMatchObject({ coverage: 'outsideTerrain', visitedByWaypoints: [] })
  })

  it('lists every waypoint that visits a target, including the return', () => {
    const middle: Waypoint = { id: 'wp-3', label: 'Target b', cell: { row: 0, col: 1 } }
    const again: Waypoint = { id: 'wp-4', label: 'Point 4', cell: { row: 0, col: 1 } }
    const report = buildMissionReport(
      input({ terrain, waypoints: [start, middle, again, end], scienceTargets: targetsOn(terrain, false) }),
    )
    expect(report.scienceTargets?.targets[1].visitedByWaypoints).toEqual([2, 3])
  })

  it('states the position caveat for real targets and the fixture label for synthetic ones', () => {
    const real = buildMissionReport(input({ terrain, scienceTargets: targetsOn(terrain, false) }))
    expect(real.disclaimers.join(' ')).toMatch(/rover-position proxy is not the exact target location/)
    const fake = buildMissionReport(input({ terrain, scienceTargets: targetsOn(terrain, true) }))
    expect(fake.disclaimers.join(' ')).toMatch(/synthetic development fixtures: made-up, not NASA data/)
  })

  it('serialises targets to JSON unchanged', () => {
    const report = buildMissionReport(input({ terrain, scienceTargets: targetsOn(terrain, false) }))
    expect(JSON.parse(JSON.stringify(report))).toEqual(report)
  })
})

describe('buildMissionReport', () => {
  it('records the terrain source, projection, grid and limitations', () => {
    const report = buildMissionReport(input())
    expect(report.format).toBe('marswalk-mission-report')
    expect(report.version).toBe(1)
    expect(report.generatedAt).toBe('2026-11-14T18:05:00.000Z')
    expect(report.terrain).toEqual({
      id: 'test-strip',
      title: 'Test strip',
      synthetic: false,
      source: { productId: 'P1', url: 'https://example.org/p1', attribution: 'Test credit' },
      crsName: 'Test CRS',
      cellSizeMeters: 10,
      limitations: ['Test limitation.'],
    })
  })

  it('labels synthetic terrain and claims no source', () => {
    const report = buildMissionReport(input({ terrain: strip(true), dataset: null }))
    expect(report.terrain.synthetic).toBe(true)
    expect(report.terrain.source).toBeNull()
    expect(report.terrain.limitations).toEqual([
      'Synthetic development terrain: made-up values, not NASA data.',
    ])
  })

  it('lists waypoints with role, local metres, source coordinates and elevation', () => {
    const [first, last] = buildMissionReport(input()).waypoints
    expect(first).toEqual({
      order: 1,
      id: 'wp-1',
      role: 'Start',
      label: 'Point 1',
      cell: { row: 0, col: 0 },
      localMetres: { east: 5, north: 5 },
      sourceCrs: { x: 1005, y: 2005 },
      elevationMeters: 10,
      scienceTargetId: null,
    })
    expect(last.role).toBe('Destination')
    expect(last.sourceCrs).toEqual({ x: 1025, y: 2005 })
  })

  it('records the shortest route with its legs, path, totals and duration', () => {
    const { routes } = buildMissionReport(input())
    expect(routes?.shortest).toMatchObject({
      complete: true,
      distanceMeters: 20,
      elevationGainMeters: 4,
      elevationLossMeters: 2,
      duration: { walkingMinutes: 1, stopMinutes: 10, totalMinutes: 11 },
    })
    expect(routes?.shortest.legs).toEqual([
      {
        kind: 'outbound',
        from: 'Start',
        to: 'Destination',
        status: 'ok',
        distanceMeters: 20,
        failure: null,
        path: [
          { x: 1005, y: 2005 },
          { x: 1015, y: 2005 },
          { x: 1025, y: 2005 },
        ],
      },
    ])
  })

  it('explains a failed leg and leaves its totals empty instead of zero', () => {
    const { routes } = buildMissionReport(input())
    expect(routes?.slopeAware).toMatchObject({
      complete: false,
      distanceMeters: null,
      elevationGainMeters: null,
      duration: null,
    })
    expect(routes?.slopeAware.legs[0]).toMatchObject({
      status: 'failed',
      distanceMeters: null,
      path: [],
      failure: 'Every way through is steeper than the slope limit.',
    })
    expect(routes?.identical).toBe(false)
  })

  it('has no routes section until there are two waypoints', () => {
    const report = buildMissionReport(input({ waypoints: [start], plan: null, eva: null }))
    expect(report.routes).toBeNull()
    expect(report.waypoints).toHaveLength(1)
  })

  it('copies every planning assumption and states the disclaimers', () => {
    const report = buildMissionReport(input())
    expect(report.assumptions).toEqual(assumptions)
    expect(report.disclaimers.join(' ')).toMatch(/not an operationally validated/)
    expect(report.disclaimers.join(' ')).toMatch(/scenario assumptions/)
    expect(report.disclaimers.join(' ')).toMatch(/not a physiological model/)
  })

  it('serialises to JSON without losing or inventing values', () => {
    const report = buildMissionReport(input())
    expect(JSON.parse(JSON.stringify(report))).toEqual(report)
  })
})

describe('missionReportFileName', () => {
  it('names the file after the terrain and the UTC time', () => {
    expect(missionReportFileName(buildMissionReport(input()))).toBe(
      'marswalk-mission-test-strip-20261114-1805Z.json',
    )
  })
})
