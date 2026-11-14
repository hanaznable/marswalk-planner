"""Read GeoJP2 metadata and inspect a real HiRISE RGB crop against the ortho.

This is a diagnostic, not automatic orthorectification or approval. Requires
NumPy and Pillow/OpenJPEG, already used by the terrain pipeline. No downloads.
"""

import hashlib
import io
import json
import math
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
GEOTIFF_UUID = bytes.fromhex("b14bf8bd083d4b43a5ae8cd7d5a6ce03")


def sha(path):
    return hashlib.file_digest(path.open("rb"), "sha256").hexdigest()


def read_geojp2(path):
    """Read a bounded GeoTIFF UUID box without decoding image samples."""
    size = path.stat().st_size
    with path.open("rb") as stream:
        position = 0
        while position < size:
            stream.seek(position)
            header = stream.read(8)
            if len(header) != 8:
                raise ValueError("Truncated JP2 box")
            length, kind = struct.unpack(">I4s", header)
            header_length = 8
            if length == 1:
                length = struct.unpack(">Q", stream.read(8))[0]
                header_length = 16
            if length == 0:
                length = size - position
            if length < header_length or position + length > size:
                raise ValueError("Invalid JP2 box length")
            if kind == b"uuid" and stream.read(16) == GEOTIFF_UUID:
                if length > 1024 * 1024:
                    raise ValueError("Unexpectedly large GeoJP2 metadata")
                payload = stream.read(length - header_length - 16)
                with Image.open(io.BytesIO(payload)) as metadata:
                    tags = dict(metadata.tag_v2)
                directory, doubles = tags[34735], tags[34736]
                keys = {}
                for i in range(directory[3]):
                    key, location, count, offset = directory[4 + i*4:8 + i*4]
                    if count != 1:
                        continue
                    if location == 0:
                        keys[key] = offset
                    elif location == 34736:
                        keys[key] = doubles[offset]
                if (keys.get(1025) != 1 or keys.get(3075) != 17 or
                        keys.get(3076) != 9001 or keys.get(3089) != 0 or
                        keys.get(3082) != 0 or keys.get(3083) != 0 or
                        keys.get(2057) != keys.get(2058)):
                    raise ValueError("Adapter requires pixel-area, metre, spherical equirectangular with zero latitude/offsets")
                scale, tie = tags[33550], tags[33922]
                if len(tie) != 6 or scale[0] <= 0 or scale[1] <= 0:
                    raise ValueError("Unsupported pixel scale/tie points")
                return {"geoTransform": [tie[3] - tie[0] * scale[0], scale[0], 0,
                                         tie[4] + tie[1] * scale[1], 0, -scale[1]],
                        "radius_m": keys[2057], "central_meridian_deg": keys[3088],
                        "pixel_interpretation": "PixelIsArea", "metadata_source": "embedded GeoJP2"}
            position += length
    raise ValueError("No supported embedded GeoJP2 metadata")


def phase_shift(reference, moving, limit=32):
    """Integer-pixel diagnostic translation of moving onto reference, not a correction."""
    if reference.shape != moving.shape or reference.ndim != 2:
        raise ValueError("Diagnostic patches must have the same 2D shape")
    window = np.outer(np.hanning(reference.shape[0]), np.hanning(reference.shape[1]))
    a = (reference - reference.mean()) * window
    b = (moving - moving.mean()) * window
    cross = np.fft.fft2(a) * np.conj(np.fft.fft2(b))
    correlation = np.fft.fftshift(np.fft.ifft2(cross / np.maximum(np.abs(cross), 1e-12)).real)
    cy, cx = np.array(correlation.shape) // 2
    search = correlation[cy-limit:cy+limit+1, cx-limit:cx+limit+1]
    row, col = np.unravel_index(np.argmax(search), search.shape)
    dy, dx = int(row) - limit, int(col) - limit
    # Independent standardized pixel correlation on the overlapping portion.
    ay = slice(max(0, dy), min(reference.shape[0], reference.shape[0] + dy))
    ax = slice(max(0, dx), min(reference.shape[1], reference.shape[1] + dx))
    by = slice(max(0, -dy), min(reference.shape[0], reference.shape[0] - dy))
    bx = slice(max(0, -dx), min(reference.shape[1], reference.shape[1] - dx))
    aligned = float(np.corrcoef(reference[ay, ax].ravel(), moving[by, bx].ravel())[0, 1])
    original = float(np.corrcoef(reference.ravel(), moving.ravel())[0, 1])
    return {"moving_to_reference_shift_col_px": dx, "moving_to_reference_shift_row_px": dy,
            "zero_shift_correlation": original, "diagnostic_shift_correlation": aligned,
            "search_boundary_peak": abs(dx) == limit or abs(dy) == limit}


