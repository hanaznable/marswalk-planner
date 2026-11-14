import { useEffect, useMemo, useState } from 'react'
import { loadTerrainPackage } from '../datasets/loadTerrainPackage'
import { findDataset } from '../datasets/registry'
import type { TerrainPackage } from '../datasets/terrainPackage'
import type { DatasetMetadata, MarsRegion } from '../datasets/types'
import { createSyntheticTerrain } from './fixtures/syntheticTerrain'

export type TerrainState =
  | { readonly status: 'none' }
  | { readonly status: 'loading'; readonly dataset: DatasetMetadata }
  | {
      readonly status: 'error'
      readonly dataset: DatasetMetadata
      readonly message: string
      readonly retry: () => void
    }
  | {
      readonly status: 'ready'
      readonly terrain: TerrainPackage
      /** Real orthoimage URL; null for synthetic terrain (shown as elevation shading). */
      readonly basemapUrl: string | null
      /** Registry entry for real packages; null for the synthetic fixture. */
      readonly dataset: DatasetMetadata | null
    }

type LoadResult =
  | { status: 'ready'; terrain: TerrainPackage; basemapUrl: string | null }
  | { status: 'error'; message: string }

/**
 * Terrain for the selected region. Real packages load over HTTP with explicit
 * loading and error states; synthetic terrain is only used when the region
 * explicitly asks for it, never as a fallback.
 */
export function useTerrainSource(region: MarsRegion): TerrainState {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; value: LoadResult } | null>(null)
  const synthetic = useMemo(() => createSyntheticTerrain(), [])

  const dataset =
    region.terrain?.kind === 'package' ? (findDataset(region.terrain.datasetId) ?? null) : null
  const key = dataset ? `${dataset.id}#${attempt}` : null

  useEffect(() => {
    if (!dataset || !key) return
    const controller = new AbortController()
    const manifestUrl = `${import.meta.env.BASE_URL}${dataset.processedAssetUrl}`
    loadTerrainPackage(manifestUrl, { signal: controller.signal })
      .then((loaded) => setResult({ key, value: { status: 'ready', ...loaded } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        setResult({ key, value: { status: 'error', message } })
      })
    return () => controller.abort()
  }, [dataset, key])

  if (region.terrain?.kind === 'synthetic') {
    return { status: 'ready', terrain: synthetic, basemapUrl: null, dataset: null }
  }
  if (!dataset) return { status: 'none' }
  if (!result || result.key !== key) return { status: 'loading', dataset }
  if (result.value.status === 'error') {
    return {
      status: 'error',
      dataset,
      message: result.value.message,
      retry: () => setAttempt((count) => count + 1),
    }
  }
  return { ...result.value, dataset }
}
