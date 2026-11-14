const DARKEST = 60
const LIGHTEST = 205

/**
 * Greyscale RGBA pixels for an elevation raster: low is dark, high is light,
 * no-data cells are transparent. Display only; not a scientific colour scale.
 */
export function elevationToRgba(elevation: Float32Array): Uint8ClampedArray {
  let min = Infinity
  let max = -Infinity
  for (const value of elevation) {
    if (!Number.isFinite(value)) continue
    if (value < min) min = value
    if (value > max) max = value
  }
  const range = max - min
  const rgba = new Uint8ClampedArray(elevation.length * 4)
  for (let i = 0; i < elevation.length; i++) {
    const value = elevation[i]
    if (!Number.isFinite(value)) continue // stays transparent
    const t = range > 0 ? (value - min) / range : 0.5
    const grey = DARKEST + t * (LIGHTEST - DARKEST)
    rgba[i * 4] = grey
    rgba[i * 4 + 1] = grey
    rgba[i * 4 + 2] = grey
    rgba[i * 4 + 3] = 255
  }
  return rgba
}
