# Pahrump Hills observation and layer research

Research date: 2026-11-15. Developer B. This is a source inventory and incremental
plan, not approval of new runtime markers, mineral rasters or route penalties.
Existing three science targets and terrain assets are unchanged by this research.

## Footprint and quantitative search

Read the actual `pahrump-hills-v1` manifest, rather than searching Gale Crater as
if everything in the crater were inside the map. Its projected footprint is
1000 x 1000 metres. Under the existing prototype sphere/projection convention:

- Longitude east: approximately 137.36916875 to 137.38603935 degrees.
- Latitude: approximately -4.67151887 to -4.65464827 degrees.
- Exact version binding and conversion are in the generated inventory.

The existing hashed MMGIS snapshot has **113 rover waypoints** inside this
footprint. These are not 113 established scientific observation sites.

Downloaded the public [Berger (2020) APXS supplement, sols 0-2301](https://pds-geosciences.wustl.edu/msl/urn-nasa-pds-msl_apxs_supplement_sols_0_2301/)
(DOI 10.17189/1519050), its DS01/DS02 CSVs and PDS XML labels into ignored raw
data. [DS01](https://pds-geosciences.wustl.edu/msl/urn-nasa-pds-msl_apxs_supplement_sols_0_2301/data/ds01_2020je006536rr.csv)
has 712 measurement rows; **104 lie inside the map**, spanning sols 687-1092.
All 104 fall on finite elevation and slope cells. There are **30 distinct
coordinate pairs**, not necessarily 30 distinct physical targets. Raster suffixes
and repeated measurements must be grouped before choosing map markers.

Every selected coordinate pair numerically matches an existing MMGIS rover
waypoint within 1 cm. This is evidence of shared rover-position coordinates,
not centimetre absolute accuracy or exact measured-rock footprints. The PDS
label calls these target coordinates but does not establish the absolute datum
alignment with our prototype terrain. Preserve proxy language pending a geometry
review; do not use `target-location` solely because of the column label.

The [machine-readable inventory](apxs-observation-inventory.json) records all
104 rows, source URLs/hashes, measurement sols, projected positions, cells,
verbatim preparation codes/comments and numerical waypoint matches. It is NOT
a runtime science collection. Coordinate matches are not inferred date joins.

## Prioritized observations inside the footprint

These are spatially checked **candidate measurements**, not newly published UI
markers. A row's APXS measurement sol differs from the associated rover-pose sol.

| Candidate area | Exact APXS record examples | Measurement sols | Example grid cell | Supporting science context |
|---|---|---|---|---|
| Shoemaker | `Pelona_DRT`, `Ricardo_raster1_DRT` | 805, 806 | 94, 98 | Fine lamination observations; distinguish low-quality Ricardo repeats. |
| Book Cliffs | `Punchbowl_DRT_raster1`, `Afton_Canyon_DRT_raster1`, `Topanga_DRT_raster1` | 813-815 | 98, 100 | Contact-science observations complement Mastcam/ChemCam survey evidence. |
| Alexander Hills | `Mescal_DRT_raster1`, `Puente_DRT_raster1` | 819, 824 | 101, 103 | Workspace and selected targets also documented in NASA imagery. |
| Chinle | `Pickhandle_DRT`, `Goldstone_DRT_raster1` | 828, 830 | 103, 102 | NASA planning account describes arm observations at these targets; archived APXS rows provide measurement evidence. |
| Whale Rock | `San_Andreas`, `Santa_Ana_DRT_raster1` | 842, 844 | 105, 98 | Mastcam documents cross-bedding at the outcrop; this is context, not an exact join between the image and APXS spot. |
| Garden City | `Coalville`, `Alvord_Mountain_raster1`, `Indianola` | 930, 935 | 107, 96 | Published vein-chemistry investigation; farther than the original three drill markers but inside this map. |
| Buckskin | `Buckskin_DRT_raster1`, `Buckskin_Full_Drill_Tailings_APXS` | 1057, 1064 | 158, 13 | CheMin's published tridymite discovery makes this a valuable separate sample case. The measurement sols here are NOT the full-drill sol. |

Primary sources:

- [MAHLI Pahrump Hills field investigation, LPSC 2015 abstract 2855](https://www.hou.usra.edu/meetings/lpsc2015/pdf/2855.pdf): identifies outcrops, targets and contact-science campaigns.
- [NASA Alexander Hills workspace image](https://science.nasa.gov/photojournal/within-rovers-reach-at-mars-target-area-alexander-hills/): sol 817 Mastcam workspace and named image targets. Those names are not automatically interchangeable with the APXS record names above.
- [NASA Chinle planning account](https://science.nasa.gov/blog/msl-update-2312/): explicitly a plan for sols 830-832, not by itself proof every planned observation executed.
- [NASA Whale Rock image PIA19076](https://science.nasa.gov/photojournal/cross-bedding-at-whale-rock/): Mastcam imaging on sol 796, separate from later APXS measurements.
- [NASA/JPL Garden City findings](https://www.jpl.nasa.gov/news/upgrade-helps-nasa-study-mineral-veins-on-mars/): ChemCam investigation of vein chemistry.
- [NASA/JPL Buckskin discovery](https://www.jpl.nasa.gov/news/nasa-scientists-discover-unexpected-mineral-on-mars/): sol 1060 drilling and detection of tridymite. Do not infer mineral abundance from an APXS SiO2 column.

Quality review found 5 rows flagged by the source as low-quality spectra, 1 with
failed preparation and 9 sample-handling/dump rows (categories may overlap).
In particular, `DumpPile_Windjana` inside this map is a handled sample location,
not proof that the original Windjana sampling outcrop is inside the map.
Keep exact product/measurement identifiers during grouping. Do not forward-fill
blank outcrop fields without reviewing the supporting document.

## Which missions belong here?

Historical surface investigations here are from **MSL Curiosity**. Spirit,
Opportunity and Perseverance operated at other landing regions; adding their
surface points to this footprint would be misleading. See NASA's
[landing-site context map](https://science.nasa.gov/image-detail/45468-landingsitescontextmap-featperseverance/).

Multiple missions can still contribute orbital layers: our HiRISE data are from
MRO; MRO/CRISM and Odyssey/THEMIS are sensible next archive searches. Individual
scene coverage, usable pixels and alignment must be checked before claiming a
layer is available for this square. No new orbital raster has been downloaded
or spatially validated by this research.

## Layer priorities for future scientific site selection

| Priority | Layer | What it supports | What must be established |
|---|---|---|---|
| 1 | Existing ortho, DEM, slope, coverage mask; optional DEM hillshade | Inspect the terrain and explain route obstacles | Hillshade is visualization. Define roughness window/scale before adding a roughness product; neither certifies astronaut safety. |
| 1 | Reviewed APXS/ChemCam observation markers and existing drill samples | Connect a proposed revisit to prior measurements and sources | Group repeated measurements, keep rover proxy vs actual target geometry explicit, retain uncertainty and quality flags. |
| 2 | CheMin sample mineralogy | Source-backed mineral findings at sampled sites | Read mineral abundance products and their stated errors/normalization; keep findings attached to samples. Do not interpolate sparse samples into a continuous mineral map. |
| 2 | Geological units/contacts | Compare exposed materials and formulate science questions | Find a published map with adequate scale and verified footprint/CRS. A coarse regional unit boundary is not a metre-accurate contact. |
| 3 | CRISM map-projected spectral products | Regional mineral-indicator context and candidate exposures | Select a scene intersecting the AOI; check masks, atmospheric/artifact correction, pixel scale and spectra. Summary-parameter brightness is not automatically mineral abundance. |
| 4 | THEMIS thermal/thermal-inertia products | Regional thermophysical context | Check observation time/season and model metadata; thermal inertia differs from instantaneous temperature. Not a spacesuit thermal or energy-budget model. |
| Later | Reviewed dunes, loose material, scarps and block fields | Explain potential surface obstacles | Map observations with evidence and uncertainty. Do not derive bearing strength, sinkage or an EVA safety threshold from imagery alone. |

Archive entry points:

- [APXS products and supplements](https://pds-geosciences.wustl.edu/missions/msl/apxs.htm): elemental/oxide chemistry, not direct mineral identifications.
- [ChemCam products](https://pds-geosciences.wustl.edu/missions/msl/chemcam.htm): elemental and imaging observations.
- [CheMin products](https://pds-geosciences.wustl.edu/missions/msl/chemin.htm): X-ray diffraction mineralogy.
- [CRISM products](https://pds-geosciences.wustl.edu/missions/mro/crism.htm): start by investigating map-projected targeted products and their summary-parameter documentation.
- [CRISM observing-mode reference](https://pds-geosciences.wustl.edu/workshops/CRISM_Workshop_Mar12_presentations/CRISM_workshop_2012_introduction_SLM.pdf): typical targeted sampling is about 18 or 36 m depending on mode, not our 5 m routing resolution.
- [THEMIS FAQ](https://themis-data.asu.edu/faq): nominal IR sampling is about 100 m/pixel, with actual sampling varying by product. Only about ten native pixels span a kilometre at that scale; resampling does not create additional detail.

## Incremental implementation and expansion

1. Review a small first observation delivery: Pelona, Punchbowl, Pickhandle/
   Goldstone and a Garden City example. Keep Buckskin as a separate drill/sample
   enhancement. Confirm source preparation definitions and target associations
   before publishing any new marker. Reuse the existing science contract; extend
   the exporter through an explicit APXS adapter rather than forcing records
   through the drill-only exporter.
2. Add source-backed descriptions/mineral findings to existing samples. Quantitative
   analysis needs its own measurement metadata (units, errors, sample provenance,
   preparation, product identifiers); coordinate changes to the shared schema
   with Developer Y rather than adding unvalidated fields.
3. Search one CRISM scene, validate its AOI intersection and usable coverage,
   and agree on an independent raster-overlay contract with Y. Retain its own
   grid/resolution, masks, source URLs, processing history and quality flags.
4. Add historical traverse as a separate context line, with a separate contract.
   A spatial subset is not a time-filtered Pahrump campaign route.
5. Expand the AOI or add a neighboring region via another region configuration
   and versioned package ID. First check the original DEM/ortho valid masks and
   overlap; a full source bounding rectangle is not full valid coverage. Re-export
   compatible terrain layers and re-filter science records for each package.
6. Benchmark larger routing grids with Y. At 5 m sampling, 2 x 2 km is 160,000
   cells (4x current); 5 x 5 km is 1,000,000 cells (25x). Existing package separation
   supports new deliveries; cross-package routing, mosaicking/seams and tiled or
   multiresolution loading still require implementation. Preserve native science
   resolution rather than stretching every layer to a fictitious common detail.

## Reproduction and source caveats

Run `python scripts/terrain/inventory_apxs_observations.py` (standard library).
It reads ignored raw inputs and writes only the research inventory. Paths can
be supplied for a different compatible terrain package and coordinate review.

Download the DS01 CSV/XML from the linked archive into
`data/raw/pahrump-hills/science-research/`; the previously reviewed
`MSL_waypoints.json` is also required. The inventory records exact hashes.
The PDS label contains 55 fields and 712 records. CSV/XML headers have explicit
naming differences, and the CSV contains Windows-1252 micro signs despite ASCII
field declarations. The script checks the supported aliases, records the
differences and preserves original source bytes. It does not read chemical
abundances into the runtime app or silently convert units.

Validation: generated all 104 candidates against both terrain layers; checked
source field order/record counts, snapshot binding and waypoint coordinate
cross-checks. No frontend, contract, route-cost or runtime target changes were
made for this research task.
