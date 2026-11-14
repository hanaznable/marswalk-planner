import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseTerrainManifest, decodeRaster, mapToCell } from '../../src/features/datasets/terrainContract'
import { createTerrainPackage } from '../../src/features/datasets/terrainPackage'
import { toLatLng, fromLatLng } from '../../src/features/map/waypointPlacement'
import { parseMapContext } from '../../src/features/mapLayers/context'
import { rasterPixels } from '../../src/features/mapLayers/rasterDisplay'
import { parseSurfaceImage } from '../../src/features/mapLayers/surfaceImagery'
import { observationOrigin, mineralOrigin } from '../../src/features/mapLayers/waypointOrigins'

const root = new URL('../../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root))
const manifestBytes = read('public/data/gale/pahrump-hills-v1/manifest.json')
const hash = createHash('sha256').update(manifestBytes).digest('hex')
const manifest = parseTerrainManifest(JSON.parse(manifestBytes.toString()))
const layer = (name: string) => {
  const bytes = read('public/data/gale/pahrump-hills-v1/' + name)
  const array = new Uint8Array(bytes.length)
  array.set(bytes)
  return decodeRaster(array.buffer, manifest.raster)
}
const terrain = createTerrainPackage(manifest, {
  elevation: layer(manifest.layers.elevation.url), slope: layer(manifest.layers.slope.url),
})
const input = () => JSON.parse(read('public/data/layer-lab/pahrump-hills-v1/context.json').toString())

describe('main-map display context', () => {
  it('constructs source identities from selected records rather than display-label guesses', () => {
    const context = parseMapContext(input(), terrain, hash)
    const point = context.observations.find((item) => item.flags.length > 0)!
    const origin = observationOrigin(context, point)
    expect(origin.recordId).toContain(context.apxsSource.table_sha256)
    expect(origin.recordId).toContain(String(point.sourceLine))
    expect(origin.measurementSol).toBe(point.sol)
    expect(origin.reviewFlags).toEqual(point.flags)
    expect(origin.position).toMatchObject({ x: point.x, y: point.y, basis: 'rover-position-proxy', uncertaintyMeters: null })
    expect(mineralOrigin(context.mineralFindings[0]).sources[0].url).toBe(context.mineralFindings[0].sourceUrl)
    expect(mineralOrigin(context.mineralFindings[0]).measurementSol).toBeNull()
  })
  it('binds the color image to the exact terrain and footprint, retaining coverage caveats', () => {
    const path = 'public/data/imagery/pahrump-hills-rgb-v1/'
    const input = JSON.parse(read(path + 'manifest.json').toString())
    const color = parseSurfaceImage(input, terrain, hash)
    expect(color.colorCoverage).toContain('Partial color coverage')
    expect(color.colorMeaning).toContain('synthetic blue')
    expect(createHash('sha256').update(read(path + color.image.url)).digest('hex')).toBe(color.image.sha256)
    const badFootprint = structuredClone(input); badFootprint.image.geoTransform[0] += 1
    expect(() => parseSurfaceImage(badFootprint, terrain, hash)).toThrow('footprint')
    expect(() => parseSurfaceImage(input, terrain, '0'.repeat(64))).toThrow('terrain version')
    const provenance = JSON.parse(read(path + 'provenance.json').toString())
    for (const [file, expected] of Object.entries(provenance.output_sha256)) {
      expect(createHash('sha256').update(read(path + file)).digest('hex')).toBe(expected)
    }
  })
  it('accepts the real context and preserves the existing source-to-local coordinate convention', () => {
    const context = parseMapContext(input(), terrain, hash)
    expect(context.observations).toHaveLength(104)
    expect(context.traverseSegments).toHaveLength(1037)
    expect(context.mineralFindings).toHaveLength(1)
    for (const point of [...context.observations, ...context.mineralFindings]) {
      const [lat, lng] = toLatLng(manifest.raster, point)
      const roundtrip = fromLatLng(manifest.raster, { lat, lng })
      expect(roundtrip.x).toBeCloseTo(point.x, 8)
      expect(roundtrip.y).toBeCloseTo(point.y, 8)
    }
  })

  it('refuses another package or another exact manifest version', () => {
    const wrongPackage = input(); wrongPackage.terrainPackageId = 'other-region'
    expect(() => parseMapContext(wrongPackage, terrain, hash)).toThrow('different terrain version')
    expect(() => parseMapContext(input(), terrain, '0'.repeat(64))).toThrow('different terrain version')
  })

  it('rejects uncovered points, malformed quality flags and unsafe source URLs', () => {
    const outside = input(); outside.observations[0].x = 1e8
    expect(() => parseMapContext(outside, terrain, hash)).toThrow('uncovered APXS')
    const missing = input()
    const cell = mapToCell(manifest.raster, missing.observations[0])!
    const elevation = terrain.elevation.slice(); elevation[cell.row * manifest.raster.width + cell.col] = NaN
    expect(() => parseMapContext(missing, createTerrainPackage(manifest, { elevation, slope: terrain.slope }), hash)).toThrow('uncovered APXS')
    const flags = input(); flags.observations[0].flags = [42]
    expect(() => parseMapContext(flags, terrain, hash)).toThrow('APXS')
    const unsafe = input(); unsafe.mineralFindings[0].sourceUrl = 'javascript:alert(1)'
    expect(() => parseMapContext(unsafe, terrain, hash)).toThrow('mineral')
  })

  it('refuses traverse vertices outside coverage rather than drawing misleading extensions', () => {
    const outside = input(); outside.traverseSegments[0][0][0] = 1e8
    expect(() => parseMapContext(outside, terrain, hash)).toThrow('clipped')
  })

  it('leaves routing arrays unchanged when making both display rasters and masks missing samples', () => {
    const beforeZ = terrain.elevation.slice(), beforeS = terrain.slope.slice()
    for (const kind of ['elevation', 'slope'] as const) {
      expect(rasterPixels(terrain, kind)).toHaveLength(40000 * 4)
      const elevation = terrain.elevation.slice(), slope = terrain.slope.slice()
      elevation[0] = NaN; slope[0] = NaN
      expect(rasterPixels(createTerrainPackage(manifest, { elevation, slope }), kind)[3]).toBe(0)
    }
    expect(terrain.elevation).toEqual(beforeZ)
    expect(terrain.slope).toEqual(beforeS)
  })
})
