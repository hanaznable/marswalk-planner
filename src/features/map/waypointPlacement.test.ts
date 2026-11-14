import { describe, expect, it } from 'vitest'
import { parseTerrainManifest } from '../datasets/terrainContract'
import { createTerrainPackage } from '../datasets/terrainPackage'
import {
  fromLatLng,
  nextWaypointId,
  placeWaypoint,
  toLatLng,
  waypointRoleLabel,
} from './waypointPlacement'

// Synthetic fixture: arbitrary numbers, not NASA data.
const pkg = createTerrainPackage(
  parseTerrainManifest({
    contractVersion: 1,
    id: 'synthetic-test',
    title: 'Synthetic test grid',
    synthetic: true,
    source: null,
    crs: { name: 'Synthetic local metres', wkt: 'LOCAL_CS["synthetic"]' },
    raster: { width: 2, height: 2, geoTransform: [100, 10, 0, 200, 0, -10] },
    layers: {
      elevation: { url: 'e.f32', dataType: 'float32' },
      slope: { url: 's.f32', dataType: 'float32' },
    },
  }),
  {
    elevation: Float32Array.from([1, Number.NaN, 3, 4]),
    slope: new Float32Array(4),
  },
)
const raster = pkg.manifest.raster

describe('placeWaypoint', () => {
  it('snaps a covered point to its cell and cell centre', () => {
    expect(placeWaypoint(pkg, { x: 102, y: 181 })).toEqual({
      ok: true,
      cell: { row: 1, col: 0 },
      point: { x: 105, y: 185 },
    })
  })

  it('rejects points outside the terrain extent', () => {
    expect(placeWaypoint(pkg, { x: 99, y: 195 })).toEqual({
      ok: false,
      reason: 'outsideTerrain',
    })
  })

  it('rejects cells without elevation data', () => {
    expect(placeWaypoint(pkg, { x: 115, y: 195 })).toEqual({
      ok: false,
      reason: 'noData',
    })
  })
})

describe('waypointRoleLabel', () => {
  it('names the first waypoint start, the last destination, others stops', () => {
    expect([0, 1, 2, 3].map((i) => waypointRoleLabel(i, 4))).toEqual([
      'Start',
      'Stop 1',
      'Stop 2',
      'Destination',
    ])
  })

  it('calls a single waypoint the start', () => {
    expect(waypointRoleLabel(0, 1)).toBe('Start')
  })
})

describe('nextWaypointId', () => {
  it('returns an id not used by the list', () => {
    const cell = { row: 0, col: 0 }
    const list = [
      { id: 'wp-1', label: '', cell },
      { id: 'wp-3', label: '', cell },
    ]
    expect(nextWaypointId(list)).toBe('wp-4')
    expect(nextWaypointId([])).toBe('wp-1')
  })
})

describe('Leaflet coordinate conversion', () => {
  it('maps source CRS points to local-metre lat/lng and back', () => {
    // raster south-west corner is (100, 180)
    expect(toLatLng(raster, { x: 105, y: 185 })).toEqual([5, 5])
    expect(toLatLng(raster, { x: 120, y: 182 })).toEqual([2, 20])
    expect(fromLatLng(raster, { lat: 2, lng: 20 })).toEqual({ x: 120, y: 182 })
  })
})
