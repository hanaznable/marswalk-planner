"""Export the existing frontend contract v1 from real, configured local sources.

No changes to Developer Y's schema, frontend, or route algorithms.
"""

import argparse
import hashlib
import json
import math
import platform
from pathlib import Path

import numpy as np
from PIL import Image, __version__ as pillow_version

from plan_terrain_package import ROOT, build_plan, label_text, number
from terrain_config import load_config, workspace_path
from terrain_resampling import aggregate_terrain, axis_overlaps, horn_slope_with_halo


def export_package(config, output_dir, cell_size=5.0):
    plan = build_plan(config)
    geo = plan["georeferencing"]
    if geo["review_status"] != "accepted_for_prototype" or geo["working_origin_convention"] != "ua_pds_jp2":
        raise ValueError("This adapter needs an explicitly reviewed UA/JP2 prototype convention")
    for evidence in geo["review_evidence"]:
        if not workspace_path(ROOT, evidence).is_file():
            raise ValueError("Georeferencing evidence is missing")
    if not output_dir.resolve().is_relative_to((ROOT / "public/data").resolve()):
        raise ValueError("Outputs must be under public/data")
    if not math.isfinite(cell_size) or cell_size <= 0:
        raise ValueError("Routing cell size must be finite and positive")
    xmin, ymin, xmax, ymax = config["aoi"]["bounds_xy_m"]
    width, height = round((xmax - xmin) / cell_size), round((ymax - ymin) / cell_size)
    if width < 1 or height < 1 or not math.isclose(width * cell_size, xmax - xmin, abs_tol=1e-7) or not math.isclose(height * cell_size, ymax - ymin, abs_tol=1e-7):
        raise ValueError("AOI dimensions must be whole multiples of routing cell size; no implicit extent changes")
    if width * height > 4_000_000:
        raise ValueError("Requested package exceeds this adapter's explicit processing size limit")
    grid = plan["planned_grid"]
    source_size = grid["cell_size_m"]
    if cell_size < source_size:
        raise ValueError("Do not claim finer routing resolution than the native DEM")
    win = grid["source_window"]
    col, row, cols, rows = win["col_offset"], win["row_offset"], win["cols"], win["rows"]
    dem_path = workspace_path(ROOT, config["sources"]["dem"]["path"])
    label = label_text(dem_path, attached=True)
    source_rows, source_cols = int(number(label, "LINES")), int(number(label, "LINE_SAMPLES"))
    if col < 1 or row < 1 or col + cols >= source_cols or row + rows >= source_rows:
        raise ValueError("Need a real one-cell source halo for slope; no synthetic edge interpolation")
    offset = (int(number(label, "^IMAGE")) - 1) * int(number(label, "RECORD_BYTES"))
    source = np.memmap(dem_path, dtype="<f4", mode="r", offset=offset, shape=(source_rows, source_cols))
    z = np.array(source[row-1:row+rows+1, col-1:col+cols+1], dtype=np.float64)
    raw_valid = np.isfinite(z) & (z != plan["dem_coverage"]["source_nodata"])
    z[~raw_valid] = np.nan
    z = z * plan["source_dem_scale"] + plan["source_dem_offset"]
    if not np.isfinite(z[raw_valid]).all():
        raise ValueError("Source scale/offset produced invalid elevation values")
    native_slope = horn_slope_with_halo(z, source_size)
    native_elevation = z[1:-1, 1:-1]
    x0, y0 = grid["origin_upper_left_corner_xy_m"]
    xo = axis_overlaps(xmin, cell_size, width, x0, source_size, cols)
    # Use south-positive coordinates for overlap calculations along rows.
    yo = axis_overlaps(-ymax, cell_size, height, -y0, source_size, rows)
    elevation, slope = aggregate_terrain(native_elevation, native_slope, xo, yo)
    if np.isinf(elevation).any() or np.isinf(slope).any():
        raise ValueError("Infinite derived samples are forbidden")
    finite_s = slope[np.isfinite(slope)]
    if finite_s.size == 0 or np.any((finite_s < 0) | (finite_s > 90)):
        raise ValueError("No valid degree-valued slope layer")

    image_path = workspace_path(ROOT, config["sources"]["imagery"]["path"])
    with Image.open(image_path) as source_image:
        if source_image.mode != "L":
            raise ValueError("Only grayscale source imagery supported by this adapter")
        crop = source_image.crop((col, row, col + cols, row + rows))
    pixels = np.array(crop)
    if np.any(pixels == plan["imagery_quality_codes"]["null_code"]):
        raise ValueError("JPEG cannot retain null transparency; choose a fully covered AOI")
    image_width = min(2048, max(1, math.ceil((xmax - xmin) / source_size)))
    image_height = min(2048, max(1, math.ceil((ymax - ymin) / source_size)))
    # Fractional source pixel-edge crop: exact routing footprint, no coordinate drift.
    box = ((xmin-x0)/source_size, (y0-ymax)/source_size,
           (xmax-x0)/source_size, (y0-ymin)/source_size)
    basemap = crop.transform((image_width, image_height), Image.Transform.EXTENT, box,
                             resample=Image.Resampling.BILINEAR)
    gt = [xmin, cell_size, 0.0, ymax, 0.0, -cell_size]
    image_gt = [xmin, (xmax-xmin)/image_width, 0.0, ymax, 0.0, -(ymax-ymin)/image_height]
    output_dir.mkdir(parents=True, exist_ok=True)
    for filename, values in (("elevation.f32", elevation), ("slope.f32", slope)):
        encoded = np.asarray(values, dtype="<f4")
        encoded.tofile(output_dir / filename)
        decoded = np.fromfile(output_dir / filename, dtype="<f4").reshape((height, width))
        if not np.array_equal(encoded, decoded, equal_nan=True):
            raise RuntimeError("Float32 round-trip failed")
        if (output_dir / filename).stat().st_size != width * height * 4:
            raise RuntimeError("Unexpected Float32 byte count")
    basemap.save(output_dir / "basemap.jpg", quality=95)
    product_id = dem_path.stem
    manifest = {
        "contractVersion": 1, "id": config["id"] + "-v1",
        "title": config.get("title", config["id"]), "synthetic": False,
        "source": {"productId": product_id, "url": config["sources"]["dem"]["source_url"],
                   "attribution": config["sources"]["dem"]["attribution"]},
        "crs": {"name": "EQUIRECTANGULAR MARS", "wkt": plan["crs"]["wkt"]},
        "raster": {"width": width, "height": height, "geoTransform": gt},
        "layers": {"elevation": {"url": "elevation.f32", "dataType": "float32"},
                   "slope": {"url": "slope.f32", "dataType": "float32"}},
        "basemap": {"url": "basemap.jpg", "width": image_width, "height": image_height, "geoTransform": image_gt},
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")
    def summary(values):
        finite = values[np.isfinite(values)]
        return {"valid_cells": int(finite.size), "nodata_cells": int(values.size-finite.size),
                "min": float(finite.min()) if finite.size else None,
                "max": float(finite.max()) if finite.size else None,
                "median": float(np.median(finite)) if finite.size else None}
    provenance = {
        "package_status": "prototype terrain package; frontend integration pending",
        "software": {"python": platform.python_version(), "numpy": np.__version__, "pillow": pillow_version},
        "pipeline_sha256": {name: hashlib.sha256((ROOT / "scripts/terrain" / name).read_bytes()).hexdigest()
                            for name in ("export_terrain_v1.py", "terrain_resampling.py", "plan_terrain_package.py", "terrain_config.py")},
        "contract_version": 1, "sources": config["sources"], "source_checks": plan["input_verification"],
        "georeferencing": geo, "source_projection": plan["crs"],
        "source_reader_origin_xy_m": plan["observed_default_pds_origin_xy_m"],
        "working_origin_policy": "UA PDS_JP2 offsets applied to DEM pixel positions; source samples unchanged before aggregation",
        "source_cell_size_m": source_size, "source_window_with_halo": [col-1, row-1, cols+2, rows+2],
        "routing_cell_size_m": cell_size,
        "elevation_method": "Exact area-weighted mean of overlapping native DEM pixel footprints",
        "slope_method": "Native-resolution Horn 3x3 slope in degrees, then maximum across all native cells with positive overlap in each routing cell",
        "slope_semantics": "Conservative maximum native slope per routing cell, NOT slope of the averaged 5m DEM or an independently validated safety measure",
        "slope_reference": "https://gdal.org/en/stable/programs/gdaldem.html",
        "nodata_policy": "Any missing contributing elevation makes output elevation NaN; any missing 3x3 slope stencil or contributing slope makes output slope NaN; no gap filling",
        "edge_policy": "Real one-native-cell halo; no extrapolation at AOI boundary",
        "basemap_method": "Bilinear fractional crop to exact routing footprint; grayscale JPEG quality 95 for display only",
        "vertical_reference": "Mars 2000 equipotential surface, per source label; elevations in metres",
        "elevation_statistics": summary(elevation), "slope_statistics_degrees": summary(slope),
        "accuracy": "Absolute geolocation and image/DEM registration accuracy unverified; visual A/B review inconclusive",
        "limits": ["No validated hazard, thermal, mineral, resource-consumption or astronaut safety model.",
                   "Sub-cell hazards and DEM artifacts may remain; reduced grid is not a traversal certification.",
                   "Maximum-slope aggregation can block otherwise navigable parts of a coarse cell.",
                   "V1 manifest schema is unchanged; integration should expose these prototype limitations."],
    }
    provenance["output_sha256"] = {name: hashlib.sha256((output_dir/name).read_bytes()).hexdigest()
                                  for name in ("manifest.json", "elevation.f32", "slope.f32", "basemap.jpg")}
    (output_dir / "provenance.json").write_text(json.dumps(provenance, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")
    return manifest, provenance


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--cell-size", type=float, default=5.0)
    args = parser.parse_args()
    config = load_config(workspace_path(ROOT, args.config))
    manifest, report = export_package(config, workspace_path(ROOT, args.output_dir), args.cell_size)
    print("Contract v1 package:", args.output_dir)
    print("Grid:", manifest["raster"])
    print("Elevation:", report["elevation_statistics"])
    print("Slope:", report["slope_statistics_degrees"])


if __name__ == "__main__":
    main()
