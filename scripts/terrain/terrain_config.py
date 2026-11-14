"""Region-independent configuration and grid planning; no React or GDAL imports."""

import json
import math
import re
from pathlib import Path


def finite_number(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number")
    return float(value)


def workspace_path(root, relative):
    if not isinstance(relative, str) or not relative:
        raise ValueError("Expected a non-empty workspace-relative path")
    path = Path(relative)
    if path.is_absolute():
        raise ValueError("Paths must be workspace-relative")
    resolved = (root / path).resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise ValueError("Path escapes the workspace")
    return resolved


def validate_config(config):
    if config.get("schema_version") != 1:
        raise ValueError("Unsupported terrain configuration schema")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", config.get("id", "")):
        raise ValueError("Region id must be a lowercase slug")
    if config.get("body") != "Mars":
        raise ValueError("Only Mars terrain packages are currently supported")
    bounds = config.get("aoi", {}).get("bounds_xy_m")
    if not isinstance(bounds, list) or len(bounds) != 4:
        raise ValueError("AOI needs [xmin, ymin, xmax, ymax]")
    xmin, ymin, xmax, ymax = [finite_number(v, "AOI bound") for v in bounds]
    if xmin >= xmax or ymin >= ymax:
        raise ValueError("AOI bounds must have positive width and height")
    if config.get("grid", {}).get("strategy") != "native_dem_covering_window":
        raise ValueError("Only a native DEM window is supported; resampling is not implicit")
    geo = config.get("georeferencing", {})
    if geo.get("working_origin_convention") not in ("ua_pds_jp2", "gdal_pds_default"):
        raise ValueError("An explicit supported origin convention is required")
    if geo.get("review_status") not in ("pending", "accepted_for_prototype"):
        raise ValueError("An explicit georeferencing review status is required")
    if not isinstance(geo.get("rationale"), str) or not geo["rationale"].strip():
        raise ValueError("Document the origin interpretation rationale")
    if geo["review_status"] == "accepted_for_prototype" and not geo.get("review_evidence"):
        raise ValueError("Accepting a convention requires documented review evidence")
    sources = config.get("sources", {})
    for key in ("dem", "imagery"):
        source = sources.get(key, {})
        if not all(isinstance(source.get(field), str) and source[field].strip()
                   for field in ("path", "source_url", "attribution", "sha256")):
            raise ValueError(f"{key} needs path, source URL, attribution and SHA-256")
        if not re.fullmatch(r"[a-f0-9]{64}", source["sha256"]):
            raise ValueError(f"Invalid {key} SHA-256")
    if not sources["imagery"].get("label_path"):
        raise ValueError("A matching imagery PDS label is required")
    return config


def load_config(path):
    return validate_config(json.loads(path.read_text(encoding="utf-8")))


def covering_grid(bounds, source_origin, cell_size, source_cols, source_rows):
    """Cover the requested AOI with complete source pixels; no interpolation."""
    size = finite_number(cell_size, "cell size")
    if size <= 0:
        raise ValueError("Cell size must be positive")
    for value in (source_rows, source_cols):
        if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
            raise ValueError("Source dimensions must be positive integers")
    if len(bounds) != 4 or len(source_origin) != 2:
        raise ValueError("Invalid bounds or source origin")
    xmin, ymin, xmax, ymax = [finite_number(v, "bound") for v in bounds]
    x0, y0 = [finite_number(v, "origin") for v in source_origin]
    if xmin >= xmax or ymin >= ymax:
        raise ValueError("Invalid AOI bounds")
    # Avoid an extra cell when a computed coordinate is numerically at a grid edge.
    def edge(value, rounding):
        nearest = round(value)
        return nearest if math.isclose(value, nearest, rel_tol=0, abs_tol=1e-8) else rounding(value)

    c0, c1 = edge((xmin - x0) / size, math.floor), edge((xmax - x0) / size, math.ceil)
    r0, r1 = edge((y0 - ymax) / size, math.floor), edge((y0 - ymin) / size, math.ceil)
    if not (0 <= c0 < c1 <= source_cols and 0 <= r0 < r1 <= source_rows):
        raise ValueError("AOI is outside DEM coverage; do not silently clamp it")
    return {
        "rows": r1 - r0, "cols": c1 - c0, "cell_size_m": size,
        "source_window": {"col_offset": c0, "row_offset": r0, "cols": c1 - c0, "rows": r1 - r0},
        "origin_upper_left_corner_xy_m": [x0 + c0 * size, y0 - r0 * size],
        "bounds_xy_m": [x0 + c0 * size, y0 - r1 * size, x0 + c1 * size, y0 - r0 * size],
        "row_direction": "south", "col_direction": "east", "array_order": "row-major",
        "pixel_reference": "outer corner for origin; center at (col+0.5, row+0.5)",
    }
