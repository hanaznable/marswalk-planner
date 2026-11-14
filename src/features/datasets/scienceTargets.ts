/**
 * Science target contract (version 1) — PROPOSAL for review with Developer B.
 * See docs/science-target-contract.md.
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

export interface ScienceTarget {
  /** Unique within the collection. */
  readonly id: string
  readonly name: string
  readonly kind: ScienceTargetKind
  /** Source CRS metres, same frame as the terrain manifest's geoTransform. */
  readonly position: {
    readonly x: number
    readonly y: number
    /** Known horizontal uncertainty in metres; null when the source gives none. */
    readonly uncertaintyMeters: number | null
  }
  /** e.g. "MSL Curiosity"; null when not mission-specific. */
  readonly mission: string | null
  /** Mission sol of the observation; null when not applicable or unknown. */
  readonly sol: number | null
  /** What was observed or done, as stated by the source. Never inferred. */
  readonly description: string
  /** Required for real targets, null for synthetic fixtures. */
  readonly source: { readonly url: string; readonly attribution: string } | null
}

export interface ScienceTargetCollection {
  readonly contractVersion: typeof SCIENCE_TARGET_CONTRACT_VERSION
  readonly id: string
  /** Terrain package whose CRS the positions use. */
  readonly terrainPackageId: string
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
  }

  if (target.mission !== null && !isNonEmptyString(target.mission)) {
    issues.push(`${at}.mission must be null or a non-empty string`)
  }
  const sol = target.sol
  if (sol !== null && !(typeof sol === 'number' && Number.isInteger(sol) && sol >= 0)) {
    issues.push(`${at}.sol must be null or a non-negative integer`)
  }
  if (!isNonEmptyString(target.description)) {
    issues.push(`${at}.description must be a non-empty string`)
  }

  const source = target.source
  if (synthetic) {
    if (source !== null) issues.push(`${at}.source must be null when synthetic is true`)
  } else if (!isRecord(source)) {
    issues.push(`${at}.source is required when synthetic is false`)
  } else {
    if (!isNonEmptyString(source.url)) issues.push(`${at}.source.url must be a non-empty string`)
    if (!isNonEmptyString(source.attribution)) {
      issues.push(`${at}.source.attribution must be a non-empty string`)
    }
  }
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
