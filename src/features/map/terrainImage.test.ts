import { describe, expect, it } from 'vitest'
import { elevationToRgba } from './terrainImage'

describe('elevationToRgba', () => {
  it('scales elevation to grey and makes no-data cells transparent', () => {
    const rgba = elevationToRgba(Float32Array.from([10, Number.NaN, 30]))
    expect(rgba.length).toBe(12)
    // lowest value is the darkest grey, highest the lightest, all opaque
    expect(rgba[0]).toBeLessThan(rgba[8])
    expect(rgba[0]).toBe(rgba[1])
    expect(rgba[3]).toBe(255)
    expect(rgba[11]).toBe(255)
    // NaN cell is fully transparent
    expect(rgba[7]).toBe(0)
  })

  it('renders flat terrain as a single mid grey', () => {
    const rgba = elevationToRgba(Float32Array.from([5, 5]))
    expect(rgba[0]).toBe(rgba[4])
    expect(rgba[3]).toBe(255)
  })

  it('renders an all-no-data raster fully transparent', () => {
    const rgba = elevationToRgba(Float32Array.from([Number.NaN, Number.NaN]))
    expect(rgba[3]).toBe(0)
    expect(rgba[7]).toBe(0)
  })
})
