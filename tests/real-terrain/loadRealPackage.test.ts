/** Loads the committed real package through the frontend loader. Reads files, so it lives outside src. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadTerrainPackage } from '../../src/features/datasets/loadTerrainPackage'

describe('real Pahrump Hills v1 package through the frontend loader', () => {
  it('loads, validates and decodes every layer', async () => {
    const directory = new URL('../../public/data/gale/pahrump-hills-v1/', import.meta.url)
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
