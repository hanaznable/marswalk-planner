import { describe, expect, it } from 'vitest'
import { loadScienceTargets, ScienceTargetLoadError } from './loadScienceTargets'

const BASE = 'https://planner.test/app/'

// Synthetic fixture: made-up values, not NASA data.
const collection = {
  contractVersion: 1,
  id: 'test-targets',
  terrainPackageId: 'test-terrain',
  terrainManifestSha256: 'b'.repeat(64),
  synthetic: true,
  targets: [
    {
      id: 't1',
      name: 'Test point',
      kind: 'landmark',
      position: { x: 1, y: 2, uncertaintyMeters: null, basis: 'target-location' },
      mission: null,
      activitySol: null,
      positionSol: null,
      description: 'Made-up point for tests.',
      sources: [],
    },
  ],
}

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: string[] = []
  const fetchImpl = (async (input: RequestInfo | URL) => {
    calls.push(String(input))
    return respond()
  }) as typeof fetch
  return { fetchImpl, calls }
}

async function failure(promise: Promise<unknown>): Promise<ScienceTargetLoadError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ScienceTargetLoadError) return error
    throw error
  }
  throw new Error('expected the load to fail')
}

describe('loadScienceTargets', () => {
  it('resolves the URL against the base and returns the validated collection', async () => {
    const { fetchImpl, calls } = fakeFetch(() => Response.json(collection))
    const loaded = await loadScienceTargets('data/science/x/targets.json', { fetchImpl, baseUrl: BASE })
    expect(calls).toEqual(['https://planner.test/app/data/science/x/targets.json'])
    expect(loaded.targets.map((target) => target.id)).toEqual(['t1'])
  })

  it('reports a missing file with its path and status', async () => {
    const { fetchImpl } = fakeFetch(() => new Response('', { status: 404, statusText: 'Not Found' }))
    const error = await failure(loadScienceTargets('targets.json', { fetchImpl, baseUrl: BASE }))
    expect(error.message).toContain('/app/targets.json')
    expect(error.message).toContain('HTTP 404')
  })

  it('reports invalid JSON', async () => {
    const { fetchImpl } = fakeFetch(() => new Response('{ nope'))
    const error = await failure(loadScienceTargets('targets.json', { fetchImpl, baseUrl: BASE }))
    expect(error.message).toContain('not valid JSON')
  })

  it('lists every contract problem', async () => {
    const { fetchImpl } = fakeFetch(() => Response.json({ ...collection, contractVersion: 2, id: '' }))
    const error = await failure(loadScienceTargets('targets.json', { fetchImpl, baseUrl: BASE }))
    expect(error.message).toContain('contractVersion must be 1')
    expect(error.message).toContain('id must be a non-empty string')
  })

  it('reports a network failure', async () => {
    const { fetchImpl } = fakeFetch(() => Promise.reject(new TypeError('offline')))
    const error = await failure(loadScienceTargets('targets.json', { fetchImpl, baseUrl: BASE }))
    expect(error.message).toContain('offline')
  })

  it('rethrows an abort unchanged', async () => {
    const controller = new AbortController()
    controller.abort()
    const abort = new DOMException('aborted', 'AbortError')
    const { fetchImpl } = fakeFetch(() => Promise.reject(abort))
    await expect(
      loadScienceTargets('targets.json', { fetchImpl, baseUrl: BASE, signal: controller.signal }),
    ).rejects.toBe(abort)
  })
})
