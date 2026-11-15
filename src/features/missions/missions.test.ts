import { describe, expect, it } from 'vitest'
import { parseTerrainManifest } from '../datasets/terrainContract'
import { createTerrainPackage } from '../datasets/terrainPackage'
import type { WaypointOrigin } from '../datasets/waypointOrigin'
import type { Waypoint } from '../routing'
import {
  importedCopy,
  LIBRARY_KEY,
  loadLibrary,
  removeMission,
  storeLibrary,
  upsertMission,
  type MissionStorage,
} from './missionStore'
import {
  checkCompatibility,
  createMissionRecord,
  MissionFormatError,
  missionFileName,
  parseMissionRecord,
  type MissionRecord,
  type MissionSnapshot,
} from './missionRecord'

// Synthetic fixture, not NASA data: 3 x 2 cells of 10 m with one no-data cell.
function terrain(overrides: { id?: string; productId?: string; originX?: number } = {}) {
  return createTerrainPackage(
    parseTerrainManifest({
      contractVersion: 1,
      id: overrides.id ?? 'test-grid',
      title: 'Test grid',
      synthetic: false,
      source: { productId: overrides.productId ?? 'P1', url: 'https://example.org/p1', attribution: 'Test' },
      crs: { name: 'Test', wkt: 'LOCAL_CS["test"]' },
      raster: { width: 3, height: 2, geoTransform: [overrides.originX ?? 1000, 10, 0, 2020, 0, -10] },
      layers: { elevation: { url: 'e.f32', dataType: 'float32' }, slope: { url: 's.f32', dataType: 'float32' } },
    }),
    { elevation: Float32Array.from([1, 2, 3, 4, NaN, 6]), slope: new Float32Array(6) },
  )
}

const origin: WaypointOrigin = {
  kind: 'apxs-observation',
  recordId: 'apxs-row-12',
  name: 'Made-up rock',
  mission: 'MSL Curiosity',
  measurementSol: 780,
  description: 'Made-up record for tests.',
  position: { x: 1025, y: 2015, basis: 'rover-position-proxy', uncertaintyMeters: null },
  sources: [{ url: 'https://example.org/apxs', attribution: 'Test', provides: 'measurement' }],
  sourceSha256: 'a'.repeat(64),
  reviewFlags: [],
}

const waypoints: Waypoint[] = [
  { id: 'wp-1', label: 'Point 1', cell: { row: 0, col: 0 } },
  { id: 'wp-4', label: 'APXS: Made-up rock (rover proxy)', cell: { row: 0, col: 2 } },
]

const settings = { maxSlopeDegrees: 20, slopePenalty: 3, returnToStart: true, walkingSpeedKmh: 2, stopMinutes: 15 }

function snapshot(overrides: Partial<MissionSnapshot> = {}): MissionSnapshot {
  return {
    name: '  Ridge   traverse ',
    regionId: 'test-region',
    terrain: terrain(),
    scienceTargets: { id: 'targets-v1', terrainManifestSha256: 'b'.repeat(64) },
    waypoints,
    origins: { 'wp-4': origin },
    settings,
    selectedTargetId: 'target-a',
    ...overrides,
  }
}

const savedAt = new Date('2026-11-15T18:05:30Z')
const record = (overrides: Partial<MissionSnapshot> = {}) => createMissionRecord(snapshot(overrides), 'mission-1', savedAt)

