/** A region selection is metadata only; it does not imply loaded map coverage. */
export interface MarsRegion {
  id: string
  name: string
}

/** Future adapters must preserve source provenance and the native Mars CRS. */
export interface DatasetMetadata {
  id: string
  title: string
  regionId: MarsRegion['id']
  sourceUrl: string
  attribution: string
  coordinateReferenceSystem: string
  processedAssetUrl: string
}
