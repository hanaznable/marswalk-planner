/**
 * Saved mission record (format "marswalk-mission", version 1). Pure TypeScript.
 * The format identifier keeps the earlier project name on purpose: it is
 * written into saved and exported missions, which must stay readable.
 *
 * A mission stores the planner's inputs, not its outputs: waypoints as cells of
 * a specific terrain grid, the scenario settings and selections. Routes, totals
 * and EVA estimates are recomputed when the mission is opened, so they always
 * match the current algorithms. Because waypoints are grid cells, a mission is
 * only opened on the same terrain package with an identical grid.
 */
import type { GeoTransform, RasterCell } from '../datasets/terrainContract'
import { isCellCovered, type TerrainPackage } from '../datasets/terrainPackage'
import type { WaypointOrigin } from '../datasets/waypointOrigin'
import type { Waypoint } from '../routing'

export const MISSION_FORMAT = 'marswalk-mission'
export const MISSION_VERSION = 1

/** Ranges match the planner's controls; values outside them are rejected on import. */
export const SETTING_RANGES = {
  maxSlopeDegrees: [5, 45],
  slopePenalty: [0, 10],
  walkingSpeedKmh: [0.5, 5],
  stopMinutes: [0, 120],
} as const

export interface MissionSettings {
  readonly maxSlopeDegrees: number
  readonly slopePenalty: number
  readonly returnToStart: boolean
  readonly walkingSpeedKmh: number
  readonly stopMinutes: number
}

/** Identifies the exact terrain grid the waypoint cells belong to. */
export interface MissionTerrainRef {
  readonly id: string
  readonly title: string
  readonly synthetic: boolean
  /** Source product ID for real data; null for synthetic terrain. */
  readonly productId: string | null
  readonly grid: { readonly width: number; readonly height: number; readonly geoTransform: GeoTransform }
}

export interface MissionWaypoint {
  readonly label: string
  readonly cell: RasterCell
  /** Explicitly selected APXS/mineral record, kept as saved. */
  readonly origin: WaypointOrigin | null
}

export interface MissionRecord {
  readonly format: typeof MISSION_FORMAT
  readonly version: typeof MISSION_VERSION
  /** Stable library id; a new one is assigned when a copy is imported. */
  readonly id: string
  readonly name: string
  /** ISO 8601, UTC. */
  readonly savedAt: string
  readonly regionId: string
  readonly terrain: MissionTerrainRef
  /** Science target collection in use when saved, for reference; null if none. */
  readonly scienceTargets: { readonly collectionId: string; readonly terrainManifestSha256: string } | null
  readonly waypoints: readonly MissionWaypoint[]
  readonly settings: MissionSettings
  readonly selectedTargetId: string | null
}

export interface MissionSnapshot {
  readonly name: string
  readonly regionId: string
  readonly terrain: TerrainPackage
  readonly scienceTargets: { readonly id: string; readonly terrainManifestSha256: string } | null
  readonly waypoints: readonly Waypoint[]
  readonly origins: Readonly<Record<string, WaypointOrigin>>
  readonly settings: MissionSettings
  readonly selectedTargetId: string | null
}

export const MAX_NAME_LENGTH = 80

export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH)
}

export function createMissionRecord(snapshot: MissionSnapshot, id: string, savedAt: Date): MissionRecord {
  const { manifest } = snapshot.terrain
  const name = normaliseName(snapshot.name)
  if (!name) throw new Error('A mission needs a name.')
  return {
    format: MISSION_FORMAT,
    version: MISSION_VERSION,
    id,
    name,
    savedAt: savedAt.toISOString(),
    regionId: snapshot.regionId,
    terrain: {
      id: manifest.id,
      title: manifest.title,
      synthetic: manifest.synthetic,
      productId: manifest.source?.productId ?? null,
      grid: {
        width: manifest.raster.width,
        height: manifest.raster.height,
        geoTransform: [...manifest.raster.geoTransform] as unknown as GeoTransform,
      },
    },
    scienceTargets: snapshot.scienceTargets
      ? { collectionId: snapshot.scienceTargets.id, terrainManifestSha256: snapshot.scienceTargets.terrainManifestSha256 }
      : null,
    waypoints: snapshot.waypoints.map((waypoint) => ({
      label: waypoint.label,
      cell: { row: waypoint.cell.row, col: waypoint.cell.col },
      origin: snapshot.origins[waypoint.id] ? structuredClone(snapshot.origins[waypoint.id]) : null,
    })),
    settings: { ...snapshot.settings },
    selectedTargetId: snapshot.selectedTargetId,
  }
}

