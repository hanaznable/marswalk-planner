/**
 * Science target contract (version 1). Agreed with Developer B; see
 * docs/science-target-contract.md.
 *
 * Targets are tied to one terrain package and positioned in that package's
 * source CRS (metres), so they share its georeferencing and its limits.
 * Pure TypeScript: no React, Leaflet, or renderer imports.
 */
import { mapToCell, type RasterCell } from './terrainContract'
import { isCellCovered, type TerrainPackage } from './terrainPackage'

export const SCIENCE_TARGET_CONTRACT_VERSION = 1

export const SCIENCE_TARGET_KINDS = [
  'drill-site',
  'observation-site',
  'landing-site',
  'traverse-point',
  'landmark',
] as const
export type ScienceTargetKind = (typeof SCIENCE_TARGET_KINDS)[number]

/**
 * What the position actually marks. A rover-position proxy is where the rover
 * was recorded around the activity, never the exact target (e.g. a drill hole).
 */
export const POSITION_BASES = ['rover-position-proxy', 'target-location'] as const
export type PositionBasis = (typeof POSITION_BASES)[number]

export interface TargetSource {
  readonly url: string
  readonly attribution: string
  /** What this source supports, e.g. "rover position" or "target association". */
  readonly provides: string
}

export interface ScienceTarget {
  /** Unique within the collection. */
  readonly id: string
  readonly name: string
  readonly kind: ScienceTargetKind
  /** Source CRS metres, same frame as the terrain manifest's geoTransform. */
  readonly position: {
    readonly x: number
    readonly y: number
    /** Horizontal uncertainty stated by the source; null when it states none. */
    readonly uncertaintyMeters: number | null
    readonly basis: PositionBasis
  }
  /** e.g. "MSL Curiosity"; null when not mission-specific. */
  readonly mission: string | null
  /** Sol of the scientific activity; null when unknown or not applicable. */
  readonly activitySol: number | null
  /** Sol of the position record used for `position`; may differ from the activity sol. */
  readonly positionSol: number | null
  /** What the sources say. Never inferred. */
  readonly description: string
  /** At least one for real data; empty for synthetic fixtures. */
  readonly sources: readonly TargetSource[]
}

export interface ScienceTargetCollection {
  readonly contractVersion: typeof SCIENCE_TARGET_CONTRACT_VERSION
  readonly id: string
  /** Terrain package whose CRS the positions use. */
  readonly terrainPackageId: string
  /** SHA-256 of that package's manifest.json, recording the exact terrain version. */
  readonly terrainManifestSha256: string
  /** True for development fixtures; never shown as NASA data. */
  readonly synthetic: boolean
  readonly targets: readonly ScienceTarget[]
}

export class ScienceTargetContractError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(`Invalid science targets: ${issues.join('; ')}`)
    this.name = 'ScienceTargetContractError'
    this.issues = issues
  }
}

type UnknownRecord = Record<string, unknown>
const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const isSolOrNull = (value: unknown) =>
  value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0)

/** Validates untrusted JSON. Throws ScienceTargetContractError listing every problem. */
export function parseScienceTargets(input: unknown): ScienceTargetCollection {
  if (!isRecord(input)) {
    throw new ScienceTargetContractError(['science target collection must be an object'])
  }
  const issues: string[] = []
  if (input.contractVersion !== SCIENCE_TARGET_CONTRACT_VERSION) {
    issues.push(`contractVersion must be ${SCIENCE_TARGET_CONTRACT_VERSION}`)
  }
  if (!isNonEmptyString(input.id)) issues.push('id must be a non-empty string')
  if (!isNonEmptyString(input.terrainPackageId)) {
    issues.push('terrainPackageId must be a non-empty string')
  }
  if (typeof input.terrainManifestSha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(input.terrainManifestSha256)) {
    issues.push('terrainManifestSha256 must be 64 hexadecimal characters')
  }
  const synthetic = input.synthetic
  if (typeof synthetic !== 'boolean') issues.push('synthetic must be a boolean')

  if (!Array.isArray(input.targets)) {
    issues.push('targets must be an array')
  } else {
    const seen = new Set<string>()
    input.targets.forEach((target, index) => {
      validateTarget(target, `targets[${index}]`, synthetic === true, issues)
      if (isRecord(target) && isNonEmptyString(target.id)) {
        if (seen.has(target.id)) issues.push(`target id "${target.id}" is used more than once`)
        seen.add(target.id)
      }
    })
  }

  if (issues.length > 0) throw new ScienceTargetContractError(issues)
  return input as unknown as ScienceTargetCollection
}

