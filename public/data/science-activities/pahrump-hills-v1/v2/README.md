# Pahrump Hills science activities v2

Three objectives, eight historical follow-ups and two project-reviewed orbital
imaging candidates. Contract version remains 1; collection identity is v2.

Read [source review and preparation](../../../../../docs/terrain/science-objectives-v2.md).
`provenance.json` records verified source URLs, input/output hashes and geometry
derivation. `activities.json` is the runtime collection. No terrain files change.

Regenerate from the repository root:

```sh
python scripts/terrain/export_science_objectives_v2.py
```

Orbital polygons are project-authored HiRISE imaging regions, not mineral
detections. Historical locations remain rover-position proxies. Timing/equipment
are scenario assumptions. The UI retains evidence and references in saved plans.
