# Geospatial preprocessing

The implemented pipeline lives in [`../terrain/`](../terrain/README.md): region
configuration, source validation, elevation/slope preparation, science context
and prototype RGB image registration. This directory is retained as an
architecture pointer; it is not a second competing pipeline.

Future pipelines should preserve the original source URL, attribution, native
Mars coordinate reference system, units, resolution, and no-data values. Keep
raw large files outside the web bundle and publish validated outputs under
`public/data` alongside provenance metadata. Do not generate synthetic scientific
inputs as a substitute for source datasets.
