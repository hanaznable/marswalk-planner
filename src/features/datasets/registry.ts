import type { DatasetMetadata } from './types'

/**
 * Integrated, attributed terrain packages. Limitations summarise the package's
 * provenance.json and docs/terrain/georeferencing-review.md (Developer B).
 */
export const datasetRegistry: readonly DatasetMetadata[] = [
  {
    id: 'pahrump-hills-v1',
    title: 'Pahrump Hills, Gale Crater',
    regionId: 'gale-pahrump-hills',
    sourceUrl: 'https://www.uahirise.org/dtm/dtm.php?ID=ESP_040770_1755',
    attribution: 'NASA/JPL-Caltech/UArizona',
    coordinateReferenceSystem: 'EQUIRECTANGULAR MARS',
    processedAssetUrl: 'data/gale/pahrump-hills-v1/manifest.json',
    limitations: [
      'Prototype package: absolute geolocation and image/DEM registration accuracy are unverified.',
      'The origin follows a documented working convention chosen for consistency, not proven accuracy.',
      'Slope is the maximum native-resolution slope within each 5 m cell, so it can block cells that are partly passable.',
      'No validated hazard, thermal, mineral or astronaut safety model; routes are not traversal certifications.',
      'Curiosity traverse and science targets are not included in this package.',
    ],
  },
]

export function findDataset(id: string): DatasetMetadata | undefined {
  return datasetRegistry.find((dataset) => dataset.id === id)
}
