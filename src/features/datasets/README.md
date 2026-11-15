# NASA dataset boundary

`regions.ts` maps navigation choices to terrain sources. The default is the real
Pahrump Hills package; Jezero has no package, and synthetic terrain is an explicit
development choice, never a fallback.

`registry.ts` registers the integrated terrain and its science-target collection.
`loadTerrainPackage.ts` validates manifests and decodes elevation/slope assets;
`terrainContract.ts` defines grid and coordinate rules. Science targets have
their own parser, coverage checks and loader. The shared types are jointly owned
by Developers B and Y: coordinate schema changes.

Display-context and enhanced-RGB registries/loaders live in `../mapLayers/`.
They bind their assets to the exact terrain manifest hash. Science coverage
validation checks the terrain package ID; the collection also records a manifest
hash, which is not independently compared by the target loader.

Preparation lives in `/scripts/terrain`; `/scripts/preprocessing` points there.
Processed browser assets belong in `/public/data`, with sources and provenance.
Do not substitute Earth tiles, assume Earth distance formulas, or fabricate
coordinates for region selections. See [the source guide](../../../docs/data-sources.md).
