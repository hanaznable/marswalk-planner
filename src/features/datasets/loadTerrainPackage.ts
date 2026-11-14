import {
  decodeRaster,
  parseTerrainManifest,
  TerrainContractError,
  type TerrainManifest,
} from './terrainContract'
import { createTerrainPackage, type TerrainPackage } from './terrainPackage'

export type TerrainLoadStage = 'manifest' | 'contract' | 'layer'

/** A terrain package failed to load; `stage` says where. */
export class TerrainLoadError extends Error {
  readonly stage: TerrainLoadStage

  constructor(stage: TerrainLoadStage, message: string) {
    super(message)
    this.name = 'TerrainLoadError'
    this.stage = stage
  }
}

export interface LoadedTerrain {
  readonly terrain: TerrainPackage
  /** Absolute basemap URL, resolved but not fetched; null if the package has none. */
  readonly basemapUrl: string | null
}

export interface LoadOptions {
  fetchImpl?: typeof fetch
  /** Base for resolving a relative manifest URL; defaults to the current page. */
  baseUrl?: string
  signal?: AbortSignal
}

/**
 * Loads a contract-v1 terrain package: fetches and validates the manifest,
 * resolves asset paths relative to the manifest URL (same origin only),
 * then fetches and decodes the elevation and slope layers.
 */
export async function loadTerrainPackage(
  manifestUrl: string,
  { fetchImpl = fetch, baseUrl = globalThis.location?.href, signal }: LoadOptions = {},
): Promise<LoadedTerrain> {
  const manifestHref = new URL(manifestUrl, baseUrl)

  const manifestResponse = await request(fetchImpl, manifestHref, signal, 'manifest', 'manifest')
  let json: unknown
  try {
    json = await manifestResponse.json()
  } catch {
    throw new TerrainLoadError('manifest', `Terrain manifest at ${manifestHref} is not valid JSON.`)
  }

  let manifest: TerrainManifest
  try {
    manifest = parseTerrainManifest(json)
  } catch (error) {
    if (error instanceof TerrainContractError) {
      throw new TerrainLoadError('contract', `Terrain manifest breaks contract v1: ${error.issues.join('; ')}`)
    }
    throw error
  }

  const resolve = (path: string, what: string) => {
    const url = new URL(path, manifestHref)
    if (url.origin !== manifestHref.origin) {
      throw new TerrainLoadError('contract', `The ${what} URL must stay on the manifest's origin.`)
    }
    return url
  }
  const elevationUrl = resolve(manifest.layers.elevation.url, 'elevation layer')
  const slopeUrl = resolve(manifest.layers.slope.url, 'slope layer')
  const basemapUrl = manifest.basemap ? resolve(manifest.basemap.url, 'basemap').href : null

  const elevation = await loadLayer(fetchImpl, elevationUrl, manifest, 'elevation', signal)
  const slope = await loadLayer(fetchImpl, slopeUrl, manifest, 'slope', signal)

  try {
    return { terrain: createTerrainPackage(manifest, { elevation, slope }), basemapUrl }
  } catch (error) {
    throw new TerrainLoadError('layer', error instanceof Error ? error.message : String(error))
  }
}

async function request(
  fetchImpl: typeof fetch,
  url: URL,
  signal: AbortSignal | undefined,
  stage: TerrainLoadStage,
  what: string,
): Promise<Response> {
  let response: Response
  try {
    response = await fetchImpl(url.href, { signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new TerrainLoadError(stage, `Could not download the ${what} (${url.pathname}): ${String(error)}`)
  }
  if (!response.ok) {
    throw new TerrainLoadError(
      stage,
      `Could not download the ${what} (${url.pathname}): HTTP ${response.status} ${response.statusText}`.trim(),
    )
  }
  return response
}

async function loadLayer(
  fetchImpl: typeof fetch,
  url: URL,
  manifest: TerrainManifest,
  name: string,
  signal: AbortSignal | undefined,
): Promise<Float32Array> {
  const response = await request(fetchImpl, url, signal, 'layer', `${name} layer`)
  const buffer = await response.arrayBuffer()
  try {
    return decodeRaster(buffer, manifest.raster)
  } catch (error) {
    const detail = error instanceof TerrainContractError ? error.issues.join('; ') : String(error)
    throw new TerrainLoadError('layer', `The ${name} layer does not match the grid: ${detail}`)
  }
}
