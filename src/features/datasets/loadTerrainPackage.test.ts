import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadTerrainPackage, TerrainLoadError } from './loadTerrainPackage'

// Synthetic fixture: arbitrary numbers, not NASA data.
const manifest = {
  contractVersion: 1,
  id: 'synthetic-test',
  title: 'Synthetic test grid',
  synthetic: true,
  source: null,
  crs: { name: 'Synthetic local metres', wkt: 'LOCAL_CS["synthetic"]' },
  raster: { width: 2, height: 1, geoTransform: [0, 5, 0, 5, 0, -5] },
  layers: {
    elevation: { url: 'layers/elevation.f32', dataType: 'float32' },
    slope: { url: 'slope.f32', dataType: 'float32' },
  },
  basemap: { url: 'basemap.jpg', width: 4, height: 2, geoTransform: [0, 2.5, 0, 5, 0, -2.5] },
}

const float32 = (...values: number[]) => {
  const buffer = new ArrayBuffer(values.length * 4)
  const view = new DataView(buffer)
  values.forEach((value, i) => view.setFloat32(i * 4, value, true))
  return buffer
}

const MANIFEST_URL = 'https://example.test/data/pkg/manifest.json'

/** Fake fetch serving a map of absolute URL -> body; records requested URLs. */
function fakeFetch(files: Record<string, BodyInit | (() => Response)>) {
  const requested: string[] = []
  const fetchImpl = async (input: RequestInfo | URL) => {
    const url = String(input)
    requested.push(url)
    const body = files[url]
    if (body === undefined) return new Response('missing', { status: 404, statusText: 'Not Found' })
    return typeof body === 'function' ? body() : new Response(body)
  }
  return { fetchImpl: fetchImpl as typeof fetch, requested }
}

const validFiles = () => ({
  [MANIFEST_URL]: JSON.stringify(manifest),
  'https://example.test/data/pkg/layers/elevation.f32': float32(10, Number.NaN),
  'https://example.test/data/pkg/slope.f32': float32(3, 4),
})

async function loadError(files: Record<string, BodyInit | (() => Response)>, url = MANIFEST_URL) {
  try {
    await loadTerrainPackage(url, { fetchImpl: fakeFetch(files).fetchImpl })
  } catch (error) {
    if (error instanceof TerrainLoadError) return error
    throw error
  }
  throw new Error('expected loadTerrainPackage to fail')
}

describe('loadTerrainPackage', () => {
  it('resolves layer URLs relative to the manifest and decodes them', async () => {
    const { fetchImpl, requested } = fakeFetch(validFiles())
    const loaded = await loadTerrainPackage(MANIFEST_URL, { fetchImpl })
    expect(requested).toEqual([
      MANIFEST_URL,
      'https://example.test/data/pkg/layers/elevation.f32',
      'https://example.test/data/pkg/slope.f32',
    ])
    expect(loaded.terrain.manifest.id).toBe('synthetic-test')
    expect(loaded.terrain.elevation[0]).toBe(10)
    expect(Number.isNaN(loaded.terrain.elevation[1])).toBe(true)
    expect(loaded.terrain.slope[1]).toBe(4)
  })

  it('resolves the basemap URL without fetching it', async () => {
    const loaded = await loadTerrainPackage(MANIFEST_URL, {
      fetchImpl: fakeFetch(validFiles()).fetchImpl,
    })
    expect(loaded.basemapUrl).toBe('https://example.test/data/pkg/basemap.jpg')
  })

  it('resolves a root-relative manifest URL against the page', async () => {
    const files = Object.fromEntries(
      Object.entries(validFiles()).map(([url, body]) => [url.replace('example.test', 'app.test'), body]),
    )
    const loaded = await loadTerrainPackage('/data/pkg/manifest.json', {
      fetchImpl: fakeFetch(files).fetchImpl,
      baseUrl: 'https://app.test/planner/',
    })
    expect(loaded.basemapUrl).toBe('https://app.test/data/pkg/basemap.jpg')
  })

  it('reports an HTTP failure for the manifest', async () => {
    const error = await loadError({})
    expect(error.stage).toBe('manifest')
    expect(error.message).toContain('404')
  })

  it('reports a manifest that is not JSON', async () => {
    const error = await loadError({ ...validFiles(), [MANIFEST_URL]: '<html>' })
    expect(error.stage).toBe('manifest')
  })

  it('reports contract violations with their issues', async () => {
    const error = await loadError({
      ...validFiles(),
      [MANIFEST_URL]: JSON.stringify({ ...manifest, contractVersion: 2 }),
    })
    expect(error.stage).toBe('contract')
    expect(error.message).toContain('contractVersion must be 1')
  })

  it('reports a missing layer file', async () => {
    const files = validFiles()
    delete (files as Record<string, unknown>)['https://example.test/data/pkg/slope.f32']
    const error = await loadError(files)
    expect(error.stage).toBe('layer')
    expect(error.message).toContain('slope')
  })

  it('reports a layer whose size does not match the grid', async () => {
    const error = await loadError({
      ...validFiles(),
      'https://example.test/data/pkg/slope.f32': float32(3),
    })
    expect(error.stage).toBe('layer')
  })

  it('refuses asset URLs that leave the manifest origin', async () => {
    const hostile = {
      ...manifest,
      layers: { ...manifest.layers, slope: { url: 'https://elsewhere.test/slope.f32', dataType: 'float32' } },
    }
    const error = await loadError({ ...validFiles(), [MANIFEST_URL]: JSON.stringify(hostile) })
    expect(error.stage).toBe('contract')
  })

  it('loads the real Pahrump Hills v1 package', async () => {
    const directory = new URL('../../../public/data/gale/pahrump-hills-v1/', import.meta.url)
    const base = 'https://app.test/data/gale/pahrump-hills-v1/'
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const name = String(input).slice(base.length)
      const bytes = readFileSync(new URL(name, directory))
      return new Response(new Uint8Array(bytes))
    }) as typeof fetch
    const loaded = await loadTerrainPackage(`${base}manifest.json`, { fetchImpl })
    expect(loaded.terrain.manifest.synthetic).toBe(false)
    expect(loaded.terrain.manifest.source?.attribution).toBe('NASA/JPL-Caltech/UArizona')
    expect(loaded.terrain.elevation).toHaveLength(40000)
    expect(loaded.terrain.slope).toHaveLength(40000)
    expect(loaded.basemapUrl).toBe(`${base}basemap.jpg`)
  })
})
