# First activity collection - source review

Reviewed 2026-11-15 by Codex for Developer B. This is a source/content and
software-input review, not independent field validation or human sign-off.

## Delivered activities

| Target | Imaging-context reference | APXS identity |
| --- | --- | --- |
| Pelona | Shoemaker section, page 1 | Pelona_DRT, sol 805, row 161 |
| Punchbowl | Book Cliffs section, page 2 | Punchbowl_DRT_raster1, sol 813, row 169 |
| Pickhandle | Chinle section, page 2 | Pickhandle_DRT, sol 828, row 179 |

Primary imaging source: [McBride et al., LPSC 2015 abstract 2855](https://www.hou.usra.edu/meetings/lpsc2015/pdf/2855.pdf).
Measurement metadata: [Berger 2020 APXS table](https://pds-geosciences.wustl.edu/msl/urn-nasa-pds-msl_apxs_supplement_sols_0_2301/data/ds01_2020je006536rr.csv),
as retained in the existing context snapshot. Statements in the new collection
are paraphrases of these sources. APXS measurement sols are not MAHLI acquisition
sols; the imaging evidence leaves its sol null. Archive suffixes and row identity
are retained. Named-target association does not create exact rock geometry.

Experiments, rationale and camera equipment are project-authored planning content.
Durations are null. Imaging suggestions do not promise historical instrument
performance, current target exposure, access or traversal safety.

## Deferred candidates

Garden City and Buckskin remain draft for another content increment. No orbital
feature has passed geometry/interpretation review. Do not infer an orbital target
from RGB color or label it unvisited based on traverse distance. The earlier
candidate inventory remains an unchanged draft research artifact; the independent
collection/provenance records this narrower completed source review.

## Checks and boundary

The exporter checks APXS row/name/sol/position identity and flags, finite terrain
coverage and pinned manifest/context hashes. Provenance records input/output hashes.
Parser tests cover collection bindings, cross-references, review status, no-data
access, polygon validity, clipping and snapping outside evidence areas. Polygon
fixtures are structural software tests, not orbital science deliveries.

Existing target collections, terrain files and routing algorithms remain unchanged.
The Science tab now loads the collection with objective/equipment controls and
explicit route selection. Mission v2 stores collection/evidence snapshots and
activity-to-waypoint associations; legacy v1 remains readable. JSON/printable
reports retain proposed activities separately from evidence and disclose relocation.
The UI does not add activity-specific timing or imply an orbital candidate exists.
