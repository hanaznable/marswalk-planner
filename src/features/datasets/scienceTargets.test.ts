import { describe, expect, it } from 'vitest'
import {
  describePosition,
  parseScienceTargets,
  ScienceTargetContractError,
  splitByCoverage,
} from './scienceTargets'
import { parseTerrainManifest } from './terrainContract'
import { createTerrainPackage } from './terrainPackage'

const HASH = 'a'.repeat(64)

// Synthetic fixture: made-up targets and positions, not NASA data.
function syntheticTarget(): Record<string, unknown> {
  return {
    id: 't1',
    name: 'Test outcrop',
    kind: 'traverse-point',
    position: { x: 5, y: 15, uncertaintyMeters: null, basis: 'target-location' },
    mission: null,
    activitySol: null,
    positionSol: null,
    description: 'Made-up point for tests.',
    sources: [],
  }
}

function validCollection(): Record<string, unknown> {
  return {
    contractVersion: 1,
    id: 'synthetic-targets',
    terrainPackageId: 'synthetic-test',
    terrainManifestSha256: HASH,
    synthetic: true,
    targets: [syntheticTarget()],
  }
}

// Shaped like Developer B's delivery; values are placeholders, not NASA data.
const realTarget = {
  id: 'r1',
  name: 'Drill target placeholder',
  kind: 'drill-site',
  position: { x: 5, y: 15, uncertaintyMeters: null, basis: 'rover-position-proxy' },
  mission: 'MSL Curiosity',
  activitySol: 780,
  positionSol: 779,
  description: 'Rover position associated with the drill activity, not the drill-hole location.',
  sources: [
    { url: 'https://example.org/waypoints', attribution: 'NASA/JPL-Caltech', provides: 'rover position' },
    { url: 'https://example.org/presentation', attribution: 'NASA', provides: 'target association' },
  ],
}

function issuesOf(input: unknown): string[] {
  try {
    parseScienceTargets(input)
  } catch (error) {
    if (error instanceof ScienceTargetContractError) return error.issues
    throw error
  }
  return []
}

const withTarget = (target: Record<string, unknown>, collection = validCollection()) => ({
  ...collection,
  targets: [target],
})

describe('parseScienceTargets', () => {
  it('accepts a valid synthetic collection', () => {
    const collection = parseScienceTargets(validCollection())
    expect(collection.targets).toHaveLength(1)
    expect(collection.targets[0].position.basis).toBe('target-location')
  })

  it('accepts a real collection with separate position and association sources', () => {
    const collection = parseScienceTargets({ ...validCollection(), synthetic: false, targets: [realTarget] })
    expect(collection.targets[0].sources.map((source) => source.provides)).toEqual([
      'rover position',
      'target association',
    ])
    expect(collection.targets[0].activitySol).toBe(780)
    expect(collection.targets[0].positionSol).toBe(779)
  })

  it('requires sources on every real target and forbids them on synthetic ones', () => {
    expect(issuesOf({ ...validCollection(), synthetic: false })).toContain(
      'targets[0].sources must list at least one source when synthetic is false',
    )
    expect(issuesOf(withTarget(realTarget))).toContain(
      'targets[0].sources must be empty when synthetic is true',
    )
  })

  it('requires url, attribution and what each source provides', () => {
    const target = { ...realTarget, sources: [{ url: '', attribution: 'NASA', provides: '' }] }
    expect(issuesOf({ ...validCollection(), synthetic: false, targets: [target] })).toEqual(
      expect.arrayContaining([
        'targets[0].sources[0].url must be a non-empty string',
        'targets[0].sources[0].provides must be a non-empty string',
      ]),
    )
  })

  it('requires an explicit position basis', () => {
    const target = { ...syntheticTarget(), position: { x: 5, y: 15, uncertaintyMeters: null } }
    expect(issuesOf(withTarget(target))).toContain(
      'targets[0].position.basis must be one of rover-position-proxy, target-location',
    )
  })

  it('rejects unknown kinds, non-finite positions and negative uncertainty', () => {
    const target = {
      ...syntheticTarget(),
      kind: 'rock',
      position: { x: Number.NaN, y: 1, uncertaintyMeters: -1, basis: 'target-location' },
    }
    expect(issuesOf(withTarget(target))).toEqual(
      expect.arrayContaining([
        'targets[0].kind must be one of drill-site, observation-site, landing-site, traverse-point, landmark',
        'targets[0].position.x and .y must be finite numbers',
        'targets[0].position.uncertaintyMeters must be null or a non-negative number',
      ]),
    )
  })

  it('validates the activity sol and the position-record sol separately', () => {
    const target = { ...syntheticTarget(), activitySol: 12.5, positionSol: -1 }
    expect(issuesOf(withTarget(target))).toEqual(
      expect.arrayContaining([
        'targets[0].activitySol must be null or a non-negative integer',
        'targets[0].positionSol must be null or a non-negative integer',
      ]),
    )
  })

  it('rejects duplicate target ids', () => {
    const input = validCollection()
    input.targets = [syntheticTarget(), syntheticTarget()]
    expect(issuesOf(input)).toContain('target id "t1" is used more than once')
  })

  it('requires the terrain package id, a manifest hash and a supported version', () => {
    expect(issuesOf({ ...validCollection(), terrainPackageId: '' })).toContain(
      'terrainPackageId must be a non-empty string',
    )
    expect(issuesOf({ ...validCollection(), terrainManifestSha256: 'abc' })).toContain(
      'terrainManifestSha256 must be 64 hexadecimal characters',
    )
    expect(issuesOf({ ...validCollection(), contractVersion: 2 })).toContain(
      'contractVersion must be 1',
    )
  })

  it('rejects input that is not an object', () => {
    expect(issuesOf('nope')).toEqual(['science target collection must be an object'])
  })
})

