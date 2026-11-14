import {
  parseScienceTargets,
  type ScienceTargetCollection,
} from '../../datasets/scienceTargets'

/**
 * SYNTHETIC DEVELOPMENT FIXTURE — NOT NASA DATA.
 * Made-up targets on the synthetic development terrain (1 x 1 km, metres from
 * its south-west corner), used to build the science target UI until Developer B
 * delivers the real collection. Covers every display case: a proxy position, a
 * target location with and without a stated uncertainty, a point in the
 * terrain's no-data patch, and a point outside the terrain.
 */
export function createSyntheticTargets(): ScienceTargetCollection {
  const target = (
    id: string,
    name: string,
    kind: string,
    x: number,
    y: number,
    basis: string,
    uncertaintyMeters: number | null,
    description: string,
  ) => ({
    id,
    name,
    kind,
    position: { x, y, uncertaintyMeters, basis },
    mission: null,
    activitySol: null,
    positionSol: null,
    description,
    sources: [],
  })

  return parseScienceTargets({
    contractVersion: 1,
    id: 'synthetic-dev-targets',
    terrainPackageId: 'synthetic-dev-terrain',
    // The synthetic terrain has no manifest file to hash; placeholder only.
    terrainManifestSha256: '0'.repeat(64),
    synthetic: true,
    targets: [
      target(
        'syn-drill',
        'Synthetic drill site A',
        'drill-site',
        310,
        620,
        'rover-position-proxy',
        null,
        'Made-up drill activity. The point is a rover-position proxy, not a hole location.',
      ),
      target(
        'syn-outcrop',
        'Synthetic outcrop B',
        'observation-site',
        640,
        410,
        'target-location',
        8,
        'Made-up outcrop with a made-up 8 m uncertainty.',
      ),
      target(
        'syn-ridge',
        'Synthetic ridge C',
        'landmark',
        820,
        820,
        'target-location',
        null,
        'Made-up landmark with no stated uncertainty.',
      ),
      target(
        'syn-gap',
        'Synthetic point in the data gap',
        'traverse-point',
        202.5,
        247.5,
        'target-location',
        null,
        'Made-up point on cells without elevation data.',
      ),
      target(
        'syn-outside',
        'Synthetic point beyond the edge',
        'landmark',
        1150,
        500,
        'target-location',
        null,
        'Made-up point east of the terrain.',
      ),
    ],
  })
}
