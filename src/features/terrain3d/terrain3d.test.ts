import { describe, expect, it } from 'vitest'
import {
  cellCenterToMap,
  mapToCell,
  parseTerrainManifest,
  type RasterGrid,
} from '../datasets/terrainContract'
import { createTerrainPackage } from '../datasets/terrainPackage'
import type { RouteResult, Waypoint } from '../routing'
import { drapeSegment, overlayLift, routeLines, surfaceElevationAt, surfacePoint, waypointAnchors } from './overlays'
import {
  createSceneFrame,
  elevationRange,
  fromScene,
  sceneHeightToElevation,
  toScene,
} from './sceneFrame'
import { buildTerrainMesh, imageUvTransform } from './terrainMesh'

// Synthetic fixture, not NASA data: 4 columns x 3 rows of 10 m cells, north-up,
// with Mars-datum-like elevations. Elevation rises to the north and east so
// orientation mistakes change the expected numbers.
const raster: RasterGrid = { width: 4, height: 3, geoTransform: [1000, 10, 0, 5030, 0, -10] }
const elevation = Float32Array.from([
  -4010, -4008, -4006, -4004, // row 0 = north edge
  -4020, -4018, -4016, -4014,
  -4030, -4028, -4026, -4024, // row 2 = south edge
])

function terrain(values = elevation) {
  return createTerrainPackage(
    parseTerrainManifest({
      contractVersion: 1,
      id: 'test-grid',
      title: 'Test grid',
      synthetic: true,
      source: null,
      crs: { name: 'Test', wkt: 'LOCAL_CS["test"]' },
      raster,
      layers: {
        elevation: { url: 'e.f32', dataType: 'float32' },
        slope: { url: 's.f32', dataType: 'float32' },
      },
    }),
    { elevation: values, slope: new Float32Array(values.length) },
  )
}

const frame = createSceneFrame(raster, { min: -4030, max: -4004 })

describe('scene frame', () => {
  it('centres the footprint and uses the middle of the valid elevation range as vertical origin', () => {
    expect(frame.centre).toEqual({ x: 1020, y: 5015 })
    expect(frame.verticalOrigin).toBe(-4017)
    expect(elevationRange(Float32Array.from([NaN, -4100, -3900, NaN]))).toEqual({ min: -4100, max: -3900 })
    expect(elevationRange(Float32Array.from([NaN]))).toBeNull()
  })

  it('maps east to +x and north to -z, without mirroring', () => {
    const north = toScene(frame, { x: 1020, y: 5025 }, -4017)
    const east = toScene(frame, { x: 1035, y: 5015 }, -4017)
    expect(north).toEqual({ x: 0, y: 0, z: -10 })
    expect(east).toEqual({ x: 15, y: 0, z: -0 })
    expect(fromScene(frame, north)).toEqual({ x: 1020, y: 5025 })
    expect(fromScene(frame, { x: -20, z: 15 })).toEqual({ x: 1000, y: 5000 })
  })

  it('applies vertical exaggeration to scene height only and recovers original elevations', () => {
    const scaled = createSceneFrame(raster, { min: -4030, max: -4004 }, 3)
    const point = toScene(scaled, { x: 1005, y: 5025 }, -4010)
    expect(point.y).toBe(21)
    expect(sceneHeightToElevation(scaled, point.y)).toBe(-4010)
    expect(toScene(scaled, { x: 1005, y: 5025 }, -4010).x).toBe(toScene(frame, { x: 1005, y: 5025 }, -4010).x)
    expect(() => createSceneFrame(raster, { min: 0, max: 1 }, 0)).toThrow(RangeError)
  })
})

