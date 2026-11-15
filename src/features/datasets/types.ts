/**
 * A workspace region. `terrain` says what the map can load for it; a region
 * without a terrain package shows an explicit empty state and never borrows
 * another region's terrain or labels.
 */
export interface MarsRegion {
  id: string
  name: string
  terrain:
    | { kind: 'package'; datasetId: DatasetMetadata['id'] }
    | { kind: 'synthetic' }
    | null
}

/** Future adapters must preserve source provenance and the native Mars CRS. */
export interface DatasetMetadata {
  id: string
  title: string
  regionId: MarsRegion['id']
  sourceUrl: string
  attribution: string
  coordinateReferenceSystem: string
  /** Manifest path, relative to the app's base URL. */
  processedAssetUrl: string
  /** Prototype limitations to show wherever the data is used. */
  limitations: readonly string[]
  /** Concise methods for the source panel; full qualifications remain above. */
  dataSourceNotes?: readonly string[]
  /**
   * Science target collection for this package (contract v1), relative to the
   * app's base URL; null until one is delivered.
   */
  scienceTargetsUrl: string | null
}
