import { describe, expect, it } from 'vitest'
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
    ...overrides,
  }
}

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
