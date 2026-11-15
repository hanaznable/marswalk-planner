/** Science suggestion inputs. Independent of renderers, routing costs and UI. */
import { cellCenterToMap, mapToCell, rasterBounds, type MapPoint } from './terrainContract'
import { isCellCovered, type TerrainPackage } from './terrainPackage'
import type { TargetSource } from './scienceTargets'

type Position = MapPoint & { basis: 'rover-position-proxy' | 'target-location'; uncertaintyMeters: number | null }
export type ActivityFootprint =
  | { type: 'point'; position: Position }
  | { type: 'area'; ring: [number, number][]; basis: 'reviewed-orbital-footprint' | 'reviewed-map-footprint'; uncertaintyMeters: number | null; nativeResolutionMeters: number; geometrySource: { productId: string; method: string; sources: TargetSource[] } }
export interface ActivityEvidence {
  id: string
  kind: 'apxs-measurement' | 'chemcam-observation' | 'chemin-mineralogy' | 'image-observation' | 'drill-sample' | 'orbital-image-observation' | 'orbital-indicator' | 'geologic-map-unit'
  mission: string
  instrument: string
  targetName: string
  sol: number | null
  statement: string
  footprint: ActivityFootprint
  links: { targetId: string | null; apxsRecordId: string | null }
  productIds: string[]
  qualityFlags: string[]
  sources: TargetSource[]
}
export interface ScienceActivity {
  id: string
  title: string
  category: 'historical-follow-up' | 'orbital-candidate'
  experiment: string
  /** Optional additive fields; earlier collections remain readable. */
  experimentType?: 'photography' | 'rock-sampling'
  procedure?: { steps: string[]; outcome: string; sources: TargetSource[] }
  objectiveIds: string[]
  evidenceIds: string[]
  requiredEquipmentIds: string[]
  access: { evidenceId: string; point: MapPoint; selectionBasis: 'associated-rover-position' | 'reviewed-area-access'; justification: string }
  rationale: string
  limitations: string[]
  durationMinutes: null
  durationSource: null
  review: { status: 'draft' | 'reviewed'; by: string | null; date: string | null }
}
export interface ScienceActivityCollection {
  contractVersion: 1
  id: string
  terrainPackageId: string
  terrainManifestSha256: string
  synthetic: boolean
  objectives: { id: string; title: string; description: string; sources: TargetSource[] }[]
  equipment: { id: string; name: string; description: string; basis: 'scenario-assumption' | 'source'; sources: TargetSource[] }[]
  evidence: ActivityEvidence[]
  activities: ScienceActivity[]
}
export class ScienceActivityContractError extends Error {
  readonly issues: string[]
  constructor(issues: string[]) { super(`Invalid science activities: ${issues.join('; ')}`); this.issues = issues }
}

