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
    dataSourceNotes: [
      'Absolute geolocation and image/DEM alignment are unverified.',
      'Coordinates use the documented prototype origin convention.',
      'Slope represents the maximum native-resolution slope within each 5 m cell.',
    ],
    limitations: [
      'Prototype package: absolute geolocation and image/DEM registration accuracy are unverified.',
      'The origin follows a documented working convention chosen for consistency, not proven accuracy.',
      'Slope is the maximum native-resolution slope within each 5 m cell, so it can block cells that are partly passable.',
      'No validated hazard map, thermal layer or astronaut safety model. The published point mineral finding is not a continuous mineral map; routes are not traversal certifications.',
      'Drill markers use associated rover positions, not exact drill-hole coordinates; positional uncertainty is unknown.',
      'Curiosity traverse is a separately loaded historical context layer, spatially clipped to this terrain. It is not a time-filtered campaign trace or a suggested EVA route.',
    ],
    scienceTargetsUrl: 'data/science/pahrump-hills-v1/targets.json',
  },
]

export function findDataset(id: string): DatasetMetadata | undefined {
  return datasetRegistry.find((dataset) => dataset.id === id)
}