describe('mission record', () => {
  it('round-trips oxygen capacity and model in v3 while retaining legacy inputs', () => {
    const saved = record({ settings: { ...settings, oxygenCapacityKg: 0.54 } })
    expect(saved.version).toBe(3)
    const imported = parseMissionRecord(JSON.parse(JSON.stringify(saved)))
    expect(imported.settings.oxygenCapacityKg).toBe(0.54)
    expect(imported.settings.oxygenModelId).toBe('nasa-bvad-mars-closed-loop-v1')
    expect(parseMissionRecord(JSON.parse(JSON.stringify(record()))).version).toBe(1)
  })
  it('refuses oxygen missions with missing, invalid or unsupported model inputs', () => {
    const saved = record({ settings: { ...settings, oxygenCapacityKg: 0.54 } })
    for (const oxygenCapacityKg of [undefined, 0, -1, 2, NaN, Infinity]) {
      expect(() => parseMissionRecord({ ...saved, settings: { ...saved.settings, oxygenCapacityKg } })).toThrow(/oxygenCapacityKg/)
    }
    expect(() => parseMissionRecord({ ...saved, settings: { ...saved.settings, oxygenModelId: 'unknown' } })).toThrow(/oxygenModelId/)
  })
  it('stores the planner inputs and the exact terrain grid', () => {
    const saved = record()
    expect(saved).toMatchObject({
      format: 'marswalk-mission',
      version: 1,
      id: 'mission-1',
      name: 'Ridge traverse',
      savedAt: '2026-11-15T18:05:30.000Z',
      regionId: 'test-region',
      terrain: { id: 'test-grid', synthetic: false, productId: 'P1', grid: { width: 3, height: 2, geoTransform: [1000, 10, 0, 2020, 0, -10] } },
      scienceTargets: { collectionId: 'targets-v1', terrainManifestSha256: 'b'.repeat(64) },
      settings,
      selectedTargetId: 'target-a',
    })
    expect(saved.waypoints).toEqual([
      { label: 'Point 1', cell: { row: 0, col: 0 }, origin: null },
      { label: 'APXS: Made-up rock (rover proxy)', cell: { row: 0, col: 2 }, origin },
    ])
    expect(saved).not.toHaveProperty('routes')
  })

  it('refuses an empty name', () => {
    expect(() => record({ name: '   ' })).toThrow('needs a name')
  })

  it('survives a JSON round trip unchanged', () => {
    const saved = record()
    expect(parseMissionRecord(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
  })

  it('names the export after the mission and the UTC time', () => {
    expect(missionFileName(record())).toBe('polaris-mission-ridge-traverse-20261115-1805Z.json')
    expect(missionFileName(record({ name: 'Ödül !!' }))).toBe('polaris-mission-odul-20261115-1805Z.json')
  })
})

describe('parseMissionRecord', () => {
  const json = () => JSON.parse(JSON.stringify(record())) as Record<string, unknown>

  it('rejects other files and future versions with a clear reason', () => {
    expect(() => parseMissionRecord({ format: 'marswalk-mission-report', version: 1 })).toThrow('not a POLARIS Module mission file')
    expect(() => parseMissionRecord({ ...json(), version: 4 })).toThrow('newer version of the planner (format version 4)')
  })

  it('lists every problem in a damaged file', () => {
    const broken = { ...json(), settings: { ...settings, maxSlopeDegrees: 90, stopMinutes: -1 }, waypoints: [{ label: 'x', cell: { row: -1, col: 0 }, origin: null }] }
    try {
      parseMissionRecord(broken)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(MissionFormatError)
      expect((error as MissionFormatError).issues).toEqual([
        'waypoint 1 is invalid',
        'settings.maxSlopeDegrees must be between 5 and 45',
        'settings.stopMinutes must be between 0 and 120',
      ])
    }
  })

  it('rejects provenance that loses its proxy caveat', () => {
    const file = json()
    const list = file.waypoints as { origin: Record<string, unknown> | null }[]
    list[1].origin = { ...list[1].origin, position: { x: 1, y: 2, basis: 'target-location', uncertaintyMeters: null } }
    expect(() => parseMissionRecord(file)).toThrow('waypoint 2 is invalid')
  })

  it('normalises a hand-edited name', () => {
    expect(parseMissionRecord({ ...json(), name: '  Ridge \n traverse ' }).name).toBe('Ridge traverse')
  })
})

describe('checkCompatibility', () => {
  it('restores waypoints in order with fresh ids and their provenance', () => {
    const result = checkCompatibility(record(), terrain(), { id: 'targets-v1' })
    expect(result).toEqual({
      ok: true,
      waypoints: [
        { id: 'wp-1', label: 'Point 1', cell: { row: 0, col: 0 } },
        { id: 'wp-2', label: 'APXS: Made-up rock (rover proxy)', cell: { row: 0, col: 2 } },
      ],
      origins: { 'wp-2': origin },
      warnings: [],
    })
  })

  it('refuses another terrain package, source product or grid', () => {
    const other = checkCompatibility(record(), terrain({ id: 'other-grid' }), null)
    expect(other).toMatchObject({ ok: false })
    expect(!other.ok && other.reasons[0]).toMatch(/planned on "Test grid" \(test-grid\)/)
    const product = checkCompatibility(record(), terrain({ productId: 'P2' }), null)
    expect(!product.ok && product.reasons[0]).toMatch(/source changed \(saved: P1; now: P2\)/)
    const shifted = checkCompatibility(record(), terrain({ originX: 1005 }), null)
    expect(!shifted.ok && shifted.reasons[0]).toMatch(/grid changed/)
  })

  it('refuses waypoints that now fall on no-data cells', () => {
    const onGap = record({ waypoints: [...waypoints, { id: 'wp-5', label: 'Gap point', cell: { row: 1, col: 1 } }] })
    const result = checkCompatibility(onGap, terrain(), null)
    expect(!result.ok && result.reasons).toEqual(['Waypoints without terrain data: Gap point.'])
  })

  it('opens with a warning when the science target collection differs', () => {
    const result = checkCompatibility(record(), terrain(), { id: 'targets-v2' })
    expect(result.ok && result.warnings[0]).toMatch(/"targets-v1"; "targets-v2" is loaded now/)
    const missing = checkCompatibility(record(), terrain(), null)
    expect(missing.ok && missing.warnings[0]).toMatch(/not loaded now/)
  })
})

function memoryStorage(initial: Record<string, string> = {}, failWrites = false): MissionStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      if (failWrites) throw new DOMException('full', 'QuotaExceededError')
      data[key] = value
    },
  }
}

