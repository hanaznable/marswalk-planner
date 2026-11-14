import {
  parseScienceTargets,
  ScienceTargetContractError,
  type ScienceTargetCollection,
} from './scienceTargets'

/** A science target collection failed to download or breaks contract v1. */
export class ScienceTargetLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScienceTargetLoadError'
  }
}

export interface LoadScienceTargetsOptions {
  fetchImpl?: typeof fetch
  /** Base for resolving a relative URL; defaults to the current page. */
  baseUrl?: string
  signal?: AbortSignal
}

/** Downloads and validates a contract-v1 science target collection. */
export async function loadScienceTargets(
  url: string,
  { fetchImpl = fetch, baseUrl = globalThis.location?.href, signal }: LoadScienceTargetsOptions = {},
): Promise<ScienceTargetCollection> {
  const href = new URL(url, baseUrl)
  let response: Response
  try {
    response = await fetchImpl(href.href, { signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ScienceTargetLoadError(`Could not download the science targets (${href.pathname}): ${String(error)}`)
  }
  if (!response.ok) {
    throw new ScienceTargetLoadError(
      `Could not download the science targets (${href.pathname}): HTTP ${response.status} ${response.statusText}`.trim(),
    )
  }
  let json: unknown
  try {
    json = await response.json()
  } catch {
    throw new ScienceTargetLoadError(`The science targets at ${href.pathname} are not valid JSON.`)
  }
  try {
    return parseScienceTargets(json)
  } catch (error) {
    if (error instanceof ScienceTargetContractError) {
      throw new ScienceTargetLoadError(`The science targets break contract v1: ${error.issues.join('; ')}`)
    }
    throw error
  }
}
