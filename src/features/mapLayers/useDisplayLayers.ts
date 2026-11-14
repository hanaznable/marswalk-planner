import { useEffect, useState } from 'react'
import type { DatasetMetadata } from '../datasets/types'
import type { TerrainPackage } from '../datasets/terrainPackage'
import { contextRegistry, loadMapContext, type MapContext } from './context'

export type RasterDisplay = 'elevation' | 'slope'
export type ContextDisplay = 'apxs' | 'traverse' | 'minerals'
export interface DisplaySettings {
  raster: RasterDisplay | null
  opacity: number
  apxs: boolean
  traverse: boolean
  minerals: boolean
}
export type ContextState = { status: 'none' | 'loading' } | { status: 'error'; message: string } | { status: 'ready'; context: MapContext }

export function useDisplayLayers(terrain: TerrainPackage | null, dataset: DatasetMetadata | null) {
  const [settings, setSettings] = useState<DisplaySettings>({ raster: null, opacity: 0.7, apxs: false, traverse: false, minerals: false })
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ terrain: TerrainPackage; attempt: number; state: ContextState } | null>(null)
  const contextUrl = terrain && !terrain.manifest.synthetic ? contextRegistry[terrain.manifest.id] : undefined
  const manifestUrl = dataset?.processedAssetUrl
  useEffect(() => {
    if (!terrain || !contextUrl || !manifestUrl) return
    const controller = new AbortController()
    const base = import.meta.env.BASE_URL
    loadMapContext(base + contextUrl, base + manifestUrl, terrain, controller.signal)
      .then((context) => setResult({ terrain, attempt, state: { status: 'ready', context } }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ terrain, attempt, state: { status: 'error', message: error instanceof Error ? error.message : String(error) } })
      })
    return () => controller.abort()
  }, [terrain, contextUrl, manifestUrl, attempt])
  const state: ContextState = !contextUrl || !manifestUrl ? { status: 'none' }
    : result?.terrain === terrain && result.attempt === attempt ? result.state : { status: 'loading' }
  return {
    settings, state,
    setRaster: (raster: RasterDisplay | null) => setSettings((previous) => ({ ...previous, raster })),
    setOpacity: (opacity: number) => setSettings((previous) => ({ ...previous, opacity })),
    toggleContext: (kind: ContextDisplay) => setSettings((previous) => ({ ...previous, [kind]: !previous[kind] })),
    retry: () => setAttempt((previous) => previous + 1),
  }
}
export type DisplayLayersController = ReturnType<typeof useDisplayLayers>
