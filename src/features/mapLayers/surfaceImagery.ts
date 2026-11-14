/** Independently versioned display imagery, bound to the exact terrain package. */
import { rasterBounds, type GeoTransform } from '../datasets/terrainContract'
import type { TerrainPackage } from '../datasets/terrainPackage'

export const surfaceImageryRegistry: Readonly<Record<string, string>> = {
  'pahrump-hills-v1': 'data/imagery/pahrump-hills-rgb-v1/manifest.json',
}
export interface SurfaceImageManifest {
  contractVersion: 1
  id: string
  terrainPackageId: string
  terrainManifestSha256: string
  title: string
  synthetic: false
  image: { url: string; width: number; height: number; geoTransform: GeoTransform; sha256: string }
  source: { productId: string; url: string; attribution: string; acquired: string }
  registration: string
  colorCoverage: string
  colorMeaning: string
}
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
export async function bytesSha256(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (value) => value.toString(16).padStart(2, '0')).join('')
}

export function parseSurfaceImage(input: unknown, terrain: TerrainPackage, terrainHash: string): SurfaceImageManifest {
  if (!isRecord(input) || input.contractVersion !== 1 || input.synthetic !== false || !text(input.id) || !text(input.title)) throw new Error('Unsupported surface imagery manifest')
  if (terrain.manifest.synthetic || input.terrainPackageId !== terrain.manifest.id || input.terrainManifestSha256 !== terrainHash) throw new Error('Surface imagery is for another terrain version')
  if (!isRecord(input.image) || !text(input.image.url) || !hash(input.image.sha256) || !Number.isInteger(input.image.width) || !Number.isInteger(input.image.height) || Number(input.image.width) <= 0 || Number(input.image.height) <= 0) throw new Error('Invalid surface image dimensions or reference')
  const gt = input.image.geoTransform
  if (!Array.isArray(gt) || gt.length !== 6 || !gt.every((n) => typeof n === 'number' && Number.isFinite(n)) || gt[1] <= 0 || gt[5] >= 0 || gt[2] !== 0 || gt[4] !== 0) throw new Error('Invalid surface image grid')
  const imageBounds = rasterBounds(input.image as unknown as SurfaceImageManifest['image'])
  const terrainBounds = rasterBounds(terrain.manifest.raster)
  if (Object.keys(terrainBounds).some((key) => Math.abs(imageBounds[key as keyof typeof imageBounds] - terrainBounds[key as keyof typeof terrainBounds]) > 1e-7)) throw new Error('Surface image footprint differs from the terrain')
  if (!isRecord(input.source) || !['productId', 'url', 'attribution', 'acquired'].every((key) => text(input.source && (input.source as Record<string, unknown>)[key])) || !String(input.source.url).startsWith('https://')) throw new Error('Missing surface image provenance')
  for (const key of ['registration', 'colorCoverage', 'colorMeaning']) if (!text(input[key])) throw new Error(`Surface image needs ${key}`)
  return input as unknown as SurfaceImageManifest
}

export async function loadSurfaceImage(url: string, terrainManifestUrl: string, terrain: TerrainPackage, signal?: AbortSignal) {
  const href = new URL(url, globalThis.location.href)
  const [imageManifestResponse, terrainResponse] = await Promise.all([fetch(href, { signal }), fetch(terrainManifestUrl, { signal })])
  if (!imageManifestResponse.ok || !terrainResponse.ok) throw new Error('Could not load the surface image metadata')
  const [input, terrainBytes] = await Promise.all([imageManifestResponse.json(), terrainResponse.arrayBuffer()])
  if (JSON.stringify(JSON.parse(new TextDecoder().decode(terrainBytes))) !== JSON.stringify(terrain.manifest)) throw new Error('Terrain changed during surface image loading')
  const manifest = parseSurfaceImage(input, terrain, await bytesSha256(terrainBytes))
  const imageHref = new URL(manifest.image.url, href)
  if (imageHref.origin !== href.origin) throw new Error('Surface image must use the same asset origin')
  const response = await fetch(imageHref, { signal })
  if (!response.ok) throw new Error(`Could not download the surface image (HTTP ${response.status})`)
  const bytes = await response.arrayBuffer()
  if (await bytesSha256(bytes) !== manifest.image.sha256) throw new Error('Surface image checksum does not match its provenance')
  return { manifest, bytes }
}
