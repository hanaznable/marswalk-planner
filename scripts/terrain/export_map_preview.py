"""Export a real ortho image and explicit Mars-grid manifest for prototype review.

No frontend code, route grids, source rasters or elevation samples are modified.
Requires NumPy and Pillow; sources and region config are explicit local inputs.
"""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

from plan_terrain_package import ROOT, build_plan
from terrain_config import load_config, workspace_path


def export_preview(config, output_dir):
    plan = build_plan(config)
    geo = plan["georeferencing"]
    if geo["review_status"] != "accepted_for_prototype":
        raise ValueError("Document a prototype origin decision before exporting")
    for evidence in geo["review_evidence"]:
        if not workspace_path(ROOT, evidence).is_file():
            raise ValueError("Referenced georeferencing review evidence does not exist")
    # This adapter uses the matching-label pixel indices without resampling.
    # A different origin policy needs an explicit imagery mapping adapter.
    if geo["working_origin_convention"] != "ua_pds_jp2":
        raise ValueError("This exporter currently requires the matched UA/JP2 working grid")
    if plan["dem_coverage"]["missing_or_nonfinite_cells"]:
        raise ValueError("DEM coverage has missing data; resolve the export policy first")
    if not output_dir.resolve().is_relative_to((ROOT / "public/data").resolve()):
        raise ValueError("Map preview outputs must be under public/data")

    grid = plan["planned_grid"]
    win = grid["source_window"]
    col, row, cols, rows = win["col_offset"], win["row_offset"], win["cols"], win["rows"]
    image_path = workspace_path(ROOT, config["sources"]["imagery"]["path"])
    with Image.open(image_path) as source:
        if source.mode != "L" or col + cols > source.width or row + rows > source.height:
            raise ValueError("Unexpected imagery encoding or insufficient coverage")
        crop = source.crop((col, row, col + cols, row + rows))
        pixels = np.array(crop)
    codes = plan["imagery_quality_codes"]
    valid = pixels != codes["null_code"]
    alpha = Image.fromarray(valid.astype(np.uint8) * 255)
    preview = Image.merge("LA", (crop, alpha))
    output_dir.mkdir(parents=True, exist_ok=True)
    image_output = output_dir / "imagery.png"
    preview.save(image_output)
    with Image.open(image_output) as check:
        decoded = np.array(check)
        if check.size != (cols, rows) or not np.array_equal(decoded[:, :, 0], pixels):
            raise RuntimeError("PNG pixel-preservation check failed")
        if not np.array_equal(decoded[:, :, 1] != 0, valid):
            raise RuntimeError("PNG transparency check failed")

    manifest = {
        "schema_version": 1, "kind": "mars-map-preview", "id": config["id"], "body": "Mars",
        "status": "prototype-preview", "integration_status": "awaiting Developer Y data-contract coordination",
        "crs": plan["crs"], "grid": grid,
        "requested_aoi_bounds_xy_m": plan["requested_bounds_xy_m"],
        "imagery": {"path": "imagery.png", "width": cols, "height": rows,
                    "encoding": "8-bit grayscale PNG with alpha; decoded source DN preserved",
                    "resampling": "none", "null_pixels": int((~valid).sum()),
                    "low_saturation_pixels": int((pixels == codes["low_saturation_code"]).sum()),
                    "high_saturation_pixels": int((pixels == codes["high_saturation_code"]).sum()),
                    "sha256": hashlib.sha256(image_output.read_bytes()).hexdigest(),
                    "attribution": config["sources"]["imagery"]["attribution"]},
        "georeferencing": geo,
        "accuracy": {"absolute_geolocation": "not independently verified",
                     "image_dem_registration": "A/B visual comparison inconclusive; working convention documented",
                     "numerical_accuracy_m": None},
        "provenance": {"sources": config["sources"], "source_checks": plan["input_verification"],
                       "dem_coverage_check": plan["dem_coverage"],
                       "raw_pds_reader_origin_xy_m": plan["observed_default_pds_origin_xy_m"]},
        "available_assets": ["imagery"],
        "not_exported": ["elevation", "slope", "hazards", "science targets", "EVA routes"],
        "limitations": ["Prototype imagery package; not a validated operational navigation product.",
                        "Bounds are projected Mars metres, not Earth latitude/longitude.",
                        "Actual footprint covers whole native cells and slightly exceeds the requested AOI.",
                        "Curiosity data is not required to load or export this package.",
                        "Source grayscale values are not mineral or thermal measurements."],
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    config = load_config(workspace_path(ROOT, args.config))
    output_dir = workspace_path(ROOT, args.output_dir)
    result = export_preview(config, output_dir)
    print("Prototype map preview:", output_dir)
    print("PNG dimensions:", result["imagery"]["width"], "x", result["imagery"]["height"])
    print("PNG null pixels:", result["imagery"]["null_pixels"])
    print("PNG pixel preservation and alpha: verified")
    print("Frontend integration pending; no route/elevation/slope assets exported")


if __name__ == "__main__":
    main()