describe('terrain mesh', () => {
  const mesh = buildTerrainMesh(raster, elevation, frame)
  const vertex = (row: number, col: number) => {
    const i = (row * raster.width + col) * 3
    return Array.from(mesh.positions.slice(i, i + 3))
  }

  it('puts one vertex at every cell centre with row 0 to the north', () => {
    expect(mesh.vertexCount).toBe(12)
    // North-west cell centre (1005, 5025): west of centre, north of centre.
    expect(vertex(0, 0)).toEqual([-15, 7, -10])
    // South-east cell centre (1035, 5005).
    expect(vertex(2, 3)).toEqual([15, -7, 10])
  })

  it('keeps every triangle facing up', () => {
    const p = mesh.positions
    for (let t = 0; t < mesh.triangleCount; t++) {
      const [a, b, c] = [0, 1, 2].map((k) => mesh.indices[t * 3 + k] * 3)
      const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]]
      const v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]]
      const normalY = u[2] * v[0] - u[0] * v[2]
      expect(normalY).toBeGreaterThan(0)
    }
    expect(mesh.triangleCount).toBe((raster.width - 1) * (raster.height - 1) * 2)
  })

  it('leaves holes at no-data cells instead of inventing terrain', () => {
    const gappy = Float32Array.from(elevation)
    gappy[5] = NaN // row 1, col 1
    const holed = buildTerrainMesh(raster, gappy, frame)
    expect(holed.triangleCount).toBeLessThan(mesh.triangleCount)
    expect(Array.from(holed.indices)).not.toContain(5)
    expect(holed.positions.every(Number.isFinite)).toBe(true)
  })

  it('maps texture UVs so each vertex samples the image pixel at its own position', () => {
    // A 400 x 300 image over the same footprint, as the basemap and RGB manifests require.
    const image: RasterGrid = { width: 400, height: 300, geoTransform: [1000, 0.1, 0, 5030, 0, -0.1] }
    const { repeat, offset } = imageUvTransform(raster, image)
    expect(repeat).toEqual([1, 1])
    expect(offset).toEqual([0, 0])
    for (let row = 0; row < raster.height; row++) {
      for (let col = 0; col < raster.width; col++) {
        const i = row * raster.width + col
        const u = mesh.uvs[i * 2] * repeat[0] + offset[0]
        const v = mesh.uvs[i * 2 + 1] * repeat[1] + offset[1]
        // flipY textures: v = 1 is image row 0 (north). Compare continuous pixel coordinates.
        const centre = cellCenterToMap(raster, { row, col })
        const [ix, idx, , iy, , idy] = image.geoTransform
        // Within 1/1000 of an image pixel (UVs are stored as float32).
        expect(u * image.width).toBeCloseTo((centre.x - ix) / idx, 3)
        expect((1 - v) * image.height).toBeCloseTo((centre.y - iy) / idy, 3)
        expect(mapToCell(image, centre)).not.toBeNull()
      }
    }
  })

  it('fits imagery whose footprint differs from the raster', () => {
    // Image twice as large, extending 40 m west and 30 m south of the raster.
    const image: RasterGrid = { width: 80, height: 60, geoTransform: [960, 1, 0, 5030, 0, -1] }
    const { repeat, offset } = imageUvTransform(raster, image)
    expect(repeat).toEqual([0.5, 0.5])
    expect(offset).toEqual([0.5, 0.5])
  })

  it('rejects a layer of the wrong size', () => {
    expect(() => buildTerrainMesh(raster, new Float32Array(3), frame)).toThrow(RangeError)
  })
})

describe('overlay placement', () => {
  const pkg = terrain()

  it('samples the displayed surface between cell centres and keeps cell values at centres', () => {
    expect(surfaceElevationAt(pkg, { x: 1005, y: 5025 })).toBe(-4010)
    // Halfway between the two northern-most western cells.
    expect(surfaceElevationAt(pkg, { x: 1010, y: 5025 })).toBe(-4009)
    expect(surfaceElevationAt(pkg, { x: 999, y: 5025 })).toBeNull()
  })

  it('falls back to the containing cell next to no-data and returns null on it', () => {
    const gappy = Float32Array.from(elevation)
    gappy[5] = NaN
    const holed = terrain(gappy)
    expect(surfaceElevationAt(holed, { x: 1009, y: 5021 })).toBe(-4010)
    expect(surfaceElevationAt(holed, { x: 1015, y: 5015 })).toBeNull()
    expect(surfacePoint(holed, frame, { x: 1015, y: 5015 })).toBeNull()
  })

  it('draws route legs through mesh vertices, lifted, and skips failed legs', () => {
    const route: RouteResult = {
      complete: false,
      totalDistanceMeters: null,
      legs: [
        { status: 'ok', kind: 'outbound', fromId: 'a', toId: 'b', distanceMeters: 20, path: [{ row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 }] },
        { status: 'failed', kind: 'outbound', fromId: 'b', toId: 'c', reason: { kind: 'noPath' } },
      ],
    } as unknown as RouteResult
    const [line, ...rest] = routeLines(pkg, frame, route)
    expect(rest).toHaveLength(0)
    const lift = overlayLift(pkg)
    expect(lift).toBe(3)
    expect(Array.from(line.slice(0, 3))).toEqual([-15, 7 + lift, -10])
    expect(Array.from(line.slice(6, 9))).toEqual([5, -9 + lift, 10])
  })

  it('drapes long context segments over the surface and leaves no-data stretches out', () => {
    const pairs = drapeSegment(pkg, frame, { x: 1005, y: 5025 }, { x: 1035, y: 5025 })
    expect(pairs).toHaveLength(3 * 6)
    expect(pairs[1]).toBe(7 + overlayLift(pkg))
    expect(pairs[pairs.length - 2]).toBe(13 + overlayLift(pkg))
    const gappy = Float32Array.from(elevation)
    gappy[5] = NaN
    const across = drapeSegment(terrain(gappy), frame, { x: 1005, y: 5015 }, { x: 1035, y: 5015 })
    // Cell (1,1) has no data: the pieces touching it are dropped.
    expect(across).toHaveLength(1 * 6)
  })

  it('places waypoints in planner order with the same labels as the 2D map', () => {
    const waypoints: Waypoint[] = [
      { id: 'w1', label: 'Point 1', cell: { row: 2, col: 0 } },
      { id: 'w2', label: 'Confidence Hills', cell: { row: 1, col: 2 } },
      { id: 'w3', label: 'Point 3', cell: { row: 0, col: 3 } },
    ]
    const scaled = createSceneFrame(raster, { min: -4030, max: -4004 }, 2)
    const anchors = waypointAnchors(pkg, scaled, waypoints)
    expect(anchors.map((anchor) => anchor.text)).toEqual(['S', '1', 'D'])
    expect(anchors[1].title).toBe('Stop 1: Confidence Hills')
    // East of centre, on the middle row, at -4016 m with 2x exaggeration plus a scaled lift.
    expect(anchors[1].position).toEqual({ x: 5, y: 2 + 6, z: -0 })
  })
})
