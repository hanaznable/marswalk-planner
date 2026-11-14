# 2D baseline merge readiness

Initial assessment and completion update, 2026-11-15.

## Latest status: ready for the baseline PR

The user confirmed frontend review is complete. The image-status issues,
report-provenance gap and narrow-map banner collision are fixed in implementation
commit `6ff83e5`. A detached, clean checkout passed build, lint, 193 TypeScript
tests, 23 Python tests and 39 production-browser checks, with no raw NASA files.
See [completed verification](premerge-verification-2026-11-15.md). The remaining
sections preserve the original assessment/checklist; they are not a request to
repeat frontend review. The actual merge has not been performed.

## Repository state

- `origin/main`: `3fbbb99`.
- Current branch: `batuhan/terrain-validation`, HEAD `3bc1990`, which includes
  that main commit. No newer remote main commits were found by this fetch.
- Every currently published `origin/yusuf/*` branch has zero commits outside
  `origin/main`. Yusuf's published work is already integrated. His unpublished
  local changes, if any, cannot be determined from this repository.
- Our branch has three commits outside main: source/provenance review, the
  app audit, and the merge of main into our branch. Most recently implemented
  features are still uncommitted; GitHub cannot review or merge those files yet.
- The original 206 MB RGB JP2 and other raw inputs remain ignored. The largest
  new commit candidate is the processed RGB JPEG, about 409 KB.

## Current delivery

Real Pahrump Hills terrain, three sourced drill proxies, APXS observation
context, historical traverse, a published mineral finding, selected main-map
layers, observation-to-waypoint actions, the independent Layer Lab and optional
registered enhanced RGB. Data hashes, relative-registration limitations,
partial color coverage and proxy positions are documented.

Last completed checks: build, ESLint and 190 TypeScript tests passed; four
registration tests and 15 color-specific browser checks passed. Earlier browser
checks cover waypoint actions, context failure/retry and region isolation.
These results are evidence for the present local implementation, not a substitute
for checking the actual committed PR head.

## Original checklist (completed; see latest status above)

Implementation follow-up: frontend review is complete per the user. The image
status/recovery and report-provenance fixes below are now implemented. The
implementation passes 193 TypeScript tests, the production build, standard
`npm run lint`, and 23 Python processing tests. The narrow-map prototype banner
also uses a separate responsive position. Final clean-checkout/browser evidence
will be recorded before the PR is marked ready. The numbered list below records
the original review checklist and the intended final verification workflow.

1. Finish the small basemap-status fixes identified in the app audit. Source
   still stores a failed image URL without clearing it on successful recovery;
   sidebar image status also checks availability rather than successful display.
   Keep terrain/routing usable when an image fails.
2. Preserve selected APXS/mineral provenance in exported reports, or explicitly
   agree to defer that gap. Current waypoint labels preserve the observation name
   and proxy caveat, but structured sources/measurement metadata are not exported
   for those selections. Existing report science-source records cover the three
   approved drill proxies. Coordinate an additive report/waypoint metadata design
   with Yusuf; do not infer an observation's source from its display label.
3. Have Yusuf review the now-modified shared frontend boundaries (`App`, layer
   panel, map viewport/canvas and display-layer module wiring), specifically
   lifecycle handling, region changes and source-to-local coordinates. The user
   authorized main-page integration; this review avoids conflicting follow-up
   work during the UI redesign.
4. Stage only the intended source files, compact processed assets, provenance,
   tests and docs. Keep raw downloads, browser profiles/screenshots, caches and
   generated `dist` out. Review the staged diff, commit and push this branch,
   then open a PR against main. A draft PR can be opened before review cleanup
   is finished, but those files must first be committed/pushed to be visible.
5. Check the committed PR version: npm tests/build/lint, Python processing tests
   and a clean-checkout browser smoke test (no raw NASA files/Python needed for
   the app). Exercise named observation waypoints, both route alternatives,
   exported reports, image switching, region switching and failure recovery.
   Re-fetch main before merging and resolve any new divergence.

The narrow-screen prototype-banner collision from the older audit should be
rechecked and can be included in the UI cleanup. Stale workspace help/footer
claims have already been corrected locally. Keep historical audit findings
dated rather than silently rewriting past results.

## Work that does not need to delay the 2D baseline merge

CRISM, THEMIS, geological polygons, mapped hazards, global map coverage, suit
resource models, 3D and a full UI redesign are separate increments. Their absence
does not invalidate an honestly labelled working prototype. Absolute geolocation
remains unverified and must remain disclosed; existing numerical tests do not
certify operational navigation safety.

## Next phase after the baseline is merged

- Both developers create new feature branches from the same updated main.
- Developer B: first read-only 3D terrain view consuming the existing terrain
  package, with orbit controls and optional imagery texture. Explicitly agree
  scene axes, metre scale, vertical display offset, UV/grid mapping and missing
  data behavior before adding routes/targets to the scene. Keep the renderer
  independent of terrain preprocessing and routing; lazy-load 3D dependencies.
- Developer Y: UI redesign against the merged contracts. Agree on layout and
  interaction requirements first; preserve the map, waypoint, source-caveat,
  report and loading/error flows while changing presentation.
- Share a small view/selection contract, then project the same waypoints and
  route results in 2D and 3D. Do not implement a second routing algorithm inside
  the 3D renderer. Validate coordinate/texture agreement before visual polish.
- Merge these focused increments through PRs; avoid keeping both large feature
  branches isolated until all 3D/UI work is complete.
