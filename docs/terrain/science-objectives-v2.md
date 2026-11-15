# Science objectives v2 - source and geometry review

Reviewed 2026-11-15 for the feature/science-suggestions branch.
This document records the retained v2 increment; the current runtime also includes
[v3 sampling proposals](rock-sampling-v3.md). This is a local
project source/content review, not independent scientific or navigation certification.

## Delivered objectives and layers

| Objective | Follow-ups | Evidence |
| --- | --- | --- |
| Study rock textures | Three existing historical stops and two orbital imaging areas | MAHLI/APXS context and existing HiRISE orthoimage |
| Investigate past water activity | Garden City vein imaging and Confidence Hills sample context | Published vein investigation and acid-sulfate alteration interpretation |
| Investigate mineral diversity | Confidence Hills, Mojave 2, Telegraph Peak and Buckskin sample context | Published CheMin sample findings |

The collection has ten activities total; Confidence Hills belongs to two objectives.
All proposed experiments are photography follow-ups with a planning-assumption field
camera; the three historical rock-texture activities and Garden City vein activity
also require Close-up imaging optics. One camera may provide both capabilities. A camera does not repeat CheMin mineral identification or measure mineral
abundances. No scientific value score or task duration has been invented.

**Science missions** is one optional 2D layer switch. It jointly controls past-water
investigations (two access markers), sample mineralogy (four markers), orbital
candidates (two polygons and access markers) and the original Buckskin mineral
finding. The individual switches and expandable group were removed. Visibility
does not change routing costs or delete selected waypoints. Route stops remain
available in 3D; the combined evidence layer is available in 2D only.

## Verified source links

