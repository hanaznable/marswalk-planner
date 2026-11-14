"""Fit and test relative RGB-to-ortho registration; never alter source terrain.

This is empirical image registration for a prototype basemap, not camera-model
orthorectification or absolute geolocation certification. Export is gated on
checks in separate, non-overlapping image patches.
"""

import json
import math
import platform
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, __version__ as pillow_version

from inspect_surface_color import ROOT, phase_shift, sha


def highpass(image):
    return np.asarray(image, dtype=float) - np.asarray(image.filter(ImageFilter.GaussianBlur(3)), dtype=float)


def fit_affine_shifts(samples):
    """Fit relative displacement against reference pixel centre coordinates."""
    design = np.array([[1, *s["centre_col_row"]] for s in samples], dtype=float)
    offsets = np.array([[s["moving_to_reference_shift_col_px"], s["moving_to_reference_shift_row_px"]] for s in samples])
    coefficients, _, rank, _ = np.linalg.lstsq(design, offsets, rcond=None)
    if rank != 3:
        raise ValueError("Need spatially distributed registration patches")
    return coefficients


def main():
    raw = ROOT / "data/raw/pahrump-hills/color-research"
    inspection_path = ROOT / "docs/terrain/surface-color-inspection.json"
    inspection = json.loads(inspection_path.read_text(encoding="utf-8"))
    if sha(raw / inspection["source"]) != inspection["source_sha256"]:
        raise ValueError("Source differs from inspected snapshot")
    expanded_path = raw / "validation-preview/rgb-envelope-margin.png"
    if sha(expanded_path) != inspection["diagnostic_output_sha256"][expanded_path.name]:
        raise ValueError("Decoded crop differs from inspected source")
    terrain_dir = ROOT / "public/data/gale/pahrump-hills-v1"
    if sha(terrain_dir / "manifest.json") != inspection["terrainManifestSha256"]:
        raise ValueError("Terrain version changed")
    manifest = json.loads((terrain_dir / "manifest.json").read_text(encoding="utf-8"))
    with Image.open(expanded_path) as image:
        expanded = image.copy()
    with Image.open(terrain_dir / "basemap.jpg") as image:
        gray = image.convert("L").resize((1000, 1000), Image.Resampling.BILINEAR)
    reference = highpass(gray)
    initial = inspection["global_diagnostic"]
    gx, gy = initial["moving_to_reference_shift_col_px"], initial["moving_to_reference_shift_row_px"]
    translated = expanded.crop((400-gx, 400-gy, 1400-gx, 1400-gy))
    moving = highpass(translated.getchannel("R"))
    samples = []
    for y in (200, 500, 800):
        for x in (200, 500, 800):
            patch = (slice(y-64, y+64), slice(x-64, x+64))
            check = phase_shift(reference[patch], moving[patch], limit=12)
            if check["search_boundary_peak"] or check["diagnostic_shift_correlation"] < 0.65:
                raise ValueError("Insufficient training-patch match: " + str((x, y, check)))
            samples.append({"centre_col_row": [x, y], **check})
    coefficients = fit_affine_shifts(samples)
    # Pillow expects reference/output -> source/input mapping, in pixel units.
    a = (1-coefficients[1, 0], -coefficients[2, 0], 400-gx-coefficients[0, 0],
         -coefficients[1, 1], 1-coefficients[2, 1], 400-gy-coefficients[0, 1])
    corners = [(a[0]*x+a[1]*y+a[2], a[3]*x+a[4]*y+a[5]) for x, y in ((0, 0), (1000, 0), (0, 1000), (1000, 1000))]
    if not all(0 <= x < expanded.width and 0 <= y < expanded.height for x, y in corners):
        raise ValueError("Registration would leave source coverage")
    registered = expanded.transform((1000, 1000), Image.Transform.AFFINE, a, resample=Image.Resampling.BILINEAR)
    candidate = highpass(registered.getchannel("R"))
    checks = []
    # These 96px patches do not overlap the 128px training patches in x or y.
    for y in (75, 350, 650, 925):
        for x in (75, 350, 650, 925):
            patch = (slice(y-48, y+48), slice(x-48, x+48))
            checks.append({"centre_col_row": [x, y], **phase_shift(reference[patch], candidate[patch], limit=8)})
    max_residual = max(math.hypot(c["moving_to_reference_shift_col_px"], c["moving_to_reference_shift_row_px"]) for c in checks)
    minimum_match = min(c["diagnostic_shift_correlation"] for c in checks)
    passed = max_residual <= 2 and minimum_match >= 0.6 and not any(c["search_boundary_peak"] for c in checks)
    preview = raw / "validation-preview"
    registered.save(preview / "rgb-affine-diagnostic.png")
    pair = Image.new("RGB", (2000, 1000))
    pair.paste(gray.convert("RGB"), (0, 0)); pair.paste(registered, (1000, 0))
    pair.save(preview / "gray-registered-rgb.jpg", quality=95)
    Image.blend(gray.convert("RGB"), registered, 0.5).save(preview / "registered-alignment-blend.png")
    result = {
        "status": "prototype-relative-registration-passed" if passed else "registration-needs-review-not-exported",
        "method": "9 image-patch integer phase correlations after global displacement; least-squares affine displacement field; validation on 16 separate non-overlapping image patches",
        "reference": "Existing grayscale orthoimage, resized to 1m only for relative image registration",
        "terrainManifestSha256": inspection["terrainManifestSha256"],
        "source_sha256": inspection["source_sha256"], "inspection_sha256": sha(inspection_path),
        "initial_translation_col_row_m": [gx, gy], "residual_shift_coefficients": coefficients.tolist(),
        "output_to_expanded_source_affine": list(a),
        "training_patches": samples, "validation_patches": checks,
        "max_integer_residual_m": max_residual, "minimum_validation_match_correlation": minimum_match,
        "acceptance": {"max_integer_residual_m": 2, "min_validation_match_correlation": 0.6},
        "registered_preview_sha256": sha(preview / "rgb-affine-diagnostic.png"),
        "limitations": ["Relative empirical image registration, not camera-model orthorectification", "Integer-pixel patch residuals are not a certified positional uncertainty", "Absolute geolocation inherits the existing unverified prototype terrain convention", "Enhanced RGB has a synthetic blue channel; no mineral abundance is inferred"],
    }
    report = ROOT / "docs/terrain/surface-color-registration.json"
    report.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")
    print(result["status"], "maximum residual:", max_residual, "m; minimum patch match:", minimum_match)
    print("Diagnostic:", preview / "gray-registered-rgb.jpg")
    if not passed:
        raise ValueError("Registration gate failed; inspect diagnostics before any app export")

    # Independent display package; existing terrain bytes and hashes stay fixed.
    pixels = np.asarray(registered).astype(np.int16)
    if np.any(np.all(pixels == 0, axis=2)):
        raise ValueError("Unmasked all-zero source pixels; do not publish an opaque image")
    destination = ROOT / "public/data/imagery/pahrump-hills-rgb-v1"
    destination.mkdir(parents=True, exist_ok=True)
    registered.save(destination / "rgb.jpg", quality=95, subsampling=0)
    image_manifest = {
        "contractVersion": 1, "id": "pahrump-hills-rgb-v1", "terrainPackageId": manifest["id"],
        "terrainManifestSha256": inspection["terrainManifestSha256"],
        "title": "HiRISE enhanced RGB", "synthetic": False,
        "image": {"url": "rgb.jpg", "width": 1000, "height": 1000,
                  "geoTransform": inspection["output_geoTransform"], "sha256": sha(destination / "rgb.jpg")},
        "source": {"productId": "ESP_039280_1755_MRGB", "url": "https://www.uahirise.org/ESP_039280_1755",
                   "attribution": "NASA/JPL-Caltech/UArizona", "acquired": "2014-12-13"},
        "registration": "Empirical relative image registration to the existing ortho; prototype, absolute position unverified",
        "colorCoverage": "Partial color coverage: a grayscale strip from the merged source remains along the western edge",
        "colorMeaning": "Enhanced RGB with synthetic blue; not exact human-eye color or mineral abundance",
    }
    (destination / "manifest.json").write_text(json.dumps(image_manifest, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")
    provenance = {
        "kind": "prototype-enhanced-rgb-provenance", "source": inspection,
        "software": {"python": platform.python_version(), "numpy": np.__version__, "pillow": pillow_version},
        "pipeline_sha256": {name: sha(ROOT / "scripts/terrain" / name) for name in ("inspect_surface_color.py", "register_surface_color.py")},
        "relative_registration": result,
        "processing": "1m reduced-resolution JPEG2000 decode, projected AOI with margin, empirically fitted affine resampling, JPEG quality 95 with no chroma subsampling; no additional color enhancement",
        "registered_crop_identical_channels_fraction": float(np.mean(pixels.max(axis=2) == pixels.min(axis=2))),
        "coverage_note": "Identical-channel fraction is a pixel statistic, not a certified swath mask. Source grayscale pixels are preserved, not colorized.",
        "output_sha256": {name: sha(destination / name) for name in ("manifest.json", "rgb.jpg")},
    }
    (destination / "provenance.json").write_text(json.dumps(provenance, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")
    print("Independent RGB package:", destination)


if __name__ == "__main__":
    main()
