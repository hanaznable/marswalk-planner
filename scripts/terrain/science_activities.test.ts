import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseScienceActivities, reviewedScienceActivities, ScienceActivityContractError, type ScienceActivityCollection } from '../../src/features/datasets/scienceActivities'
import { parseTerrainManifest, decodeRaster } from '../../src/features/datasets/terrainContract'
import { createTerrainPackage } from '../../src/features/datasets/terrainPackage'
import { parseSciencePlan, type SciencePlanSnapshot } from '../../src/features/scienceSuggestions/model'
import { createMissionRecord, parseMissionRecord, checkCompatibility } from '../../src/features/missions/missionRecord'
import { buildMissionReport } from '../../src/features/mission/report/missionReport'
import { scienceMapLocations } from '../../src/features/scienceSuggestions/mapLocations'

const root = new URL('../../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root))
const folder = 'public/data/gale/pahrump-hills-v1/'
const bytes = read(folder + 'manifest.json')
const hash = createHash('sha256').update(bytes).digest('hex')
const manifest = parseTerrainManifest(JSON.parse(bytes.toString()))
const layer = (name: string) => decodeRaster(Uint8Array.from(read(folder + name)).buffer, manifest.raster)
const terrain = createTerrainPackage(manifest, { elevation: layer('elevation.f32'), slope: layer('slope.f32') })
const asset = 'public/data/science-activities/pahrump-hills-v1/v1/'
const input = (): ScienceActivityCollection => JSON.parse(read(asset + 'activities.json').toString())
const parse = (c = input()) => parseScienceActivities(c, terrain, hash)

describe('proposed rock-sampling increment', () => {
  const asset = 'public/data/science-activities/pahrump-hills-v1/v3/'
  const raw = (): ScienceActivityCollection => JSON.parse(read(asset + 'activities.json').toString())
  const collection = () => parseScienceActivities(raw(), terrain, hash)
  it('represents every reviewed activity once, grouping repeated locations across objectives', () => {
    const c = collection()
    const locations = scienceMapLocations(c)
    expect(locations).toHaveLength(10)
    expect(locations.flatMap(l => l.activities).map(a => a.id).sort()).toEqual(c.activities.map(a => a.id).sort())
    expect(locations.filter(l => l.kind === 'textures')).toHaveLength(3)
    expect(locations.filter(l => l.kind === 'mineralogy')).toHaveLength(4)
    expect(locations.filter(l => l.kind === 'water')).toHaveLength(1)
    expect(locations.filter(l => l.kind === 'orbital')).toHaveLength(2)
  })
  it('does not render draft activities as mission markers', () => {
    const c = collection()
    c.activities.forEach(a => { a.review = { status: 'draft', by: null, date: null } })
    expect(scienceMapLocations(c)).toHaveLength(0)
  })
  it('keeps earlier collections immutable and pins the review/output chain', () => {
    const provenance = JSON.parse(read(asset + 'provenance.json').toString())
    for (const [path, expected] of Object.entries(provenance.inputHashes)) expect(createHash('sha256').update(read(path)).digest('hex')).toBe(expected)
    expect(createHash('sha256').update(read(asset + 'activities.json')).digest('hex')).toBe(provenance.output_sha256['activities.json'])
    expect(createHash('sha256').update(read('scripts/terrain/reviews/rock-sampling-v3.json')).digest('hex')).toBe(provenance.reviewConfigSha256)
  })
  it('ties four sampling proposals to existing historical access positions and evidence', () => {
    const c = collection()
    const samples = c.activities.filter(a => a.experimentType === 'rock-sampling')
    expect(c.activities).toHaveLength(14)
    expect(samples).toHaveLength(4)
    expect(c.equipment).toHaveLength(4)
    for (const a of samples) {
      const imaging = c.activities.find(other => other.experimentType === 'photography' && other.access.evidenceId === a.access.evidenceId)!
      expect(a.access).toEqual(imaging.access)
      expect(a.evidenceIds).toEqual(imaging.evidenceIds)
      expect(a.requiredEquipmentIds).toEqual(['field-camera', 'rock-sampling-tools', 'sample-containers'])
      expect(a.procedure!.outcome).toContain('mineral identity and abundance remain undetermined')
      expect(a.durationMinutes).toBeNull()
    }
  })
  it('rejects an incomplete, empty or unsourced collection procedure', () => {
    const variants: ((c: ScienceActivityCollection) => void)[] = [
      c => { c.activities.find(a => a.experimentType === 'rock-sampling')!.procedure = undefined },
      c => { c.activities.find(a => a.experimentType === 'rock-sampling')!.procedure!.steps = [] },
      c => { c.activities.find(a => a.experimentType === 'rock-sampling')!.procedure!.sources = [] },
      c => { c.activities.find(a => a.experimentType === 'rock-sampling')!.procedure!.sources[0].url = 'javascript:alert(1)' },
      c => { c.activities.find(a => a.experimentType === 'rock-sampling')!.requiredEquipmentIds = [] },
    ]
    for (const mutate of variants) { const c = raw(); mutate(c); expect(() => parseScienceActivities(c, terrain, hash)).toThrow(/procedure|sampling/) }
  })
  it('preserves sampling procedures, equipment and shared-stop associations through save/import and reports', () => {
    const c = collection()
    const sampling = c.activities.find(a => a.experimentType === 'rock-sampling')!
    const imaging = c.activities.find(a => a.experimentType === 'photography' && a.access.evidenceId === sampling.access.evidenceId)!
    const sciencePlan: SciencePlanSnapshot = {
      collection: c, collectionSha256: createHash('sha256').update(read(asset + 'activities.json')).digest('hex'),
      objectiveId: 'mineral-diversity', equipmentIds: sampling.requiredEquipmentIds,
      selections: [{ activityId: imaging.id, waypointOrder: 1 }, { activityId: sampling.id, waypointOrder: 1, createdWaypoint: true }],
    }
    const waypoints = [{ id: 'sample-stop', label: 'Sample context', cell: { row: 95, col: 98 } }]
    const settings = { maxSlopeDegrees: 20, slopePenalty: 3, returnToStart: false, walkingSpeedKmh: 2, stopMinutes: 15 }
    const record = createMissionRecord({ name: 'Sampling plan', regionId: 'gale-pahrump-hills', terrain, scienceTargets: null, waypoints, origins: {}, settings, selectedTargetId: null, sciencePlan }, 'sampling-test', new Date('2026-11-15T00:00:00Z'))
    const imported = parseMissionRecord(JSON.parse(JSON.stringify(record)))
    const compatible = checkCompatibility(imported, terrain, null, hash)
    expect(compatible.ok).toBe(true)
    if (!compatible.ok) throw new Error('Sampling mission is incompatible')
    expect(compatible.sciencePlan!.collection.activities.find(a => a.id === sampling.id)!.procedure).toEqual(sampling.procedure)
    expect(compatible.sciencePlan!.selections.map(s => s.waypointOrder)).toEqual([1, 1])
    const report = buildMissionReport({ generatedAt: new Date(), terrain, dataset: null, waypoints, plan: null, eva: null, scienceTargets: null, assumptions: settings, sciencePlan: compatible.sciencePlan })
    expect(report.sciencePlan!.collection.activities.find(a => a.id === sampling.id)!.procedure!.sources.length).toBeGreaterThan(0)
  })
})

describe('expanded reviewed science objectives', () => {
  const folder = 'public/data/science-activities/pahrump-hills-v1/v2/'
  const collection = () => parseScienceActivities(JSON.parse(read(folder + 'activities.json').toString()), terrain, hash)
  it('validates delivered geometry, snapped access, coverage and objective references', () => {
    const c = collection()
    expect(c.objectives.map(o => o.id)).toEqual(['rock-textures', 'past-water', 'mineral-diversity'])
    expect(reviewedScienceActivities(c)).toHaveLength(10)
    expect(c.activities.filter(a => a.objectiveIds.includes('past-water'))).toHaveLength(2)
    expect(c.activities.filter(a => a.objectiveIds.includes('mineral-diversity'))).toHaveLength(4)
    expect(c.activities.filter(a => a.category === 'orbital-candidate')).toHaveLength(2)
  })
  it('preserves source hashes and reproduces orbital geometry from reviewed image pixels', () => {
    const c = collection()
    const review = JSON.parse(read('scripts/terrain/reviews/science-objectives-v2.json').toString())
    const provenance = JSON.parse(read(folder + 'provenance.json').toString())
    for (const [path, expected] of Object.entries(review.inputHashes)) expect(createHash('sha256').update(read(path)).digest('hex')).toBe(expected)
    expect(createHash('sha256').update(read(folder + 'activities.json')).digest('hex')).toBe(provenance.output_sha256['activities.json'])
    expect(createHash('sha256').update(read('scripts/terrain/reviews/science-objectives-v2.json')).digest('hex')).toBe(provenance.reviewConfigSha256)
    const gt = manifest.basemap!.geoTransform!
    for (const roi of review.orbitalRegions) {
      const a = c.activities.find(a => a.id === roi.id)!
      const e = c.evidence.find(e => e.id === a.access.evidenceId)!
      expect(e.footprint.type).toBe('area')
      if (e.footprint.type !== 'area') throw new Error('Missing orbital area')
      expect(e.footprint.ring).toEqual(roi.ringPixels.map(([x, y]: number[]) => [gt[0] + x * gt[1], gt[3] + y * gt[5]]))
      expect(a.access.point).toEqual({ x: gt[0] + roi.accessPixel[0] * gt[1], y: gt[3] + roi.accessPixel[1] * gt[5] })
      expect(e.footprint.nativeResolutionMeters).toBe(1.0117571650087)
    }
  })
  it('keeps APXS measurement sols distinct from sample collection and mineral-analysis dates', () => {
    const c = collection()
    expect(c.evidence.find(e => e.id === 'garden-city-position')!.sol).toBe(935)
    expect(c.evidence.find(e => e.id === 'buckskin-mineralogy')!.sol).toBeNull()
    expect(c.evidence.find(e => e.id === 'buckskin-mineralogy')!.statement).toContain('collected on sol 1060')
    const targets = JSON.parse(read('public/data/science/pahrump-hills-v1/targets.json').toString()).targets
    for (const target of targets) {
      const e = c.evidence.find(e => e.id === 'mineralogy-' + target.id)!
      expect(e.footprint).toEqual({ type: 'point', position: target.position })
      expect(e.sol).toBeNull()
    }
  })
  it('requires close-up capability for texture and vein imaging, not for contextual surveys', () => {
    const c = collection()
    const closeUp = c.equipment.find(e => e.id === 'close-up-optics')!
    expect(closeUp.basis).toBe('scenario-assumption')
    expect(closeUp.sources[0].url).toBe('https://science.nasa.gov/mission/msl-curiosity/science-instruments/')
    expect(c.activities.filter(a => a.requiredEquipmentIds.includes('close-up-optics')).map(a => a.id)).toEqual(['shoemaker-imaging', 'book-cliffs-imaging', 'chinle-comparison', 'garden-city-vein-imaging'])
    for (const a of c.activities.filter(a => a.category === 'orbital-candidate' || a.id.startsWith('sample-context-'))) expect(a.requiredEquipmentIds).toEqual(['field-camera'])
  })
})

/** Structural polygon fixture only, not a new scientific observation. */
function areaFixture() {
  const c = input(), e = c.evidence[0], a = c.activities[0]
  const p = a.access.point
  e.kind = 'orbital-image-observation'
  e.footprint = {
    type: 'area', basis: 'reviewed-orbital-footprint', uncertaintyMeters: null, nativeResolutionMeters: 1,
    ring: [[p.x - 10, p.y - 10], [p.x + 10, p.y - 10], [p.x + 10, p.y + 10], [p.x - 10, p.y + 10], [p.x - 10, p.y - 10]],
    geometrySource: { productId: 'synthetic-test-area', method: 'Test fixture, not source science', sources: e.sources },
  }
  a.category = 'orbital-candidate'
  a.access.selectionBasis = 'reviewed-area-access'
  return c
}

describe('science activity collection', () => {
  const snapshot = (): SciencePlanSnapshot => ({ collection: input(), collectionSha256: 'c'.repeat(64), objectiveId: 'rock-textures', equipmentIds: ['field-camera'], selections: [{ activityId: 'shoemaker-imaging', waypointOrder: 1 }, { activityId: 'book-cliffs-imaging', waypointOrder: 1 }] })
  it('supports multiple selected activities at one stop and validates their references', () => {
    expect(parseSciencePlan(snapshot(), terrain, hash, 1).selections).toHaveLength(2)
    const s = snapshot(); s.selections[1].waypointOrder = 2
    expect(() => parseSciencePlan(s, terrain, hash, 1)).toThrow(/association/)
    s.selections[1].waypointOrder = 1; s.selections[1].activityId = s.selections[0].activityId
    expect(() => parseSciencePlan(s, terrain, hash, 1)).toThrow(/association/)
    const wrongEquipment = snapshot(); wrongEquipment.equipmentIds = ['unknown']
    expect(() => parseSciencePlan(wrongEquipment, terrain, hash, 1)).toThrow(/equipment/)
  })
  it('round trips activity snapshots in mission v2 and requires current terrain verification', () => {
    const record = createMissionRecord({
      name: 'Science plan', regionId: 'gale-pahrump-hills', terrain, scienceTargets: null,
      waypoints: [{ id: 'wp-8', label: 'Stop', cell: { row: 94, col: 98 } }], origins: {},
      settings: { maxSlopeDegrees: 20, slopePenalty: 3, returnToStart: false, walkingSpeedKmh: 2, stopMinutes: 15 }, selectedTargetId: null,
      sciencePlan: snapshot(),
    }, 'test', new Date('2026-11-15T00:00:00Z'))
    expect(record.version).toBe(2)
    const parsed = parseMissionRecord(JSON.parse(JSON.stringify(record)))
    const compatible = checkCompatibility(parsed, terrain, null, hash)
    expect(compatible.ok).toBe(true)
    if (compatible.ok) expect(compatible.sciencePlan?.selections).toHaveLength(2)
    expect(checkCompatibility(parsed, terrain, null).ok).toBe(false)
    expect(checkCompatibility(parsed, terrain, null, '0'.repeat(64)).ok).toBe(false)
    const broken = structuredClone(parsed); broken.sciencePlan!.selections[0].activityId = 'missing'
    expect(checkCompatibility(broken, terrain, null, hash).ok).toBe(false)
  })
  it('includes an isolated activity/evidence snapshot in JSON reports', () => {
    const sciencePlan = snapshot()
    const report = buildMissionReport({ generatedAt: new Date('2026-11-15T00:00:00Z'), terrain, dataset: null,
      waypoints: [{ id: 'wp-1', label: 'Stop', cell: { row: 94, col: 98 } }], plan: null, eva: null, scienceTargets: null,
      assumptions: { maxSlopeDegrees: 20, slopePenalty: 3, returnToStart: false, walkingSpeedKmh: 2, stopMinutes: 15 }, sciencePlan })
    expect(report.sciencePlan?.collection.evidence).toHaveLength(6)
    sciencePlan.selections.length = 0
    expect(report.sciencePlan?.selections).toHaveLength(2)
  })
  it('loads the three source-backed follow-ups without changing their source positions', () => {
    const c = parse()
    expect(reviewedScienceActivities(c)).toHaveLength(3)
    expect(c.activities.map(a => a.id)).toEqual(['shoemaker-imaging', 'book-cliffs-imaging', 'chinle-comparison'])
    for (const a of c.activities) {
      const e = c.evidence.find(e => e.id === a.access.evidenceId)!
      expect(e.footprint.type).toBe('point')
      if (e.footprint.type === 'point') expect(a.access.point).toEqual({ x: e.footprint.position.x, y: e.footprint.position.y })
      expect(a.durationMinutes).toBeNull()
    }
  })
  it('checks the delivered output hash and external APXS source-record identities', () => {
    const provenance = JSON.parse(read(asset + 'provenance.json').toString())
    expect(createHash('sha256').update(read(asset + 'activities.json')).digest('hex')).toBe(provenance.output_sha256['activities.json'])
    const context = JSON.parse(read('public/data/layer-lab/pahrump-hills-v1/context.json').toString())
    for (const e of input().evidence.filter(e => e.kind === 'apxs-measurement')) {
      const row = context.observations.find((r: { name: string; sol: number }) => r.name === e.targetName && r.sol === e.sol)
      expect(e.links.apxsRecordId).toBe(`apxs:${context.apxsSource.table_sha256}:row-${row.sourceLine}`)
    }
  })
  it('rejects the wrong terrain hash, package and synthetic flag', () => {
    expect(() => parseScienceActivities(input(), terrain, '0'.repeat(64))).toThrow(/hash/)
    const c = input(); c.terrainPackageId = 'another-package'
    expect(() => parse(c)).toThrow(/package/)
    c.terrainPackageId = manifest.id; c.synthetic = true
    expect(() => parse(c)).toThrow(/synthetic/)
  })
  it('collects duplicate IDs, unresolved references and unsafe source URLs', () => {
    const c = input()
    c.activities[1].id = c.activities[0].id
    c.activities[0].requiredEquipmentIds = ['missing-tool']
    c.evidence[0].sources[0].url = 'javascript:alert(1)'
    try { parse(c); expect.fail('must reject') } catch (e) {
      expect(e).toBeInstanceOf(ScienceActivityContractError)
      expect((e as ScienceActivityContractError).issues.length).toBeGreaterThanOrEqual(3)
    }
  })
  it('hides valid draft activities and rejects fabricated review dates', () => {
    const c = input(); c.activities[0].review = { status: 'draft', by: null, date: null }
    expect(reviewedScienceActivities(parse(c))).toHaveLength(2)
    c.activities[1].review.date = '2026-02-30'
    expect(() => parse(c)).toThrow(/review/)
  })
  it('rejects no-data access and out-of-coverage evidence', () => {
    const c = input(), p = c.activities[0].access.point
    const col = Math.floor((p.x - manifest.raster.geoTransform[0]) / 5)
    const row = Math.floor((p.y - manifest.raster.geoTransform[3]) / -5)
    const broken = { ...terrain, slope: terrain.slope.slice() }
    broken.slope[row * manifest.raster.width + col] = NaN
    expect(() => parseScienceActivities(c, broken, hash)).toThrow(/coverage|footprint/)
    c.activities[0].access.point.x = 1e9
    expect(() => parse(c)).toThrow(/coverage/)
  })
  it('does not accept flagged evidence, guessed durations or unsupported categories', () => {
    const c = input(); c.evidence[0].qualityFlags = ['low-quality spectrum']
    expect(() => parse(c)).toThrow(/flagged/)
    const d = input(); Object.assign(d.activities[0], { durationMinutes: 30 })
    expect(() => parse(d)).toThrow(/durations/)
    const a = input(); a.activities[0].category = 'orbital-candidate'
    expect(() => parse(a)).toThrow(/supporting evidence/)
  })
  it('validates a simple area with a reviewed access point', () => {
    expect(parse(areaFixture()).activities[0].category).toBe('orbital-candidate')
  })
  it('rejects excessively detailed imported geometry before intersection checks', () => {
    const c = areaFixture(), f = c.evidence[0].footprint, p = c.activities[0].access.point
    if (f.type !== 'area') throw new Error('fixture')
    f.ring = Array.from({ length: 600 }, (_, i) => [p.x + 10 * Math.cos(i * 2 * Math.PI / 600), p.y + 10 * Math.sin(i * 2 * Math.PI / 600)])
    f.ring.push(f.ring[0])
    expect(() => parse(c)).toThrow(/area/)
  })
  it('rejects self-intersecting, unclipped and zero-area polygons', () => {
    for (const mode of ['crossed', 'outside', 'flat']) {
      const c = areaFixture(), f = c.evidence[0].footprint
      if (f.type !== 'area') throw new Error('fixture')
      if (mode === 'crossed') [f.ring[1], f.ring[2]] = [f.ring[2], f.ring[1]]
      if (mode === 'outside') f.ring[1][0] = 1e9
      if (mode === 'flat') f.ring = [[0, 0], [1, 0], [2, 0], [0, 0]]
      expect(() => parse(c)).toThrow(/area/)
    }
  })
  it('refuses access outside the area and snapping outside a small area', () => {
    const c = areaFixture(); c.activities[0].access.point.x += 20
    expect(() => parse(c)).toThrow(/inside evidence/)
    const d = areaFixture(), p = d.activities[0].access.point, f = d.evidence[0].footprint
    if (f.type !== 'area') throw new Error('fixture')
    f.ring = [[p.x - .01, p.y - .01], [p.x + .01, p.y - .01], [p.x + .01, p.y + .01], [p.x - .01, p.y + .01], [p.x - .01, p.y - .01]]
    expect(() => parse(d)).toThrow(/snapped cell|area has no covered/)
  })
  it('returns an isolated snapshot rather than retaining the caller object', () => {
    const c = input(), parsed = parse(c)
    c.activities[0].title = 'changed'
    expect(parsed.activities[0].title).not.toBe('changed')
  })
})