function validateTarget(target: unknown, at: string, synthetic: boolean, issues: string[]): void {
  if (!isRecord(target)) {
    issues.push(`${at} must be an object`)
    return
  }
  if (!isNonEmptyString(target.id)) issues.push(`${at}.id must be a non-empty string`)
  if (!isNonEmptyString(target.name)) issues.push(`${at}.name must be a non-empty string`)
  if (!SCIENCE_TARGET_KINDS.includes(target.kind as ScienceTargetKind)) {
    issues.push(`${at}.kind must be one of ${SCIENCE_TARGET_KINDS.join(', ')}`)
  }

  const position = target.position
  if (!isRecord(position) || !isFiniteNumber(position.x) || !isFiniteNumber(position.y)) {
    issues.push(`${at}.position.x and .y must be finite numbers`)
  }
  if (isRecord(position)) {
    const uncertainty = position.uncertaintyMeters
    if (uncertainty !== null && !(isFiniteNumber(uncertainty) && uncertainty >= 0)) {
      issues.push(`${at}.position.uncertaintyMeters must be null or a non-negative number`)
    }
    if (!POSITION_BASES.includes(position.basis as PositionBasis)) {
      issues.push(`${at}.position.basis must be one of ${POSITION_BASES.join(', ')}`)
    }
  }

  if (target.mission !== null && !isNonEmptyString(target.mission)) {
    issues.push(`${at}.mission must be null or a non-empty string`)
  }
  if (!isSolOrNull(target.activitySol)) {
    issues.push(`${at}.activitySol must be null or a non-negative integer`)
  }
  if (!isSolOrNull(target.positionSol)) {
    issues.push(`${at}.positionSol must be null or a non-negative integer`)
  }
  if (!isNonEmptyString(target.description)) {
    issues.push(`${at}.description must be a non-empty string`)
  }

  const sources = target.sources
  if (!Array.isArray(sources)) {
    issues.push(`${at}.sources must be an array`)
  } else if (synthetic) {
    if (sources.length > 0) issues.push(`${at}.sources must be empty when synthetic is true`)
  } else if (sources.length === 0) {
    issues.push(`${at}.sources must list at least one source when synthetic is false`)
  } else {
    sources.forEach((source, index) => {
      const where = `${at}.sources[${index}]`
      if (!isRecord(source)) {
        issues.push(`${where} must be an object`)
        return
      }
      for (const key of ['url', 'attribution', 'provides']) {
        if (!isNonEmptyString(source[key])) issues.push(`${where}.${key} must be a non-empty string`)
      }
    })
  }
}

/** Plain-language position caveat for the UI; a proxy never reads as exact. */
export function describePosition(target: ScienceTarget): string {
  const { basis, uncertaintyMeters } = target.position
  if (basis === 'rover-position-proxy') {
    return 'Rover position associated with this target (proxy), not the exact location'
  }
  return uncertaintyMeters === null
    ? 'Target location; uncertainty not stated by the source'
    : `Target location; ±${uncertaintyMeters} m per the source`
}

export interface PlacedTarget {
  readonly target: ScienceTarget
  readonly cell: RasterCell
}

export interface UnplacedTarget {
  readonly target: ScienceTarget
  readonly reason: 'outsideTerrain' | 'noData'
}

/**
 * Splits targets into those on covered cells of the terrain and those that are
 * not. Targets outside coverage must never be shown as part of the region.
 */
export function splitByCoverage(
  collection: ScienceTargetCollection,
  terrain: TerrainPackage,
): { inside: PlacedTarget[]; outside: UnplacedTarget[] } {
  if (collection.terrainPackageId !== terrain.manifest.id) {
    throw new ScienceTargetContractError([
      `targets are for terrain package "${collection.terrainPackageId}", not "${terrain.manifest.id}"`,
    ])
  }
  const inside: PlacedTarget[] = []
  const outside: UnplacedTarget[] = []
  for (const target of collection.targets) {
    const cell = mapToCell(terrain.manifest.raster, target.position)
    if (cell === null) outside.push({ target, reason: 'outsideTerrain' })
    else if (!isCellCovered(terrain, cell)) outside.push({ target, reason: 'noData' })
    else inside.push({ target, cell })
  }
  return { inside, outside }
}
