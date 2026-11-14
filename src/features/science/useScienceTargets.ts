import { useEffect, useMemo, useState } from 'react'
import { loadScienceTargets } from '../datasets/loadScienceTargets'
import {
  splitByCoverage,
  type PlacedTarget,
  type ScienceTargetCollection,
  type UnplacedTarget,
} from '../datasets/scienceTargets'
import type { TerrainPackage } from '../datasets/terrainPackage'
import type { DatasetMetadata } from '../datasets/types'
import { createSyntheticTargets } from './fixtures/syntheticTargets'

export type ScienceTargetsState =
  /** No collection exists for the loaded terrain (or no terrain is loaded). */
  | { readonly status: 'none' }
  | { readonly status: 'loading' }
  | {
      readonly status: 'error'
      readonly message: string
      /** Null when downloading again cannot help (e.g. wrong terrain package). */
      readonly retry: (() => void) | null
    }
  | {
      readonly status: 'ready'
      readonly collection: ScienceTargetCollection
      /** On covered cells: shown on the map and usable as waypoints. */
      readonly inside: readonly PlacedTarget[]
      /** Never shown as part of the region; listed separately. */
      readonly outside: readonly UnplacedTarget[]
    }

type Loaded =
  | { status: 'ready'; collection: ScienceTargetCollection }
  | { status: 'error'; message: string }

function place(collection: ScienceTargetCollection, terrain: TerrainPackage): ScienceTargetsState {
  try {
    return { status: 'ready', collection, ...splitByCoverage(collection, terrain) }
  } catch (error) {
    // e.g. the collection was prepared for another terrain package.
    const message = error instanceof Error ? error.message : String(error)
    return { status: 'error', message, retry: null }
  }
}

/**
 * Science targets for the loaded terrain. Synthetic terrain gets the synthetic
 * fixture; a real package loads its registered collection, if it has one.
 * Real terrain never shows synthetic targets.
 */
export function useScienceTargets(
  terrain: TerrainPackage | null,
  dataset: DatasetMetadata | null,
): ScienceTargetsState {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; value: Loaded } | null>(null)
  const synthetic = terrain?.manifest.synthetic === true
  const url = !synthetic && terrain && dataset ? dataset.scienceTargetsUrl : null
  const key = url ? `${url}#${attempt}` : null

  useEffect(() => {
    if (!url || !key) return
    const controller = new AbortController()
    loadScienceTargets(`${import.meta.env.BASE_URL}${url}`, { signal: controller.signal })
      .then((collection) => setResult({ key, value: { status: 'ready', collection } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        setResult({ key, value: { status: 'error', message } })
      })
    return () => controller.abort()
  }, [url, key])

  const syntheticState = useMemo(
    () => (terrain && synthetic ? place(createSyntheticTargets(), terrain) : null),
    [terrain, synthetic],
  )
  const loadedState = useMemo((): ScienceTargetsState | null => {
    if (!terrain || !result || result.key !== key) return null
    if (result.value.status === 'error') {
      return {
        status: 'error',
        message: result.value.message,
        retry: () => setAttempt((count) => count + 1),
      }
    }
    return place(result.value.collection, terrain)
  }, [terrain, result, key])

  if (syntheticState) return syntheticState
  if (!url) return { status: 'none' }
  return loadedState ?? { status: 'loading' }
}
