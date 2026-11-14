/** Keeps the dataset registry consistent with committed manifests. Reads files, so it lives outside src. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { regions } from '../../src/features/datasets/regions'
import { datasetRegistry, findDataset } from '../../src/features/datasets/registry'
import { parseTerrainManifest } from '../../src/features/datasets/terrainContract'

describe('dataset registry', () => {
  it('matches the committed manifest of every registered package', () => {
    for (const dataset of datasetRegistry) {
      const path = new URL(`../../public/${dataset.processedAssetUrl}`, import.meta.url)
      const manifest = parseTerrainManifest(JSON.parse(readFileSync(path, 'utf8')))
      expect(manifest.id).toBe(dataset.id)
      expect(manifest.title).toBe(dataset.title)
      expect(manifest.synthetic).toBe(false)
      expect(manifest.source?.url).toBe(dataset.sourceUrl)
      expect(manifest.source?.attribution).toBe(dataset.attribution)
      expect(manifest.crs.name).toBe(dataset.coordinateReferenceSystem)
      expect(dataset.limitations.length).toBeGreaterThan(0)
    }
  })

  it('points every package region at a registered dataset belonging to it', () => {
    for (const region of regions) {
      if (region.terrain?.kind !== 'package') continue
      expect(findDataset(region.terrain.datasetId)?.regionId).toBe(region.id)
    }
  })

  it('defaults to the real Gale Crater package', () => {
    expect(regions[0].terrain).toEqual({ kind: 'package', datasetId: 'pahrump-hills-v1' })
  })
})
