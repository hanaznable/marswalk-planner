# Pahrump Hills science targets v1

Three sourced Curiosity drill activities: Confidence Hills, Mojave 2 and
Telegraph Peak. **Positions are associated rover poses, not exact drill holes.**
Activity and position sols differ and are kept separately. The sources provide
no positional uncertainty; `uncertaintyMeters` is `null`. Absolute alignment
with the terrain remains unverified. No instrument results or science scores
are inferred. No traverse line is included.

`targets.json` follows `docs/science-target-contract.md`. `provenance.json`
contains source URLs and snapshot hashes, site/drive associations, the full
coordinate conversion and the exact terrain manifest hash. The science folder
is separate from the terrain folder so the existing terrain hashes stay valid.

The dataset registry points to this collection. Developer Y needs no Python or
raw NASA downloads: run `npm install` and `npm run dev`, select Pahrump Hills,
then inspect the three science targets and add them as route waypoints. Terrain
coverage does not guarantee a route passes the chosen slope limit.

Rebuild from the committed, reviewed positions (Python 3.11+, standard library):

```text
python scripts/terrain/export_science_targets.py
```

To re-check the original source join first, place the recorded waypoint
snapshot under `data/raw/pahrump-hills/` and run
`python scripts/terrain/record_science_provenance.py`. A changed source or terrain
requires a new review, not silently accepting a different snapshot.

Other terrain packages can supply `--review`, `--terrain-dir`, `--output-dir`.
The exporter supports reviewed Curiosity drill-associated rover proxies in the
documented spherical equirectangular frame. Other missions, coordinate frames
or exact target locations need a separately reviewed adapter.
