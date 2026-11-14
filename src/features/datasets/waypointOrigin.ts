import type { MapPoint } from './terrainContract'
import type { TargetSource } from './scienceTargets'

/** Explicit selection metadata, independent of routing costs and display labels. */
export interface WaypointOrigin {
  readonly kind: 'apxs-observation' | 'mineral-finding'
  readonly recordId: string
  readonly name: string
  readonly mission: string
  readonly measurementSol: number | null
  readonly description: string
  readonly position: MapPoint & { readonly basis: 'rover-position-proxy'; readonly uncertaintyMeters: null }
  readonly sources: readonly TargetSource[]
  readonly sourceSha256: string | null
  readonly reviewFlags: readonly string[]
}
