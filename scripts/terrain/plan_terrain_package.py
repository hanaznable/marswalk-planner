"""Validate local inputs and write a package plan, not frontend assets.

python scripts/terrain/plan_terrain_package.py --config scripts/terrain/regions/pahrump-hills.json

The first input adapter supports square, north-up, uncompressed single-band
HiRISE PDS3 PC_REAL rasters. Other input formats need an explicit adapter;
region-independent does not imply every planetary product is supported.
"""

import argparse
import hashlib
import json
import math
import re
import struct
from pathlib import Path

import numpy as np

from terrain_config import covering_grid, load_config, workspace_path

ROOT = Path(__file__).resolve().parents[2]


def label_text(path, attached=False):
    if not attached:
        return path.read_text(encoding="utf-8")
    with path.open("rb") as stream:
        text = stream.read(1024 * 1024).decode("ascii", errors="replace")
    match = re.search(r"^END\s*$", text, re.M)
    if not match:
        raise ValueError("No complete PDS label found in first MiB")
    return text[:match.end()]


def value(label, key):
    found = re.search(r"^\s*" + re.escape(key) + r"\s*=\s*([^\r\n]+)", label, re.M)
    if found is None:
        raise ValueError(f"Missing PDS keyword: {key}")
    return found.group(1).strip().strip('"')


def number(label, key):
    result = float(value(label, key).split()[0])
    if not math.isfinite(result):
        raise ValueError(f"Nonfinite PDS keyword: {key}")
    return result


def checked_source(source):
    path = workspace_path(ROOT, source["path"])
    with path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != source["sha256"]:
        raise ValueError(f"Source checksum mismatch: {source['path']}")
    return path