| Source | What is used |
| --- | --- |
| [NASA/JPL Garden City investigation](https://www.jpl.nasa.gov/news/upgrade-helps-nasa-study-mineral-veins-on-mars/) | Vein diversity and published interpretation of multiple groundwater episodes |
| [Kronyak et al. (2019), DOI 10.1029/2018EA000482](https://doi.org/10.1029/2018EA000482) / [LANL manuscript record](https://laro.lanl.gov/esploro/outputs/journalArticle/Mineral-Filled-Fractures-as-Indicators-of-Multigenerational/9916362278803761) | Table 1 and Garden City target associations, including Alvord Mountain |
| [NASA PDS APXS source table](https://pds-geosciences.wustl.edu/msl/urn-nasa-pds-msl_apxs_supplement_sols_0_2301/data/ds01_2020je006536rr.csv) | Existing reviewed Alvord Mountain and Buckskin rover-position proxies; source row identities are preserved |
| [Rampe et al. (2015), NASA NTRS 20150019443](https://ntrs.nasa.gov/api/citations/20150019443/downloads/20150019443.pdf) | CheMin jarosite findings in all three Pahrump Hills samples and acid-sulfate interpretation; the abstract explicitly allows alternative interpretations |
| [NASA/JPL PIA21146](https://www.jpl.nasa.gov/images/pia21146-mudstone-mineralogy-from-curiositys-chemin-2013-to-2016/) | Published sample mineralogy comparison; no chart percentages digitized |
| [NASA/JPL Buckskin tridymite report](https://www.jpl.nasa.gov/news/nasa-scientists-discover-unexpected-mineral-on-mars/) | Tridymite in the drill sample collected on sol 1060 |
| [HiRISE ESP_039280_1755](https://www.uahirise.org/ESP_039280_1755) | Scene identity and orbital imaging context for manual review of the committed orthoimage crop |

The publisher DOI endpoint returned HTTP 403 during review; the accepted manuscript
was checked through the primary LANL repository/search excerpts. Stable repository
and DOI links are retained, not temporary signed download URLs.

## Position and time handling

Historical evidence reuses the existing reviewed rover-position proxies, without
claiming exact drill-hole/rock locations. Their numerical positions are unchanged.
All geometry uses the terrain package's projected Mars CRS and origin convention;
Leaflet converts it into local metres only for display.

Alvord Mountain APXS row 202 records sol 935. The publication's ChemCam sol 937
is a different measurement and is not substituted into that APXS record. Buckskin
APXS sol 1057 and drill sample collection sol 1060 are distinct. Mineral evidence
has `sol: null` where no CheMin analysis sol was established; collection sol 1060
is identified explicitly in the evidence statement.

## Orbital candidates

Two small imaging regions were visually reviewed on the committed 989 x 989
grayscale basemap: northern outcrop and southwestern outcrop. Irregular bright
exposures and visible boundaries support follow-up imaging, not a mineral claim.
These polygons and access points are **project-authored annotations** of real
NASA imagery. They are not official NASA feature footprints, geologic contacts,
spectral detections, safety assessments or proof that no rover visited a location.

The review config records closed rings in image pixel-edge coordinates and an
interior access pixel. The exporter converts these with the basemap geotransform:
`x = originX + pixelX * pixelWidth`, `y = originY + pixelY * pixelHeight`.
The source orthoimage sampling is 1.0117571650087 m, while the packaged display
image is approximately 1.0111223458 m/pixel. The scene page's higher-resolution
RDR image scale must not be substituted for this orthoimage's sampling.

The runtime parser checks polygon geometry, covered cells and both the original
and snapped access position inside the polygon. Normal route planning still
evaluates slope/coverage; an imaging candidate does not guarantee route feasibility.

## Reproduction and audit files

- [Review config](../../scripts/terrain/reviews/science-objectives-v2.json): source URLs, pixel geometry and pinned input SHA-256 values.
- [Exporter](../../scripts/terrain/export_science_objectives_v2.py): run `python scripts/terrain/export_science_objectives_v2.py` from the repository root.
- [Runtime collection](../../public/data/science-activities/pahrump-hills-v1/v2/activities.json).
- [Provenance](../../public/data/science-activities/pahrump-hills-v1/v2/provenance.json): input/review/output hashes, references, geometry derivation and limits.

Original terrain, science-target, context and v1 activity packages are unchanged.
Legacy saved missions retain their embedded collection snapshots. Start a fresh
plan to test the current collection rather than replacing evidence in an old plan.

## Not delivered

No new CRISM mineral raster, thermal product, geologic-unit map, chemical abundance
map or automatic prospecting model was added. CRISM requires a separately reviewed
product covering this precise extent, valid quality masks and an appropriate
spectral interpretation before it can supply mineral candidates.

## Local verification

246 automated tests, lint and production build pass. Seventeen browser assertions
cover the three objectives, source-backed activity counts, overlay geometry counts,
orbital popup selection, route association, saved polygon/evidence snapshots,
narrow screens and absence of runtime exceptions. No QGIS work or additional
download is required to test this increment.

## Equipment requirements and next experiments

Source: [NASA Curiosity instrument capabilities](https://science.nasa.gov/mission/msl-curiosity/science-instruments/).
Mastcam provides context imaging; MAHLI provides close-up/microscopic views of rock
textures and structures. This supports distinguishing context photography from
close-up texture photography. The demo's field camera and macro/close-up optics
are scenario capabilities, not a claim of MAHLI-equivalent performance or certified
Mars astronaut hardware. Selecting both does not imply carrying two cameras.

The review config explicitly lists the four close-up activities. Their requirements
are exported, enforced before route addition, and preserved in mission snapshots.
Broad sample-context and orbital-area photography still requires only Field camera.

For meaningful non-photographic experiments, requirements must be tied to the
experiment rather than the objective name:

| Possible future experiment | Required capability | Current status |
| --- | --- | --- |
| Measure elemental composition | Contact elemental analyzer, with a documented preparation/measurement protocol | Not implemented; NASA APXS is the real rover example, not an assumed astronaut handheld device |
| Collect rock chips | Rock sampling tools, documented containers/handling and context photography | Not implemented; NASA documents geology hammers and bagging in lunar operations, which need an explicit adaptation for our Mars scenario |
| Identify sample minerals | Sample acquisition/preparation and access to a suitable mineral-analysis laboratory | Not implemented; CheMin is an internal rover X-ray diffraction instrument, not field-camera capability |

Additional primary source: [NASA spacewalking geology tools](https://www.nasa.gov/suits-and-rovers/spacewalking-tools/).
NASA describes hammers for chip samples and tongs placing rocks in sample bags.
These sources establish tool functions, not site-specific sample availability,
Mars EVA certification, safety, task duration or a complete sampling protocol.
