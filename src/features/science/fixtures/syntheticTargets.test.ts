import { describe, expect, it } from 'vitest'
import { splitByCoverage } from '../../datasets/scienceTargets'
import { createSyntheticTerrain } from '../../map/fixtures/syntheticTerrain'
import { createSyntheticTargets } from './syntheticTargets'

describe('synthetic science targets', () => {
  const targets = createSyntheticTargets()

  it('is marked synthetic and carries no sources', () => {
    expect(targets.synthetic).toBe(true)
    expect(targets.targets.every((target) => target.sources.length === 0)).toBe(true)
  })

  it('exercises every coverage case on the synthetic terrain', () => {
    const { inside, outside } = splitByCoverage(targets, createSyntheticTerrain())
    expect(inside.map((placed) => placed.target.id)).toEqual(['syn-drill', 'syn-outcrop', 'syn-ridge'])
    expect(outside.map(({ target, reason }) => [target.id, reason])).toEqual([
      ['syn-gap', 'noData'],
      ['syn-outside', 'outsideTerrain'],
    ])
  })
})