def build_plan(config):
    dem_path = checked_source(config["sources"]["dem"])
    imagery_path = checked_source(config["sources"]["imagery"])
    dem_label = label_text(dem_path, attached=True)
    image_label_path = workspace_path(ROOT, config["sources"]["imagery"]["label_path"])
    image_label = label_text(image_label_path)
    if value(dem_label, "SAMPLE_TYPE") != "PC_REAL" or number(dem_label, "SAMPLE_BITS") != 32:
        raise ValueError("This adapter requires Float32 little-endian PDS samples")
    if number(dem_label, "BANDS") != 1 or number(dem_label, "MAP_PROJECTION_ROTATION") != 0:
        raise ValueError("This adapter requires a single-band north-up raster")
    if "<METERS/PIXEL>" not in value(dem_label, "MAP_SCALE"):
        raise ValueError("This adapter requires explicit metre pixel spacing")
    if value(dem_label, "MAP_PROJECTION_TYPE") != "EQUIRECTANGULAR":
        raise ValueError("This adapter currently supports Equirectangular only")
    if number(dem_label, "CENTER_LATITUDE") != 0:
        raise ValueError("Nonzero standard parallel needs a separate projection adapter")
    if value(dem_label, "TARGET_NAME") != config["body"].upper():
        raise ValueError("Source/config planetary body mismatch")
    for key in ("A_AXIS_RADIUS", "B_AXIS_RADIUS", "C_AXIS_RADIUS", "CENTER_LATITUDE",
                "CENTER_LONGITUDE", "MAP_SCALE", "LINE_PROJECTION_OFFSET",
                "SAMPLE_PROJECTION_OFFSET", "MAP_PROJECTION_ROTATION"):
        if number(dem_label, key) != number(image_label, key):
            raise ValueError(f"DEM/imagery label mismatch: {key}")
    radius = number(dem_label, "A_AXIS_RADIUS") * 1000
    if any(number(dem_label, key) * 1000 != radius for key in ("B_AXIS_RADIUS", "C_AXIS_RADIUS")):
        raise ValueError("This adapter requires the label's spherical projection")
    rows, cols = int(number(dem_label, "LINES")), int(number(dem_label, "LINE_SAMPLES"))
    if (int(number(image_label, "LINE_LAST_PIXEL")), int(number(image_label, "SAMPLE_LAST_PIXEL"))) != (rows, cols):
        raise ValueError("DEM and ortho dimensions differ")
    cell_size = number(dem_label, "MAP_SCALE")
    sample_offset = number(dem_label, "SAMPLE_PROJECTION_OFFSET")
    line_offset = number(dem_label, "LINE_PROJECTION_OFFSET")
    convention = config["georeferencing"]["working_origin_convention"]
    shift = -1.0 if convention == "ua_pds_jp2" else 0.5
    origin = [-cell_size * (sample_offset + shift), cell_size * (line_offset + shift)]
    grid = covering_grid(config["aoi"]["bounds_xy_m"], origin, cell_size, cols, rows)
    offset = (int(number(dem_label, "^IMAGE")) - 1) * int(number(dem_label, "RECORD_BYTES"))
    if dem_path.stat().st_size != offset + rows * cols * 4:
        raise ValueError("Source file size does not match the declared raster layout")
    missing = struct.unpack(">f", bytes.fromhex(value(dem_label, "MISSING_CONSTANT").split("#")[1]))[0]
    dem = np.memmap(dem_path, dtype="<f4", mode="r", offset=offset, shape=(rows, cols))
    win = grid["source_window"]
    r0, c0 = win["row_offset"], win["col_offset"]
    block = dem[r0:r0 + win["rows"], c0:c0 + win["cols"]]
    mask = np.isfinite(block) & (block != missing)
    # Reflectance image display must retain the label's null/saturation semantics.
    image_quality = {"null_code": int(number(image_label, "CORE_NULL")),
                     "low_saturation_code": int(number(image_label, "CORE_LOW_REPR_SATURATION")),
                     "high_saturation_code": int(number(image_label, "CORE_HIGH_REPR_SATURATION"))}
    blockers = []
    if config["georeferencing"]["review_status"] != "accepted_for_prototype":
        blockers.append("Working origin convention requires documented review before frontend export")
    if not mask.all():
        blockers.append("Requested grid contains missing DEM samples; an explicit valid-data policy is needed")
    blockers.append("Frontend data contract must be coordinated with Developer Y before integration")
    lon0 = number(dem_label, "CENTER_LONGITUDE")
    wkt = (f'PROJCS["Mars Equirectangular",GEOGCS["Mars",DATUM["Mars sphere",'
           f'SPHEROID["Mars label sphere",{radius},0]],PRIMEM["Reference meridian",0],'
           f'UNIT["degree",0.0174532925199433]],PROJECTION["Equirectangular"],'
           f'PARAMETER["standard_parallel_1",0],PARAMETER["central_meridian",{lon0}],'
           'PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1]]')
    return {
        "schema_version": 1, "kind": "terrain-package-plan", "id": config["id"], "body": config["body"],
        "status": "review_required", "frontend_ready": False,
        "requested_bounds_xy_m": config["aoi"]["bounds_xy_m"], "planned_grid": grid,
        "crs": {"wkt": wkt, "units": "metre", "radius_m": radius, "central_meridian_deg": lon0},
        "georeferencing": config["georeferencing"],
        "observed_default_pds_origin_xy_m": [-cell_size * (sample_offset + 0.5), cell_size * (line_offset + 0.5)],
        "vertical_units": "metre", "source_dem_scale": number(dem_label, "SCALING_FACTOR"),
        "source_dem_offset": number(dem_label, "OFFSET"),
        "dem_coverage": {"cells": int(mask.size), "valid_cells": int(mask.sum()),
                         "missing_or_nonfinite_cells": int((~mask).sum()),
                         "source_nodata": missing},
        "imagery_quality_codes": image_quality,
        "sources": config["sources"],
        "input_verification": {"dem_sha256": "matched", "imagery_sha256": "matched",
                               "imagery_label_sha256": hashlib.sha256(image_label_path.read_bytes()).hexdigest(),
                               "imagery_bytes": imagery_path.stat().st_size},
        "optional_layers": config.get("optional_layers", []),
        "blockers": blockers,
        "notes": ["Planning only: no raster resampling, clipping export, slope calculation or frontend changes.",
                  "Native pixel window may slightly exceed requested AOI; both bounds are preserved.",
                  "A grid with valid samples is not a terrain safety certification."]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, help="Workspace-relative region config")
    parser.add_argument("--output", help="Workspace-relative JSON report path")
    args = parser.parse_args()
    config = load_config(workspace_path(ROOT, args.config))
    plan = build_plan(config)
    output = workspace_path(ROOT, args.output or f"docs/terrain/{config['id']}-package-plan.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(plan, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print("Plan:", output)
    print("Grid:", plan["planned_grid"]["cols"], "x", plan["planned_grid"]["rows"])
    print("Missing DEM cells:", plan["dem_coverage"]["missing_or_nonfinite_cells"])
    for blocker in plan["blockers"]:
        print("REVIEW:", blocker)


if __name__ == "__main__":
    main()
