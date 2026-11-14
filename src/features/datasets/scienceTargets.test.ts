import { describe, expect, it } from 'vitest'
import {
  parseScienceTargets,
  ScienceTargetContractError,
  splitByCoverage,
} from './scienceTargets'
import { parseTerrainManifest } from './terrainContract'
import { createTerrainPackage } from './terrainPackage'

// Synthetic fixture: made-up targets and positions, not NASA data.
function validCollection(): Record<string, unknown> {
  return {
    contractVersion: 1,
    id: 'synthetic-targets',
    terrainPackageId: 'synthetic-test',
    synthetic: true,
    targets: [
      {
        id: 't1',
        name: 'Test outcrop',
        kind: 'observation-site',
        position: { x: 5, y: 15, uncertaintyMeters: 2 },
        mission: null,
        sol: null,
        description: 'Made-up observation site for tests.',
        source: null,
      },
    ],
  }
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

const realTarget = {
  id: 'r1',
  name: 'Real target',
  kind: 'drill-site',
  position: { x: 5, y: 15, uncertaintyMeters: null },
  mission: 'MSL Curiosity',
  sol: 780,
  description: 'Description from the cited source.',
  source: { url: 'https://example.org/source', attribution: 'NASA/JPL-Caltech' },
}

describe('parseScienceTargets', () => {
  it('accepts a valid synthetic collection', () => {
    const collection = parseScienceTargets(validCollection())
    expect(collection.targets).toHaveLength(1)
    expect(collection.targets[0].position).toEqual({ x: 5, y: 15, uncertaintyMeters: 2 })
  })

  it('accepts a real collection whose targets cite sources', () => {
    const input = { ...validCollection(), synthetic: false, targets: [realTarget] }
    expect(parseScienceTargets(input).targets[0].source?.attribution).toBe('NASA/JPL-Caltech')
  })

  it('requires a source on every real target and forbids sources on synthetic ones', () => {
    expect(
      issuesOf({ ...validCollection(), synthetic: false }),
    ).toContain('targets[0].source is required when synthetic is false')
    expect(
      issuesOf({ ...validCollection(), targets: [{ ...realTarget }] }),
    ).toContain('targets[0].source must be null when synthetic is true')
  })

  it('rejects unknown kinds, non-finite positions and negative uncertainty', () => {
    const input = validCollection()
    input.targets = [
      {
        ...(input.targets as object[])[0],
        kind: 'rock',
        position: { x: Number.NaN, y: 1, uncertaintyMeters: -1 },
      },
    ]
    expect(issuesOf(input)).toEqual(
      expect.arrayContaining([
        'targets[0].kind must be one of drill-site, observation-site, landing-site, traverse-point, landmark',
        'targets[0].position.x and .y must be finite numbers',
        'targets[0].position.uncertaintyMeters must be null or a non-negative number',
      ]),
    )
  })

  it('rejects duplicate target ids', () => {
    const input = validCollection()
    input.targets = [(input.targets as object[])[0], (input.targets as object[])[0]]
    expect(issuesOf(input)).toContain('target id "t1" is used more than once')
  })

  it('rejects a non-integer or negative sol', () => {
    const input = validCollection()
    input.targets = [{ ...(input.targets as object[])[0], sol: 12.5 }]
    expect(issuesOf(input)).toContain('targets[0].sol must be null or a non-negative integer')
  })

  it('requires the terrain package id and a supported version', () => {
    expect(issuesOf({ ...validCollection(), terrainPackageId: '' })).toContain(
      'terrainPackageId must be a non-empty string',
    )
    expect(issuesOf({ ...validCollection(), contractVersion: 2 })).toContain(
      'contractVersion must be 1',
    )
  })

  it('rejects input that is not an object', () => {
    expect(issuesOf('nope')).toEqual(['science target collection must be an object'])
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
    ...(validCollection().targets as object[])[0],
    id,
    position: { x, y, uncertaintyMeters: null },
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
