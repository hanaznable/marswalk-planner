/** Source context. Explicitly selected points become waypoints; no terrain costs are supplied here. */
import { mapToCell, rasterBounds, type MapPoint } from '../datasets/terrainContract'
import { isCellCovered, type TerrainPackage } from '../datasets/terrainPackage'

export interface Observation extends MapPoint {
  name: string
  sol: number
  flags: string[]
  sourceLine: number
}
export interface MineralFinding extends MapPoint { name: string; description: string; sourceUrl: string }
export interface MapContext {
  terrainPackageId: string
  terrainManifestSha256: string
  apxsSource: { table_url: string; table_sha256: string }
  observations: Observation[]
  traverseSegments: [number, number][][]
  mineralFindings: MineralFinding[]
}

/** Data registration is separate from terrain contracts; add future packages here. */
export const contextRegistry: Readonly<Record<string, string>> = {
  'pahrump-hills-v1': 'data/layer-lab/pahrump-hills-v1/context.json',
}

type RecordValue = Record<string, unknown>
function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const nonnegativeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0
function sourceUrl(value: unknown): value is string {
  if (!text(value)) return false
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

export function parseMapContext(input: unknown, terrain: TerrainPackage, manifestSha256: string): MapContext {
  if (!record(input) || input.contractVersion !== 1 || input.purpose !== 'display-only-research-preview') throw new Error('Unsupported display context')
  if (input.terrainPackageId !== terrain.manifest.id || input.terrainManifestSha256 !== manifestSha256) throw new Error('Display context was prepared for a different terrain version')
  if (!record(input.apxsSource) || !sourceUrl(input.apxsSource.table_url) || typeof input.apxsSource.table_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(input.apxsSource.table_sha256)) throw new Error('APXS source URL or snapshot hash is missing or invalid')
  const validPoint = (value: unknown): value is RecordValue & MapPoint => {
    if (!record(value) || typeof value.x !== 'number' || typeof value.y !== 'number' || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return false
    const cell = mapToCell(terrain.manifest.raster, { x: value.x, y: value.y })
    return cell !== null && isCellCovered(terrain, cell)
  }
  if (!Array.isArray(input.observations) || !input.observations.every((value) => validPoint(value) && text(value.name) && nonnegativeInteger(value.sol) && nonnegativeInteger(value.sourceLine) && Array.isArray(value.flags) && value.flags.every(text))) throw new Error('Invalid or uncovered APXS observations')
  if (!Array.isArray(input.mineralFindings) || !input.mineralFindings.every((value) => validPoint(value) && text(value.name) && text(value.description) && sourceUrl(value.sourceUrl))) throw new Error('Invalid or uncovered mineral findings')
  const box = rasterBounds(terrain.manifest.raster)
  const validVertex = (value: unknown) => Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === 'number' && Number.isFinite(v)) && value[0] >= box.minX && value[0] <= box.maxX && value[1] >= box.minY && value[1] <= box.maxY
  if (!Array.isArray(input.traverseSegments) || !input.traverseSegments.every((segment) => Array.isArray(segment) && segment.length === 2 && segment.every(validVertex))) throw new Error('Historical traverse is not clipped to the terrain footprint')
  return input as unknown as MapContext
}

export async function loadMapContext(contextUrl: string, manifestUrl: string, terrain: TerrainPackage, signal?: AbortSignal): Promise<MapContext> {
  const [contextResponse, manifestResponse] = await Promise.all([fetch(contextUrl, { signal }), fetch(manifestUrl, { signal })])
  if (!contextResponse.ok || !manifestResponse.ok) throw new Error(`Display context download failed (HTTP ${contextResponse.status}/${manifestResponse.status})`)
  const [input, bytes] = await Promise.all([contextResponse.json(), manifestResponse.arrayBuffer()])
  // Verify against the same manifest the active TerrainPackage actually uses,
  // even if its URL was updated between requests.
  const servedManifest = JSON.parse(new TextDecoder().decode(bytes))
  if (JSON.stringify(servedManifest) !== JSON.stringify(terrain.manifest)) throw new Error('Terrain manifest changed during loading; reload the region')
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
  return parseMapContext(input, terrain, hash)
}
