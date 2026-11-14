import { useEffect, useState } from 'react'
import type { TerrainPackage } from '../datasets/terrainPackage'
import type { DatasetMetadata } from '../datasets/types'
import { loadSurfaceImage, surfaceImageryRegistry, type SurfaceImageManifest } from './surfaceImagery'

type ImageState = { status: 'none' | 'loading' } | { status: 'error'; message: string }
  | { status: 'ready'; manifest: SurfaceImageManifest; url: string }

export function useSurfaceImagery(terrain: TerrainPackage | null, dataset: DatasetMetadata | null) {
  const [mode, setMode] = useState<'grayscale' | 'rgb'>('grayscale')
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ terrain: TerrainPackage; attempt: number; state: ImageState } | null>(null)
  const url = terrain && !terrain.manifest.synthetic ? surfaceImageryRegistry[terrain.manifest.id] : undefined
  const terrainUrl = dataset?.processedAssetUrl
  useEffect(() => {
    if (!terrain || !url || !terrainUrl) return
    const controller = new AbortController()
    let objectUrl: string | null = null
    loadSurfaceImage(import.meta.env.BASE_URL + url, import.meta.env.BASE_URL + terrainUrl, terrain, controller.signal)
      .then(({ manifest, bytes }) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }))
        setResult({ terrain, attempt, state: { status: 'ready', manifest, url: objectUrl } })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ terrain, attempt, state: { status: 'error', message: error instanceof Error ? error.message : String(error) } })
      })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [terrain, url, terrainUrl, attempt])
  const state: ImageState = !url || !terrainUrl ? { status: 'none' }
    : result?.terrain === terrain && result.attempt === attempt ? result.state : { status: 'loading' }
  return { mode, setMode, state, retry: () => setAttempt((value) => value + 1) }
}
export type SurfaceImageryController = ReturnType<typeof useSurfaceImagery>
