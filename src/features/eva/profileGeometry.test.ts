import { describe, expect, it } from 'vitest'
import { niceTicks, pointAtDistance } from './profileGeometry'

const profile = [
  { distanceMeters: 0, elevationMeters: 10 },
  { distanceMeters: 10, elevationMeters: 14 },
  { distanceMeters: 20, elevationMeters: 12 },
]

describe('pointAtDistance', () => {
  it('returns the nearest profile point to a distance', () => {
    expect(pointAtDistance(profile, 6)).toEqual(profile[1])
    expect(pointAtDistance(profile, 4)).toEqual(profile[0])
  })

  it('clamps beyond either end', () => {
    expect(pointAtDistance(profile, -5)).toEqual(profile[0])
    expect(pointAtDistance(profile, 99)).toEqual(profile[2])
  })

  it('returns null for an empty profile', () => {
    expect(pointAtDistance([], 3)).toBeNull()
  })
})

describe('niceTicks', () => {
  it('picks round steps covering the range', () => {
    expect(niceTicks(0, 1280, 4)).toEqual([0, 500, 1000])
    expect(niceTicks(-31, 47, 4)).toEqual([-20, 0, 20, 40])
  })

  it('handles a flat range', () => {
    expect(niceTicks(5, 5, 4)).toEqual([5])
  })
})