describe('mission library', () => {
  const a = record()
  const b: MissionRecord = { ...record({ name: 'Second' }), id: 'mission-2' }

  it('stores and reloads missions', () => {
    const storage = memoryStorage()
    expect(storeLibrary(storage, [a, b])).toBeNull()
    expect(loadLibrary(storage)).toEqual({ missions: [a, b], skipped: 0, error: null })
  })

  it('skips damaged entries and duplicates instead of failing', () => {
    const storage = memoryStorage({ [LIBRARY_KEY]: JSON.stringify([a, { format: 'marswalk-mission', version: 1 }, a, b]) })
    const loaded = loadLibrary(storage)
    expect(loaded.missions.map((mission) => mission.id)).toEqual(['mission-1', 'mission-2'])
    expect(loaded.skipped).toBe(2)
    expect(loadLibrary(memoryStorage({ [LIBRARY_KEY]: '{not json' }))).toEqual({ missions: [], skipped: 1, error: null })
  })

  it('reports missing or full storage', () => {
    expect(loadLibrary(null).error).toMatch(/not available/)
    expect(storeLibrary(memoryStorage({}, true), [a])).toMatch(/storage is full/)
    const blocked: MissionStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => {} }
    expect(loadLibrary(blocked).error).toMatch(/blocked/)
  })

  it('keeps the latest save first and removes by id', () => {
    const updated = { ...a, name: 'Renamed' }
    expect(upsertMission([a, b], updated).map((mission) => mission.name)).toEqual(['Renamed', 'Second'])
    expect(removeMission([a, b], 'mission-1')).toEqual([b])
  })

  it('gives an imported copy a new id when it would overwrite an entry', () => {
    expect(importedCopy([a], a, () => 'mission-9').id).toBe('mission-9')
    expect(importedCopy([b], a, () => 'mission-9').id).toBe('mission-1')
  })
})
