/** Display derivatives of the delivered 5 m grid. Never imported by routing. */
import type { TerrainPackage } from '../datasets/terrainPackage'

export type RasterPreview = 'elevation' | 'slope' | 'hillshade' | 'roughness' | 'coverage'
export interface PreviewValues {
  values: Float32Array
  min: number
  max: number
  unit: string
}

export function previewValues(terrain: TerrainPackage, kind: RasterPreview): PreviewValues {
  const { width, height, geoTransform } = terrain.manifest.raster
  const z = terrain.elevation
  const values = new Float32Array(z.length).fill(NaN)
  if (kind === 'elevation' || kind === 'slope') values.set(kind === 'elevation' ? z : terrain.slope)
  else if (kind === 'coverage') {
    for (let i = 0; i < z.length; i++) values[i] = Number.isFinite(z[i]) && Number.isFinite(terrain.slope[i]) ? 1 : 0
  } else {
    const sunAzimuth = 315 * Math.PI / 180
    const sunAltitude = 45 * Math.PI / 180
    for (let row = 1; row < height - 1; row++) {
      for (let col = 1; col < width - 1; col++) {
        const neighbours: number[] = []
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) neighbours.push(z[(row + dr) * width + col + dc])
        if (!neighbours.every(Number.isFinite)) continue
        const [a, b, c, d, , f, g, h, i] = neighbours
        if (kind === 'hillshade') {
          const east = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * geoTransform[1])
          const north = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * geoTransform[5])
          const dot = -east * Math.sin(sunAzimuth) * Math.cos(sunAltitude)
            - north * Math.cos(sunAzimuth) * Math.cos(sunAltitude) + Math.sin(sunAltitude)
          values[row * width + col] = Math.max(0, dot / Math.hypot(east, north, 1))
        } else {
          // Least-squares plane on a 3x3 window, then RMS residual in metres.
          // Offsets are cell units; residuals remain metres. Valid for any dx/dy.
          const mean = neighbours.reduce((sum, value) => sum + value, 0) / 9
          const alongCol = (c + f + i - a - d - g) / 6
          const alongRow = (g + h + i - a - b - c) / 6
          let sum = 0
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const residual = neighbours[(dr + 1) * 3 + dc + 1] - mean - alongCol * dc - alongRow * dr
            sum += residual * residual
          }
          values[row * width + col] = Math.sqrt(sum / 9)
        }
      }
    }
  }
  let min = Infinity, max = -Infinity
  for (const value of values) if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value) }
  if (kind === 'coverage' || kind === 'hillshade') { min = 0; max = 1 }
  return { values, min, max, unit: kind === 'slope' ? 'degrees' : kind === 'coverage' ? '0 missing · 1 covered' : kind === 'hillshade' ? 'relative illumination' : 'm' }
}

export function previewRgba(value: number, min: number, max: number, kind: RasterPreview): [number, number, number, number] {
  if (!Number.isFinite(value)) return [0, 0, 0, 0]
  const t = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0.5
  if (kind === 'coverage') return value === 1 ? [66, 180, 137, 255] : [225, 65, 86, 255]
  if (kind === 'hillshade') return [t * 255, t * 255, t * 255, 255]
  const stops = kind === 'elevation'
    ? [[44, 72, 105], [55, 135, 155], [177, 166, 113], [231, 212, 181]]
    : [[47, 119, 132], [224, 184, 92], [218, 101, 60], [142, 41, 65]]
  const index = Math.min(2, Math.floor(t * 3))
  const mix = t * 3 - index
  return [0, 1, 2].map((channel) => stops[index][channel] * (1 - mix) + stops[index + 1][channel] * mix).concat(255) as [number, number, number, number]
}
