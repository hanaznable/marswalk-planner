# Surface-color layer feasibility

Initial metadata review and subsequent local implementation, 2026-11-15.
The enhanced RGB prototype is now available; see the delivery notes below.

## Candidate

The [existing observation ESP_039280_1755](https://www.uahirise.org/ESP_039280_1755)
offers a map-projected **Merged RGB** product:

- Product ID: `ESP_039280_1755_MRGB`.
- [JPEG2000 image](https://hirise-pds.lpl.arizona.edu/download/PDS/EXTRAS/RDR/ESP/ORB_039200_039299/ESP_039280_1755/ESP_039280_1755_MRGB.JP2), listed at about 206 MB.
- [PDS label](https://hirise-pds.lpl.arizona.edu/PDS/EXTRAS/RDR/ESP/ORB_039200_039299/ESP_039280_1755/ESP_039280_1755_MRGB.LBL).
- Acquired 2014-12-13. Credit NASA/JPL-Caltech/UArizona.
- Label sampling: 0.5 m/pixel; 13215 columns, 28027 rows.
- Planetocentric, east-positive longitude; spherical equirectangular,
  radius 3396190 m, central meridian 180 degrees, centre latitude 0.

The label's overall geographic envelope contains our approximately
137.36917-137.38604 E, -4.67152 to -4.65465 latitude AOI. This does **not** prove
every AOI pixel contains valid color: color-swath coverage and invalid/merged
grayscale areas must be inspected in the raster.

The separate official `ESP_039280_1755_COLOR` label was also inspected. It
describes IR/RED/BG data, not natural RGB. Neither product is a ready-made color
ORTHO matched to our DEM: the [DTM directory](https://www.uahirise.org/PDS/DTM/ESP/ORB_040700_040799/ESP_040770_1755_ESP_039280_1755/)
currently lists RED orthoimages, with no matching color ortho listed.

## Meaning of color

[HiRISE's color documentation](https://www.uahirise.org/pdf/color-products.pdf)
explains that its RGB display combines red, blue-green and a synthetic blue
channel. Extras use contrast enhancement. Use a label such as
**HiRISE enhanced RGB surface imagery**, not true/natural color or mineral map.
This is based on measured surface imagery, not a brown tint applied to grayscale.

## Next processing step

1. Download the MRGB image into ignored raw storage and hash the input/label.
2. Read its embedded georeferencing and inspect actual color/validity coverage.
   Confirm the pixel-origin interpretation rather than reusing offsets blindly.
3. Transform/crop to the terrain package footprint. Source central meridian is
   180 degrees while our terrain uses 137.39 degrees; the same projection name
   does not imply identical projected coordinates.
4. Compare identifiable features against the DEM-aligned RED ortho throughout
   the square. Map projection alone is not evidence of matching terrain
   orthorectification. Address terrain-dependent displacement explicitly; an
   arbitrary visual translation must not become a claimed scientific correction.
5. Export an independently versioned imagery asset with coverage/mask, provenance,
   color-processing description and registration limitations. Preserve grayscale
   where color is missing and disclose that coverage.
6. Coordinate a grayscale/color selection and any shared imagery contract with
   Developer Y. Keep the existing terrain manifest/hash and science binding
   intact; do not overwrite the current basemap as an undocumented replacement.

## Delivered registered prototype

The user supplied the MRGB JP2 under ignored raw storage. It is 206,345,289 bytes;
SHA-256 `9e06aef5b32c130ce964a1a066adba5145eedda4cc54552871ed049e22f9b439`.
GeoJP2 and the PDS label agree on projection, scale and pixel-area origin.
The initial georeferenced crop did not align adequately with the existing ortho.

An explicit empirical image-registration step fitted a global displacement and
affine residual from nine patches, checked against 16 separate non-overlapping
patches. The registered image passed the declared relative checks: maximum
integer residual about 1.414 m; minimum matched patch correlation about 0.870.
Visual inspection of corresponding landforms supports the relative alignment.
This is not absolute accuracy validation or camera-model orthorectification.

The source has a grayscale strip along the western edge of the registered AOI.
It is retained and disclosed rather than colorized. The app's Surface imagery
controls offer Grayscale / Enhanced RGB, defaulting to grayscale. Color is now
also available in the Layer Lab. Existing terrain, science data, route costs
and EVA assumptions are unchanged.

Assets and detailed processing notes:
`public/data/imagery/pahrump-hills-rgb-v1/README.md`.
Reproducible scripts: `inspect_surface_color.py` and `register_surface_color.py`.
Evidence: `surface-color-inspection.json` and `surface-color-registration.json`.

Validation: build, lint and 190 TypeScript tests passed; four Python registration
tests passed. Fifteen Chrome checks passed for actual RGB display, coverage/
color caveats, fixed footprint and viewport on switching, overlay rendering,
3D round-trip/StrictMode, grayscale restoration, mobile layout, RGB download
failure/retry, and the Layer Lab. Existing terrain output hashes still match.
