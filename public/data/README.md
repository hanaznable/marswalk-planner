# Processed mission assets

`gale/pahrump-hills-v1/` is the current real contract-v1 terrain package: 5 m
Float32 elevation and slope grids, same-footprint JPEG, manifest and provenance.
The documented origin interpretation is a prototype working convention; exact
registration and absolute accuracy are unverified. There is no validated hazard
or precomputed EVA route layer.

`gale/pahrump-hills/` is the older image-only PNG preview, not a v1 runtime package.

These real files are prepared, not loaded by the UI: `App.tsx` still chooses a
synthetic fixture. Coordinate the loader and basemap integration with Developer Y.
Never put credentials or private files here: Vite serves this directory publicly.
