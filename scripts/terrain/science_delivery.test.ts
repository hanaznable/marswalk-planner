/** Verify the real science delivery against Y's existing runtime contracts. */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { datasetRegistry } from '../../src/features/datasets/registry'
import { parseScienceTargets, splitByCoverage } from '../../src/features/datasets/scienceTargets'
import { loadScienceTargets } from '../../src/features/datasets/loadScienceTargets'
import { decodeRaster, parseTerrainManifest } from '../../src/features/datasets/terrainContract'
import { createTerrainPackage } from '../../src/features/datasets/terrainPackage'

const root = new URL('../../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root))
const terrainDir = 'public/data/gale/pahrump-hills-v1/'
const scienceDir = 'public/data/science/pahrump-hills-v1/'
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const json = (path: string) => JSON.parse(read(path).toString())
const manifest = parseTerrainManifest(json(terrainDir + 'manifest.json'))
const collection = parseScienceTargets(json(scienceDir + 'targets.json'))
const decode = (filename: string) => {
  const bytes = read(terrainDir + filename)
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return decodeRaster(buffer, manifest.raster)
}
const terrain = createTerrainPackage(manifest, {
  elevation: decode(manifest.layers.elevation.url),
  slope: decode(manifest.layers.slope.url),
})

describe('real Curiosity science collection delivery', () => {
  it('keeps all reviewed proxies on the expected covered cells', () => {
    const placed = splitByCoverage(collection, terrain)
    expect(placed.outside).toEqual([])
    expect(placed.inside.map(({ target, cell }) => [target.name, cell.row, cell.col])).toEqual([
      ['Confidence Hills', 95, 98], ['Mojave 2', 97, 98], ['Telegraph Peak', 105, 98],
    ])
    expect(collection.synthetic).toBe(false)
    expect(collection.targets.map((t) => [t.activitySol, t.positionSol])).toEqual([
      [759, 753], [882, 864], [908, 903],
    ])
    for (const target of collection.targets) {
      expect(target.position.basis).toBe('rover-position-proxy')
      expect(target.position.uncertaintyMeters).toBeNull()
      expect(target.sources).toHaveLength(3)
      expect(target.description).toContain('not the exact drill-hole location')
    }
  })

  it('pins the terrain version, source review and exact delivered JSON bytes', () => {
    const provenance = json(scienceDir + 'provenance.json')
    expect(collection.terrainManifestSha256).toBe(hash(read(terrainDir + 'manifest.json')))
    expect(provenance.terrainManifestSha256).toBe(collection.terrainManifestSha256)
    expect(provenance.review_input_sha256).toBe(hash(read('docs/terrain/science-positions-provenance.json')))
    expect(provenance.output_sha256['targets.json']).toBe(hash(read(scienceDir + 'targets.json')))
    // Existing terrain package's hashes must remain valid after science delivery.
    for (const [file, expected] of Object.entries(json(terrainDir + 'provenance.json').output_sha256)) {
      expect(hash(read(terrainDir + file))).toBe(expected)
    }
    for (const record of provenance.review.records) {
      const target = collection.targets.find((t) => t.name === record.name)!
      expect(target.position.x).toBeCloseTo(record.package_source_crs_position_m.x, 8)
      expect(target.position.y).toBeCloseTo(record.package_source_crs_position_m.y, 8)
    }
  })

  it('loads the registered asset through the existing frontend loader', async () => {
    const url = datasetRegistry.find((d) => d.id === manifest.id)!.scienceTargetsUrl!
    const loaded = await loadScienceTargets(url, {
      baseUrl: 'https://example.test/',
      fetchImpl: async (input) => {
        const path = new URL(String(input)).pathname
        expect(path).toBe('/data/science/pahrump-hills-v1/targets.json')
        return new Response(read('public' + path).toString(), { status: 200 })
      },
    })
    expect(splitByCoverage(loaded, terrain).inside).toHaveLength(3)
  })
})