/** The file could not be read as a mission; `issues` lists every problem found. */
export class MissionFormatError extends Error {
  readonly issues: readonly string[]

  constructor(issues: readonly string[]) {
    super(`Not a valid mission file: ${issues.join('; ')}`)
    this.name = 'MissionFormatError'
    this.issues = issues
  }
}

type UnknownRecord = Record<string, unknown>
const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0

function validateOrigin(value: unknown): boolean {
  if (!isRecord(value)) return false
  const position = value.position
  return (
    (value.kind === 'apxs-observation' || value.kind === 'mineral-finding') &&
    isText(value.recordId) &&
    isText(value.name) &&
    typeof value.mission === 'string' &&
    (value.measurementSol === null || isCount(value.measurementSol)) &&
    typeof value.description === 'string' &&
    isRecord(position) &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    position.basis === 'rover-position-proxy' &&
    position.uncertaintyMeters === null &&
    Array.isArray(value.sources) &&
    value.sources.every((source) => isRecord(source) && isText(source.url) && typeof source.attribution === 'string' && typeof source.provides === 'string') &&
    (value.sourceSha256 === null || (typeof value.sourceSha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sourceSha256))) &&
    Array.isArray(value.reviewFlags) &&
    value.reviewFlags.every((flag) => typeof flag === 'string')
  )
}

/** Validates untrusted JSON (an imported file or a stored library entry). */
export function parseMissionRecord(input: unknown): MissionRecord {
  if (!isRecord(input) || input.format !== MISSION_FORMAT) {
    throw new MissionFormatError(['this is not a Polaris Module mission file'])
  }
  if (input.version !== MISSION_VERSION) {
    throw new MissionFormatError([
      typeof input.version === 'number' && input.version > MISSION_VERSION
        ? `it was saved by a newer version of the planner (format version ${input.version})`
        : 'its format version is not supported',
    ])
  }
  const issues: string[] = []
  if (!isText(input.id)) issues.push('id is missing')
  if (typeof input.name !== 'string' || !normaliseName(input.name)) issues.push('name is missing')
  if (typeof input.savedAt !== 'string' || Number.isNaN(Date.parse(input.savedAt))) issues.push('savedAt is not a date')
  if (!isText(input.regionId)) issues.push('regionId is missing')

  const terrain = input.terrain
  if (!isRecord(terrain) || !isText(terrain.id) || !isText(terrain.title) || typeof terrain.synthetic !== 'boolean') {
    issues.push('terrain reference is incomplete')
  } else {
    if (terrain.synthetic ? terrain.productId !== null : !isText(terrain.productId)) issues.push('terrain.productId does not match the synthetic flag')
    const grid = terrain.grid
    if (
      !isRecord(grid) ||
      !Number.isInteger(grid.width) || (grid.width as number) <= 0 ||
      !Number.isInteger(grid.height) || (grid.height as number) <= 0 ||
      !Array.isArray(grid.geoTransform) || grid.geoTransform.length !== 6 ||
      !grid.geoTransform.every((value) => Number.isFinite(value))
    ) {
      issues.push('terrain.grid is invalid')
    }
  }

  const science = input.scienceTargets
  if (science !== null && (!isRecord(science) || !isText(science.collectionId) || typeof science.terrainManifestSha256 !== 'string')) {
    issues.push('scienceTargets is invalid')
  }

  if (!Array.isArray(input.waypoints)) {
    issues.push('waypoints must be a list')
  } else {
    input.waypoints.forEach((waypoint, index) => {
      if (
        !isRecord(waypoint) ||
        !isText(waypoint.label) ||
        !isRecord(waypoint.cell) ||
        !isCount(waypoint.cell.row) ||
        !isCount(waypoint.cell.col) ||
        (waypoint.origin !== null && !validateOrigin(waypoint.origin))
      ) {
        issues.push(`waypoint ${index + 1} is invalid`)
      }
    })
  }

  const settings = input.settings
  if (!isRecord(settings) || typeof settings.returnToStart !== 'boolean') {
    issues.push('settings are incomplete')
  } else {
    for (const [key, [min, max]] of Object.entries(SETTING_RANGES)) {
      const value = settings[key]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        issues.push(`settings.${key} must be between ${min} and ${max}`)
      }
    }
  }
  if (input.selectedTargetId !== null && !isText(input.selectedTargetId)) issues.push('selectedTargetId is invalid')

  if (issues.length > 0) throw new MissionFormatError(issues)
  return { ...(input as unknown as MissionRecord), name: normaliseName(input.name as string) }
}

