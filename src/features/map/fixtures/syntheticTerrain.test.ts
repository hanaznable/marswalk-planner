import { describe, expect, it } from 'vitest'
import { parseTerrainManifest } from '../../datasets/terrainContract'
import { isCellCovered } from '../../datasets/terrainPackage'
import { createSyntheticTerrain } from './syntheticTerrain'

describe('createSyntheticTerrain', () => {
  const pkg = createSyntheticTerrain()

  it('is clearly labeled synthetic and claims no source', () => {
    expect(pkg.manifest.synthetic).toBe(true)
    expect(pkg.manifest.source).toBeNull()
    expect(pkg.manifest.title).toMatch(/synthetic/i)
  })

  it('passes contract validation', () => {
    expect(() => parseTerrainManifest(pkg.manifest)).not.toThrow()
  })

  it('includes a no-coverage patch to exercise no-data handling', () => {
    const { width, height } = pkg.manifest.raster
    let missing = 0
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (!isCellCovered(pkg, { row, col })) missing++
      }
    }
    expect(missing).toBeGreaterThan(0)
    expect(missing).toBeLessThan(width * height)
  })

  it('provides slope in degrees wherever there is elevation, NaN elsewhere', () => {
    const { width, height } = pkg.manifest.raster
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const slope = pkg.slope[row * width + col]
        if (isCellCovered(pkg, { row, col })) {
          expect(slope).toBeGreaterThanOrEqual(0)
          expect(slope).toBeLessThan(90)
        } else {
          expect(Number.isNaN(slope)).toBe(true)
        }
      }
    }
  })

  it('is deterministic', () => {
    expect(createSyntheticTerrain().elevation).toEqual(pkg.elevation)
  })
})
