# Pahrump Hills enhanced RGB prototype

Source: HiRISE `ESP_039280_1755_MRGB`, acquired 2014-12-13.
Credit: NASA/JPL-Caltech/UArizona.
[Observation and download links](https://www.uahirise.org/ESP_039280_1755).

This independently versioned display package covers the same 1000 x 1000 m
footprint as `pahrump-hills-v1`. It does not modify that terrain package or the
science target/context hashes. Its 1000 x 1000 JPEG has 1 m display sampling,
from a reduced-resolution decode of the native 0.5 m merged product. It includes
the source's enhanced RGB (synthetic blue) and preserves its grayscale strip
along the western edge. No color is invented for that strip.

## Registration and limitations

The original product's embedded GeoJP2 agrees with its PDS label. After accounting
for the different central meridians, it is still substantially displaced from
the DEM-aligned orthoimage. Using it directly beneath the observation markers
would be misleading.

The display image therefore uses **empirical relative image registration** to
the existing ortho. An initial image-correlation translation (+130 columns,
-185 rows at 1 m) was followed by an affine residual fit on nine 128-pixel
patches. Sixteen 96-pixel validation patches do not overlap the training patches.
The maximum remaining integer-pixel displacement was sqrt(2) m and the minimum
matched high-pass red/ortho correlation was about 0.870. These are relative
engineering checks, not certified position uncertainty or camera-model
orthorectification. Absolute geolocation remains unverified, just as for the
existing prototype terrain. The full coefficients/checks are in provenance.

The recorded identical-channel pixel fraction describes pixel values; it is not
a certified color-swath mask or a quantitative mineral map. No extra color
enhancement, AI colorization or arbitrary brown tint was applied.

## Files and use

- `manifest.json`: exact terrain-version binding, image grid/hash, attribution,
  color meaning, partial-coverage and registration caveats.
- `rgb.jpg`: registered display image, JPEG quality 95 without chroma subsampling.
- `provenance.json`: original file/label hashes, image inspection, registration
  evidence, software/pipeline versions and output checksums.

The app starts with grayscale. Under Surface imagery, select Enhanced RGB to
switch; scientific overlays and route inputs remain independent. The browser
checks the terrain version, image footprint and actual image checksum before
enabling the option. RGB loading failure leaves grayscale available, with retry.

Reproduce with the downloaded raw image/label and existing terrain package:

```text
python scripts/terrain/inspect_surface_color.py
python scripts/terrain/register_surface_color.py
```

Dependencies are the existing NumPy/Pillow terrain requirements; no GDAL install
is required for this supported GeoJP2 adapter. The diagnostic scripts explicitly
target this reviewed Pahrump input. Other projections, source formats, AOIs or
orthorectification models need their own validation rather than reusing these
empirical transform coefficients.

Original downloads and comparison images stay in ignored raw storage. The
committed inspection/registration JSON reports are under `docs/terrain/`.
