import type { TerrainPackage } from '../datasets/terrainPackage'
import type { RasterDisplay } from './useDisplayLayers'

export function rasterScale(terrain: TerrainPackage, kind: RasterDisplay) {
  const values = kind === 'elevation' ? terrain.elevation : terrain.slope
  let min = Infinity, max = -Infinity
  for (const value of values) if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value) }
  return { values, min, max, unit: kind === 'elevation' ? 'm' : '°' }
}

/** One canvas pixel per raster cell, row 0 = north edge; shared by the 2D and 3D views. */
export function rasterCanvas(terrain: TerrainPackage, kind: RasterDisplay): HTMLCanvasElement {
  const { width, height } = terrain.manifest.raster
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.putImageData(new ImageData(rasterPixels(terrain, kind), width, height), 0, 0)
  return canvas
}

export function rasterPixels(terrain: TerrainPackage, kind: RasterDisplay): Uint8ClampedArray<ArrayBuffer> {
  const { values, min, max } = rasterScale(terrain, kind)
  const pixels = new Uint8ClampedArray(values.length * 4)
  const stops = kind === 'elevation'
    ? [[44, 72, 105], [55, 135, 155], [177, 166, 113], [231, 212, 181]]
    : [[47, 119, 132], [224, 184, 92], [218, 101, 60], [142, 41, 65]]
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) continue
    const t = max > min ? (values[i] - min) / (max - min) : 0.5
    const index = Math.min(2, Math.floor(t * 3))
    const mix = t * 3 - index
    for (let channel = 0; channel < 3; channel++) pixels[i * 4 + channel] = stops[index][channel] * (1 - mix) + stops[index + 1][channel] * mix
    pixels[i * 4 + 3] = 255
  }
  return pixels
}
