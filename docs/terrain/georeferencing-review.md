# Pahrump Hills prototype georeferencing decision

Decision: use the University of Arizona PDS_JP2 origin interpretation (B) as
the documented **prototype working convention**. This is not an absolute
geolocation or subpixel-registration accuracy certification.

## Evidence

- DEM and ortho PDS labels have matching projection, dimensions, spacing,
  and line/sample offsets.
- The [UA PDS_JP2 conversion](https://pirlwww.lpl.arizona.edu/software/PDS_JP2/PDS_JP2/classPDS__Projection__Data.html)
  uses offset minus one to construct the unrotated origin. Applying that rule
  to these labels reproduces the official ortho's embedded GeoJP2 transform.
- JP2ECW and JP2OpenJPEG independently read that same embedded origin. Isolated
  GeoJP2 reading reproduces it; isolated GMLJP2/PAM/worldfile reading does not.
- The default DEM PDS reader origin differs by 1.5 pixels per axis.
- Developer B reviewed the same terrain with no hillshade, A (reader origin),
  and B (working origin), and reported visible movement between A and B but no
  significant noticeable mismatch against the ortho alone.
- The screenshots show corresponding broad rock boundaries, but their
  presentation and hillshade lighting do not support a quantitative residual
  measurement or a defensible visual choice between A and B.

## Interpretation and limits

B is selected for consistent label/encoder interpretation, **not because the
screenshots prove B more accurate**. The raw DEM file is not rewritten. Any
derived use of DEM positions must record this convention and the original
reader transform. The source uncertainty is retained in exported metadata.

The review hillshade uses artificial visualization lighting (azimuth 315,
altitude 45 degrees), not the historical Sun. Brightness differences are not
registration residuals. Small-scale surface/triangulation-like patterns visible
in the relief are an additional quality caveat, not a quantified error model.

The approximately 1 km AOI has no missing DEM samples under either candidate
origin interpretation. That fact does not establish safe terrain or exact
rover/drill-hole localization. No absolute accuracy in metres is asserted.

## Consequence

Proceed with a labeled prototype image package on the native working grid.
Retain full CRS, pixel-edge bounds, source hashes, and this decision. A formal
registration assessment remains future work if the prototype requires stronger
accuracy claims. The map package contains no slope, hazard, or calculated route
layer; those need separate processing and integration.