type Obj = Record<string, unknown>
const object = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const point = (v: unknown): v is MapPoint => object(v) && finite(v.x) && finite(v.y)
const strings = (v: unknown, nonempty = false): v is string[] => Array.isArray(v) && (!nonempty || v.length > 0) && v.every(text) && new Set(v).size === v.length
const uncertainty = (v: unknown) => v === null || (finite(v) && v >= 0)
const sourceList = (v: unknown, required: boolean) => Array.isArray(v) && (!required || v.length > 0) && v.every(s => {
  if (!object(s) || !text(s.url) || !text(s.attribution) || !text(s.provides)) return false
  try { return new URL(s.url).protocol === 'https:' } catch { return false }
})
const cross = (a: MapPoint, b: MapPoint, c: MapPoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
const onSegment = (p: MapPoint, a: MapPoint, b: MapPoint) => Math.abs(cross(a, b, p)) < 1e-8 && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y)
const vertex = (p: [number, number]): MapPoint => ({ x: p[0], y: p[1] })
function intersects(a: MapPoint, b: MapPoint, c: MapPoint, d: MapPoint) {
  return onSegment(a, c, d) || onSegment(b, c, d) || onSegment(c, a, b) || onSegment(d, a, b)
    || (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0)
}
// Intersection validation is quadratic; bound imported geometry before doing it.
const MAX_RING_COORDINATES = 512
function simpleRing(v: unknown): v is [number, number][] {
  if (!Array.isArray(v) || v.length < 4 || v.length > MAX_RING_COORDINATES || !v.every(p => Array.isArray(p) && p.length === 2 && p.every(finite))) return false
  const r = v as [number, number][]
  const last = r.length - 1
  if (r[0][0] !== r[last][0] || r[0][1] !== r[last][1] || new Set(r.slice(0, -1).map(p => p.join(','))).size !== last) return false
  let area = 0
  for (let i = 0; i < last; i++) {
    area += (r[i][0] - r[0][0]) * (r[i + 1][1] - r[0][1]) - (r[i + 1][0] - r[0][0]) * (r[i][1] - r[0][1])
    for (let j = i + 2; j < last; j++) {
      if (i === 0 && j === last - 1) continue
      if (intersects(vertex(r[i]), vertex(r[i + 1]), vertex(r[j]), vertex(r[j + 1]))) return false
    }
  }
  return Math.abs(area) > 1e-8
}
export function insideActivityArea(p: MapPoint, ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0; i < ring.length - 1; i++) {
    const a = vertex(ring[i]), b = vertex(ring[i + 1])
    if (onSegment(p, a, b)) return true
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Validate untrusted JSON against the active terrain, including its exact hash. */
export function parseScienceActivities(input: unknown, terrain: TerrainPackage, manifestSha256: string): ScienceActivityCollection {
  const issues: string[] = []
  const check = (ok: unknown, where: string) => { if (!ok) issues.push(where) }
  if (!object(input)) throw new ScienceActivityContractError(['collection must be an object'])
  check(input.contractVersion === 1 && text(input.id), 'collection version/id')
  check(input.terrainPackageId === terrain.manifest.id, 'terrain package mismatch')
  check(/^[a-f0-9]{64}$/.test(manifestSha256) && input.terrainManifestSha256 === manifestSha256, 'terrain manifest hash mismatch')
  check(input.synthetic === terrain.manifest.synthetic, 'synthetic flag mismatch')
  const real = input.synthetic !== true
  const entries = (value: unknown, name: string): Obj[] => {
    if (!Array.isArray(value) || !value.every(object)) { issues.push(`${name} must be an object array`); return [] }
    const ids = value.map(v => v.id)
    check(ids.every(text) && new Set(ids).size === ids.length, `${name} IDs must be unique nonempty strings`)
    return value
  }
  const objectives = entries(input.objectives, 'objectives'), equipment = entries(input.equipment, 'equipment')
  const evidence = entries(input.evidence, 'evidence'), activities = entries(input.activities, 'activities')
  const bounds = rasterBounds(terrain.manifest.raster)
  const covered = (p: MapPoint) => {
    const cell = mapToCell(terrain.manifest.raster, p)
    if (cell === null || !isCellCovered(terrain, cell)) return false
    const slope = terrain.slope[cell.row * terrain.manifest.raster.width + cell.col]
    return finite(slope) && slope >= 0 && slope <= 90
  }
  for (const o of objectives) check(text(o.title) && text(o.description) && sourceList(o.sources, real), `objective ${o.id}: content/sources`)
  for (const e of equipment) check(text(e.name) && text(e.description) && ['source', 'scenario-assumption'].includes(String(e.basis)) && sourceList(e.sources, e.basis === 'source'), `equipment ${e.id}: content/basis/sources`)
  const orbitalKinds = ['orbital-image-observation', 'orbital-indicator', 'geologic-map-unit']
  const kinds = ['apxs-measurement', 'chemcam-observation', 'chemin-mineralogy', 'image-observation', 'drill-sample', ...orbitalKinds]
  for (const e of evidence) {
    check(kinds.includes(String(e.kind)) && ['mission', 'instrument', 'targetName', 'statement'].every(k => text(e[k])), `evidence ${e.id}: content/kind`)
    check(e.sol === null || (finite(e.sol) && Number.isInteger(e.sol) && e.sol >= 0), `evidence ${e.id}: sol`)
    check(sourceList(e.sources, real) && strings(e.productIds, real) && strings(e.qualityFlags), `evidence ${e.id}: sources/products/flags`)
    check(object(e.links) && ['targetId', 'apxsRecordId'].every(k => e.links && object(e.links) && (e.links[k] === null || text(e.links[k]))), `evidence ${e.id}: links`)
    const f = e.footprint
    if (!object(f)) { issues.push(`evidence ${e.id}: footprint`); continue }
    if (f.type === 'point') {
      const p = f.position
      check(point(p) && covered(p) && object(p) && ['rover-position-proxy', 'target-location'].includes(String(p.basis)) && uncertainty(p.uncertaintyMeters), `evidence ${e.id}: point footprint`)
    } else if (f.type === 'area') {
      const valid = simpleRing(f.ring)
      check(valid && ['reviewed-orbital-footprint', 'reviewed-map-footprint'].includes(String(f.basis)) && uncertainty(f.uncertaintyMeters) && finite(f.nativeResolutionMeters) && f.nativeResolutionMeters > 0, `evidence ${e.id}: area geometry/metadata`)
      if (simpleRing(f.ring)) {
        const ring = f.ring
        const clipped = ring.every(([x, y]) => x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY)
        check(clipped, `evidence ${e.id}: area must be clipped to terrain`)
        if (clipped) {
          const minX = Math.min(...ring.map(p => p[0])), maxX = Math.max(...ring.map(p => p[0]))
          const minY = Math.min(...ring.map(p => p[1])), maxY = Math.max(...ring.map(p => p[1]))
          let hasCoverage = false
          for (let row = 0; row < terrain.manifest.raster.height && !hasCoverage; row++) {
            for (let col = 0; col < terrain.manifest.raster.width && !hasCoverage; col++) {
              const p = cellCenterToMap(terrain.manifest.raster, { row, col })
              if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY && insideActivityArea(p, ring) && covered(p)) hasCoverage = true
            }
          }
          check(hasCoverage, `evidence ${e.id}: area has no covered routing cell`)
        }
      }
      check(object(f.geometrySource) && text(f.geometrySource.productId) && text(f.geometrySource.method) && sourceList(f.geometrySource.sources, real), `evidence ${e.id}: geometry source`)
    } else issues.push(`evidence ${e.id}: unknown footprint type`)
  }
  const refs = (v: unknown, pool: Obj[], required: boolean) => strings(v, required) && v.every(id => pool.some(p => p.id === id))
  for (const a of activities) {
    const prefix = `activity ${a.id}`
    check(['title', 'experiment', 'rationale'].every(k => text(a[k])) && strings(a.limitations, true), `${prefix}: content`)
    check(a.experimentType === undefined || ['photography', 'rock-sampling'].includes(String(a.experimentType)), `${prefix}: experiment type`)
    if (a.procedure !== undefined) {
      const p = a.procedure
      check(object(p) && strings(p.steps, true) && text(p.outcome) && sourceList(p.sources, real), `${prefix}: procedure content/sources`)
    }
    if (a.experimentType === 'rock-sampling') check(object(a.procedure) && strings(a.requiredEquipmentIds, true), `${prefix}: sampling requires procedure and equipment`)
    check(refs(a.objectiveIds, objectives, true) && refs(a.evidenceIds, evidence, true) && refs(a.requiredEquipmentIds, equipment, false), `${prefix}: unresolved or duplicate references`)
    check(['historical-follow-up', 'orbital-candidate'].includes(String(a.category)), `${prefix}: category`)
    check(a.durationMinutes === null && a.durationSource === null, `${prefix}: initial durations must be null`)
    const r = a.review
    check(object(r) && ['draft', 'reviewed'].includes(String(r.status)) && (r.status === 'draft' ? r.by === null && r.date === null : text(r.by) && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(Date.parse(r.date)) && new Date(r.date).toISOString().slice(0, 10) === r.date), `${prefix}: review`)
    const selected = evidence.filter(e => Array.isArray(a.evidenceIds) && a.evidenceIds.includes(e.id))
    check(selected.some(e => a.category === 'orbital-candidate' ? orbitalKinds.includes(String(e.kind)) : !orbitalKinds.includes(String(e.kind))), `${prefix}: category requires supporting evidence`)
    if (object(r) && r.status === 'reviewed') check(selected.every(e => Array.isArray(e.qualityFlags) && e.qualityFlags.length === 0), `${prefix}: reviewed activities cannot use flagged evidence in first delivery`)
    const access = a.access
    if (!object(access) || !point(access.point)) { issues.push(`${prefix}: access point`); continue }
    check(text(access.justification) && covered(access.point), `${prefix}: access content/coverage`)
    const e = selected.find(e => e.id === access.evidenceId)
    check(e, `${prefix}: access must reference selected evidence`)
    if (!e || !object(e.footprint)) continue
    const f = e.footprint
    if (f.type === 'point') check(access.selectionBasis === 'associated-rover-position' && point(f.position) && access.point.x === f.position.x && access.point.y === f.position.y, `${prefix}: point access must preserve source position`)
    if (f.type === 'area' && simpleRing(f.ring)) {
      const cell = mapToCell(terrain.manifest.raster, access.point)
      check(access.selectionBasis === 'reviewed-area-access' && insideActivityArea(access.point, f.ring) && cell && insideActivityArea(cellCenterToMap(terrain.manifest.raster, cell), f.ring), `${prefix}: access and snapped cell must be inside evidence area`)
    }
  }
  if (issues.length) throw new ScienceActivityContractError(issues)
  return structuredClone(input) as unknown as ScienceActivityCollection
}

export function reviewedScienceActivities(collection: ScienceActivityCollection): ScienceActivity[] {
  return collection.activities.filter(a => a.review.status === 'reviewed')
}
