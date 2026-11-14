# Science collection delivery validation

Validated 2026-11-15 on Developer B's branch after merging `origin/main`
(`3fbbb99`). This delivery implements the agreed science target contract without
changing frontend components or the schema. The dataset registry's existing
`scienceTargetsUrl` hook now points to the real collection.

## Delivered data

| Target | Site/drive | Activity sol | Position sol | Grid row, column |
|---|---|---|---|---|
| Confidence Hills | 42_1020 | 759 | 753 | 95, 98 |
| Mojave 2 | 45_0 | 882 | 864 | 97, 98 |
| Telegraph Peak | 45_450 | 908 | 903 | 105, 98 |

All are drill-associated **rover-position proxies**, not surveyed hole
locations. Uncertainty is unstated (`null`). The reviewed source joins and
coordinate convention are retained in the separate runtime provenance.
No analyses, risk scores, instrument findings or extra observation sites are
inferred. The historical traverse remains a separate future delivery.

## Checks performed

- Re-ran `record_science_provenance.py`: the local NASA waypoint snapshot hash,
  exact site/drive joins, coordinates and elevation coverage match the review.
- Exporter recomputed projected positions and checked the exact terrain
  manifest version and finite elevation/slope coverage before writing files.
- `npm test`: 180 tests passed in 23 files, including three new real-delivery
  integration tests using the existing parser, loader and coverage classifier.
- Integration tests verified terrain manifest, reviewed input and target JSON
  hashes. Existing terrain output hashes still match; science delivery did not
  alter the terrain package.
- `npm run build`: passed.
- `npm run lint -- --ignore-pattern "data/raw/**"`: passed. Plain lint could
  not scan an existing restricted QGIS temporary folder under ignored raw data;
  excluding raw downloads allowed the code checks to complete.
- Chrome desktop smoke test against the Vite localhost server: eight checks
  passed. Three real targets loaded; three map markers appeared; names matched;
  proxy and unverified-alignment caveats appeared; three source references were
  available; separate activity/position sols appeared; adding a target as a
  waypoint worked; no runtime exceptions occurred.

Browser checks cover the new data delivery and its existing UI hook. They do
not establish physical geolocation accuracy, certify a traversable route, or
replace the broader app audit in `app-verification-2026-11-14.md`.

## Handoff

No raw NASA downloads or Python setup are needed by Developer Y to display
these assets. The collection, provenance and README are in
`public/data/science/pahrump-hills-v1/`. Run the app, load Pahrump Hills, and use
the existing science target list/map markers and waypoint action. Review this
delivery through a PR before merging it into main.
