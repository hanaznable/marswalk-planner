import type { WaypointOrigin } from '../datasets/waypointOrigin'
import type { MapContext, MineralFinding, Observation } from './context'

const position = (point: { x: number; y: number }): WaypointOrigin['position'] => ({
  x: point.x, y: point.y, basis: 'rover-position-proxy', uncertaintyMeters: null,
})
export function observationOrigin(context: MapContext, point: Observation): WaypointOrigin {
  return {
    kind: 'apxs-observation', recordId: `apxs:${context.apxsSource.table_sha256}:row-${point.sourceLine}`,
    name: point.name, mission: 'MSL Curiosity', measurementSol: point.sol,
    description: 'APXS measurement record at an associated rover position; not an exact rock footprint. Repeated measurements and handled samples retain source review flags.',
    position: position(point), sourceSha256: context.apxsSource.table_sha256,
    reviewFlags: [...point.flags],
    sources: [{ url: context.apxsSource.table_url, attribution: 'Berger (2020), NASA PDS Geosciences Node', provides: `APXS measurement metadata, CSV row ${point.sourceLine}` }],
  }
}
export function mineralOrigin(point: MineralFinding): WaypointOrigin {
  return {
    kind: 'mineral-finding', recordId: `mineral:${point.sourceUrl}#${encodeURIComponent(point.name)}`,
    name: point.name, mission: 'MSL Curiosity', measurementSol: null,
    description: point.description, position: position(point), sourceSha256: null, reviewFlags: [],
    sources: [{ url: point.sourceUrl, attribution: 'NASA/JPL-Caltech', provides: 'Published sample mineral finding; no quantitative abundance raster or exact target coordinates' }],
  }
}