describe('describePosition', () => {
  it('never lets a proxy read as an exact location', () => {
    const collection = parseScienceTargets({ ...validCollection(), synthetic: false, targets: [realTarget] })
    expect(describePosition(collection.targets[0])).toBe(
      'Rover position associated with this target (proxy), not the exact location',
    )
  })

  it('states when the uncertainty is unknown or given', () => {
    const exact = parseScienceTargets(validCollection()).targets[0]
    expect(describePosition(exact)).toBe('Target location; uncertainty not stated by the source')
    const withUncertainty = parseScienceTargets(
      withTarget({ ...syntheticTarget(), position: { x: 5, y: 15, uncertaintyMeters: 3, basis: 'target-location' } }),
    ).targets[0]
    expect(describePosition(withUncertainty)).toBe('Target location; ±3 m per the source')
  })
})

describe('splitByCoverage', () => {
  // 2 x 2 grid of 10 m cells, south-west corner at (0, 0); one cell has no data.
  const terrain = createTerrainPackage(
    parseTerrainManifest({
      contractVersion: 1,
      id: 'synthetic-test',
      title: 'Synthetic test grid',
      synthetic: true,
      source: null,
      crs: { name: 'Synthetic local metres', wkt: 'LOCAL_CS["synthetic"]' },
      raster: { width: 2, height: 2, geoTransform: [0, 10, 0, 20, 0, -10] },
      layers: {
        elevation: { url: 'e.f32', dataType: 'float32' },
        slope: { url: 's.f32', dataType: 'float32' },
      },
    }),
    {
      elevation: Float32Array.from([1, Number.NaN, 3, 4]),
      slope: new Float32Array(4),
    },
  )

  const target = (id: string, x: number, y: number) => ({
    ...syntheticTarget(),
    id,
    position: { x, y, uncertaintyMeters: null, basis: 'target-location' },
  })

  it('keeps targets on covered cells and sets the rest aside with a reason', () => {
    const collection = parseScienceTargets({
      ...validCollection(),
      targets: [target('in', 5, 15), target('gap', 15, 15), target('off', 25, 5)],
    })
    const { inside, outside } = splitByCoverage(collection, terrain)
    expect(inside.map((item) => [item.target.id, item.cell])).toEqual([['in', { row: 0, col: 0 }]])
    expect(outside.map((item) => [item.target.id, item.reason])).toEqual([
      ['gap', 'noData'],
      ['off', 'outsideTerrain'],
    ])
  })

  it('refuses targets prepared for a different terrain package', () => {
    const collection = parseScienceTargets({ ...validCollection(), terrainPackageId: 'other' })
    expect(() => splitByCoverage(collection, terrain)).toThrow(ScienceTargetContractError)
  })
})