def main():
    source = ROOT / "data/raw/pahrump-hills/color-research/ESP_039280_1755_MRGB.JP2"
    label = source.with_suffix(".LBL")
    package_dir = ROOT / "public/data/gale/pahrump-hills-v1"
    manifest_path = package_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    plan = json.loads((ROOT / "docs/terrain/pahrump-hills-package-plan.json").read_text(encoding="utf-8"))
    metadata = read_geojp2(source)
    if (metadata["radius_m"] != plan["crs"]["radius_m"] or
            plan["crs"]["wkt"] != manifest["crs"]["wkt"] or
            'PARAMETER["standard_parallel_1",0]' not in plan["crs"]["wkt"]):
        raise ValueError("Unreviewed projection parameters")
    gt = metadata["geoTransform"]
    tx, dx, rx, ty, ry, dy = manifest["raster"]["geoTransform"]
    if rx or ry:
        raise ValueError("Rotated target not supported")
    xmin, ymax = tx, ty
    xmax = tx + dx * manifest["raster"]["width"]
    ymin = ty + dy * manifest["raster"]["height"]
    # Identical spherical projections differ only in their longitude origin.
    source_x_in_target = gt[0] + metadata["radius_m"] * math.radians(metadata["central_meridian_deg"] - plan["crs"]["central_meridian_deg"])
    output = source.parent / "validation-preview"
    output.mkdir(exist_ok=True)
    saved_limit = Image.MAX_IMAGE_PIXELS
    try:
        Image.MAX_IMAGE_PIXELS = 400_000_000
        with Image.open(source) as image:
            if image.mode != "RGB" or image.size != (13215, 28027):
                raise ValueError("Unexpected downloaded source dimensions/bands")
            # JPEG2000 reduced-resolution decode: 0.5 m native -> 1 m preview.
            image.reduce = 1
            sx, sy = gt[1] * 2, -gt[5] * 2
            box = ((xmin-source_x_in_target)/sx, (gt[3]-ymax)/sy,
                   (xmax-source_x_in_target)/sx, (gt[3]-ymin)/sy)
            if box[0] < 0 or box[1] < 0 or box[2] > math.ceil(13215/2) or box[3] > math.ceil(28027/2):
                raise ValueError("AOI not fully inside source raster envelope")
            print("Decoding RGB at 1 m for a 1000 x 1000 diagnostic crop", flush=True)
            margin = 400
            expanded_box = (box[0]-margin, box[1]-margin, box[2]+margin, box[3]+margin)
            if expanded_box[0] < 0 or expanded_box[1] < 0 or expanded_box[2] > math.ceil(13215/2) or expanded_box[3] > math.ceil(28027/2):
                raise ValueError("Need source pixels around AOI for registration diagnostics")
            expanded = image.transform((1800, 1800), Image.Transform.EXTENT, expanded_box, resample=Image.Resampling.BILINEAR)
            expanded.save(output / "rgb-envelope-margin.png")
            rgb = expanded.crop((margin, margin, margin+1000, margin+1000))
    finally:
        Image.MAX_IMAGE_PIXELS = saved_limit
    rgb.save(output / "rgb-georeferenced.png")
    with Image.open(package_dir / "basemap.jpg") as image:
        gray = image.convert("L").resize(rgb.size, Image.Resampling.BILINEAR)
    red = rgb.getchannel("R")
    a = np.asarray(gray, dtype=float) - np.asarray(gray.filter(ImageFilter.GaussianBlur(3)), dtype=float)
    b = np.asarray(red, dtype=float) - np.asarray(red.filter(ImageFilter.GaussianBlur(3)), dtype=float)
    global_check = phase_shift(a, b, 350)
    shift_x = global_check["moving_to_reference_shift_col_px"]
    shift_y = global_check["moving_to_reference_shift_row_px"]
    shifted = expanded.crop((400-shift_x, 400-shift_y, 1400-shift_x, 1400-shift_y))
    shifted.save(output / "rgb-global-diagnostic.png")
    shifted_red = shifted.getchannel("R")
    shifted_highpass = np.asarray(shifted_red, dtype=float) - np.asarray(shifted_red.filter(ImageFilter.GaussianBlur(3)), dtype=float)
    checks = []
    for cy in (200, 500, 800):
        for cx in (200, 500, 800):
            patch = (slice(cy-128, cy+128), slice(cx-128, cx+128))
            checks.append({"patch_centre_col_row": [cx, cy],
                           "raw": phase_shift(a[patch], b[patch]),
                           "after_global_diagnostic": phase_shift(a[patch], shifted_highpass[patch])})
    pixels = np.asarray(rgb).astype(np.int16)
    spread = pixels.max(axis=2) - pixels.min(axis=2)
    gray_rgb = gray.convert("RGB")
    Image.blend(gray_rgb, rgb, 0.5).save(output / "alignment-blend.png")
    pair = Image.new("RGB", (2000, 1000))
    pair.paste(gray_rgb, (0, 0)); pair.paste(rgb, (1000, 0))
    pair.save(output / "gray-rgb-side-by-side.jpg", quality=95)
    result = {
        "status": "diagnostic-only-not-orthorectification-approval", "source": source.name,
        "source_sha256": sha(source), "label_sha256": sha(label),
        "terrainManifestSha256": sha(manifest_path), "source_metadata": metadata,
        "source_origin_in_target_crs": [source_x_in_target, gt[3]],
        "diagnostic_pixel_size_m": 1, "output_geoTransform": [xmin, 1, 0, ymax, 0, -1],
        "crop_box_reduced_source_pixels": box,
        "pixel_statistics": {
            "all_channels_zero_fraction": float(np.mean(np.all(pixels == 0, axis=2))),
            "all_channels_identical_fraction": float(np.mean(spread == 0)),
            "channel_spread_above_3_fraction": float(np.mean(spread > 3)),
            "interpretation": "Chromatic variation diagnostics only; not a certified color-swath or validity mask",
        },
        "registration_patches": checks,
        "global_diagnostic": global_check,
        "diagnostic_output_sha256": {name: sha(output / name) for name in ("rgb-envelope-margin.png", "rgb-georeferenced.png", "rgb-global-diagnostic.png", "alignment-blend.png", "gray-rgb-side-by-side.jpg")},
        "caveats": ["No map asset has been corrected; the translated image is a diagnostic only", "Map-projected MRGB is not the matching DEM orthoimage", "Phase-correlation peaks require inspection and do not certify absolute accuracy"],
    }
    report = ROOT / "docs/terrain/surface-color-inspection.json"
    report.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(result, indent=2), flush=True)


if __name__ == "__main__":
    main()
