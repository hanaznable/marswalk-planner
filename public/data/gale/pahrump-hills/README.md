# Pahrump Hills prototype map preview

- `imagery.png`: real HiRISE grayscale ortho pixels with null-code transparency;
  989 x 989 pixels, native approximately 1.011757 m spacing, no resampling.
- `manifest.json`: explicit Mars CRS, pixel-edge bounds, row/column conventions,
  source attribution/checksums, and georeferencing limitations.

Source image: `ESP_039280_1755_RED_C_02_ORTHO.JP2`.
Credit: NASA/JPL-Caltech/UArizona.
Source: https://www.uahirise.org/dtm/dtm.php?ID=ESP_040770_1755

The footprint covers full native cells and is slightly larger than the requested
1000 x 1000 projected-metre AOI. Always use the manifest's actual grid bounds.
Do not interpret projected metres as Earth coordinates.

This is a map image preview, not an operationally validated navigation package.
The UA/JP2 origin convention is selected for prototype consistency; visual A/B
comparison was inconclusive, and absolute/image-DEM accuracy remains unverified.
There are no numeric terrain or route layers in this package. The UI does not
load the package yet; frontend integration requires coordination with Developer Y.

Reproduce from the project root:

```text
python scripts/terrain/export_map_preview.py --config scripts/terrain/regions/pahrump-hills.json --output-dir public/data/gale/pahrump-hills
```

Detailed review: `docs/terrain/georeferencing-review.md`.