export type Compatibility =
  | {
      readonly ok: true
      readonly waypoints: Waypoint[]
      readonly origins: Record<string, WaypointOrigin>
      readonly warnings: string[]
    }
  | { readonly ok: false; readonly reasons: string[] }

const sameTransform = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i])

/**
 * Checks a saved mission against the terrain it would open on. Waypoints are
 * cells of one exact grid: any change of package, product or grid makes them
 * meaningless, so the mission is refused rather than silently moved.
 */
export function checkCompatibility(
  record: MissionRecord,
  terrain: TerrainPackage,
  currentScienceTargets: { readonly id: string } | null,
): Compatibility {
  const { manifest } = terrain
  const saved = record.terrain
  const reasons: string[] = []
  if (manifest.id !== saved.id) {
    reasons.push(`It was planned on "${saved.title}" (${saved.id}), but this region now provides "${manifest.title}" (${manifest.id}).`)
  } else {
    if (manifest.synthetic !== saved.synthetic || (manifest.source?.productId ?? null) !== saved.productId) {
      reasons.push(`The terrain source changed (saved: ${saved.productId ?? 'synthetic'}; now: ${manifest.source?.productId ?? 'synthetic'}).`)
    }
    const { width, height, geoTransform } = manifest.raster
    if (width !== saved.grid.width || height !== saved.grid.height || !sameTransform(geoTransform, saved.grid.geoTransform)) {
      reasons.push('The terrain grid changed since the mission was saved, so its waypoint cells no longer mark the same places.')
    }
  }
  if (reasons.length === 0) {
    const uncovered = record.waypoints.filter((waypoint) => !isCellCovered(terrain, waypoint.cell))
    if (uncovered.length > 0) {
      reasons.push(`Waypoints without terrain data: ${uncovered.map((waypoint) => waypoint.label).join(', ')}.`)
    }
  }
  if (reasons.length > 0) return { ok: false, reasons }

  const warnings: string[] = []
  const savedTargets = record.scienceTargets?.collectionId ?? null
  const currentTargets = currentScienceTargets?.id ?? null
  if (savedTargets !== currentTargets) {
    warnings.push(
      savedTargets === null
        ? 'Science targets have been added since this mission was saved.'
        : currentTargets === null
          ? `It was saved with science targets "${savedTargets}", which are not loaded now. Waypoint names are as saved.`
          : `It was saved with science targets "${savedTargets}"; "${currentTargets}" is loaded now. Waypoint names are as saved.`,
    )
  }
  const origins: Record<string, WaypointOrigin> = {}
  const waypoints = record.waypoints.map((waypoint, index) => {
    const id = `wp-${index + 1}`
    if (waypoint.origin) origins[id] = structuredClone(waypoint.origin)
    return { id, label: waypoint.label, cell: { row: waypoint.cell.row, col: waypoint.cell.col } }
  })
  return { ok: true, waypoints, origins, warnings }
}

/** e.g. polaris-mission-ridge-traverse-20261115-1805Z.json (UTC). */
export function missionFileName(record: MissionRecord): string {
  const slug = record.name.toLowerCase().normalize('NFKD').replace(/\p{M}+/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'mission'
  const stamp = record.savedAt.replace(/[-:]/g, '').replace(/^(\d{8})T(\d{4}).*$/, '$1-$2Z')
  return `polaris-mission-${slug}-${stamp}.json`
}
