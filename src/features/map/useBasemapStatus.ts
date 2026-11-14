import { useCallback, useState } from 'react'

export type BasemapStatus = 'none' | 'loading' | 'ready' | 'error'
export function useBasemapStatus(url: string | null) {
  const [result, setResult] = useState<{ url: string | null; status: BasemapStatus } | null>(null)
  const report = useCallback((status: BasemapStatus) => setResult({ url, status }), [url])
  const status: BasemapStatus = !url ? 'none' : result?.url === url ? result.status : 'loading'
  return { url, status, report }
}
export type BasemapController = ReturnType<typeof useBasemapStatus>
