# Science suggestions - merge review

Reviewed 2026-11-15 on `feature/science-suggestions`, after fetching and integrating
`origin/main` at `e19d57c` (PR #25, clear-waypoint confirmation). Main integrated
without conflicts; all existing feature work was preserved.

## Scope reviewed

Terrain-bound science collection/parser, source preparation and hashes, selection
ownership, equipment controls, unified 2D science layer, map popups, region changes,
mission v1/v2 compatibility, JSON/print reports and the new clear-confirmation flow.
Source references and interpretation limits remain in the versioned reviews.

## Fixes and cleanup

- Fixed review/provenance hash differences caused by CRLF-to-LF Git normalization.
  Exporters now require LF review files, matching `.gitattributes`; the normalized
  hash chain reproduces on clean checkouts. Collection contents and source
  coordinates were not changed by this fix.
- Removed the old independent water/mineral/orbital toggle state. One visibility
  flag controls Science missions; map rendering takes a small data/action interface
  rather than depending on the full React suggestion controller.
- Fixed missing markers for the three original photography activities. All 14
  reviewed activities now appear at 10 distinct locations. Shared objectives and
  experiments use one popup rather than stacking markers at the same coordinate.
- A map action only reports success when adding the activity actually succeeds.
- Bounded imported polygon complexity before quadratic intersection validation.
- Moved science-specific CSS out of the global stylesheet and removed obsolete
  overrides, exports and an unused Python import. Approved card styling, equipment
  colors and the Science tab icon remain.
- Replaced stale implementation instructions with a current guide; retained
  versioned source reviews, earlier snapshots and exporters for reproducibility.

## Validation

- `npm test`: 253 tests pass across 29 files.
- `npm run lint` and `npm run build`: pass. The existing optional 3D bundle-size
  advisory remains; no new dependency was added.
- All three exporters run offline and reproduce all six collection/provenance
  JSON files byte-for-byte.
- 46 local browser assertions pass: sampling/equipment gating, shared waypoint
  ownership, all science marker locations, orbital polygons and routing, mission
  save/reload/reopen, print reports, equipment colors and phone width.
- Main integration checks cover Clear all cancellation/confirmation, clearing
  science associations, no stale selections when waypoint IDs are reused, and
  switching between 2D and 3D while retaining route stops.
- 13 additional production-preview browser assertions pass for equipment colors,
  complete marker coverage, clear confirmation, 2D/3D switching and phone width.
- Git-index hash checks confirm that committed LF bytes match all pinned hashes.

## Retained boundaries

Science overlays are 2D-only; selected route stops remain available in 3D. Equipment
and sampling methods are scenario assumptions informed by primary sources. Orbital
areas are project-authored imaging regions, not mineral detections or evidence
of unvisited terrain. No new chemistry, sample availability, task duration, payload
budget or certified Mars EVA capability is inferred. The existing per-stop timing
rule and route-cost calculations remain unchanged.

This review prepares the feature for a main-branch merge. Publishing, deployment
and repository access settings are outside this review.
