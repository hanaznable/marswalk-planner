"""Build a documented candidate AOI, without cropping or modifying source rasters.

Run from any directory: python scripts/terrain/select_pahrump_aoi.py
Requires NumPy. Optional preview requires Matplotlib and Pillow.
NASA source downloads must already be present in data/raw/pahrump-hills.
"""

import hashlib
import json
import math
import re
import struct
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data/raw/pahrump-hills"
OUT = ROOT / "docs/terrain"
DEM = "DTEEC_040770_1755_039280_1755_A01.IMG"
ORTHOS = ["ESP_039280_1755_RED_C_02_ORTHO", "ESP_040770_1755_RED_C_02_ORTHO"]
WAYPOINT_URL = "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json"
TRAVERSE_URL = "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json"
DRILL_URL = "https://assets.science.nasa.gov/content/dam/science/cds/researchers/nac/pac/2020/06-Meyer-PAC-Mars_Science_8-2020_v9_Tagged.pdf"
RADIUS = 3396190.0
LON0 = 137.39
WKT = ('PROJCS["EQUIRECTANGULAR MARS",GEOGCS["GCS_MARS",'
       'DATUM["D_MARS",SPHEROID["MARS_localRadius",3396190,0]],'
       'PRIMEM["Reference_Meridian",0],UNIT["degree",0.0174532925199433]],'
       'PROJECTION["Equirectangular"],PARAMETER["standard_parallel_1",0],'
       'PARAMETER["central_meridian",137.39],PARAMETER["false_easting",0],'
       'PARAMETER["false_northing",0],UNIT["metre",1],'
       'AXIS["Easting",EAST],AXIS["Northing",NORTH]]')


def label_value(text, key):
    match = re.search(r"^\s*" + re.escape(key) + r"\s*=\s*([^\r\n]+)", text, re.M)
    if match is None:
        raise ValueError(f"Missing PDS label keyword: {key}")
    return match.group(1).strip()


def number(text, key):
    return float(label_value(text, key).split()[0])


def project(coordinate):
    lon, lat = coordinate[:2]
    return [RADIUS * math.radians(lon - LON0), RADIUS * math.radians(lat)]


def clip_segment(a, b, bounds):
    """Liang-Barsky clipping; retain measured geometry, not waypoint connectors."""
    xmin, ymin, xmax, ymax = bounds
    dx, dy = b[0] - a[0], b[1] - a[1]
    lower, upper = 0.0, 1.0
    for p, q in zip((-dx, dx, -dy, dy),
                    (a[0] - xmin, xmax - a[0], a[1] - ymin, ymax - a[1])):
        if p == 0:
            if q < 0:
                return None
            continue
        ratio = q / p
        if p < 0:
            lower = max(lower, ratio)
        else:
            upper = min(upper, ratio)
        if lower > upper:
            return None
    if lower == upper:
        return None
    return [[a[0] + lower * dx, a[1] + lower * dy],
            [a[0] + upper * dx, a[1] + upper * dy]]


def window(bounds, origin, scale, width, height):
    xmin, ymin, xmax, ymax = bounds
    x0, y0 = origin
    result = [math.floor((xmin - x0) / scale), math.floor((y0 - ymax) / scale),
              math.ceil((xmax - x0) / scale), math.ceil((y0 - ymin) / scale)]
    c0, r0, c1, r1 = result
    if not (0 <= c0 < c1 <= width and 0 <= r0 < r1 <= height):
        raise ValueError("Candidate AOI extends outside raster coverage")
    return result


def main():
    waypoints = json.loads((RAW / "MSL_waypoints.json").read_text(encoding="utf-8"))
    traverse = json.loads((RAW / "MSL_traverse.json").read_text(encoding="utf-8"))
    campaign = [f for f in waypoints["features"] if 753 <= f["properties"]["sol"] <= 923]
    if not campaign:
        raise ValueError("No Pahrump Hills campaign waypoints in source")
    xy = np.array([project(f["geometry"]["coordinates"]) for f in campaign])
    center = (xy.min(axis=0) + xy.max(axis=0)) / 2
    bounds = [float(center[0] - 500), float(center[1] - 500),
              float(center[0] + 500), float(center[1] + 500)]
    if np.any(xy.max(axis=0) - xy.min(axis=0) > 1000):
        raise ValueError("Campaign does not fit in a 1 km square")

    # Cross-check the source's projected properties against the chosen sphere.
    residual = max(max(abs(f["properties"]["easting"] - RADIUS * math.radians(f["geometry"]["coordinates"][0])),
                       abs(f["properties"]["northing"] - project(f["geometry"]["coordinates"])[1]))
                   for f in campaign)
    if residual > 0.01:
        raise ValueError("Waypoint coordinates inconsistent with the assumed Mars projection")

    # These site/drive associations were visually checked on slide 5 of the NASA
    # source PDF. They identify rover poses associated with drilling, not holes.
    mappings = [("Confidence Hills", "42_1020", 759),
                ("Mojave 2", "45_0", 882), ("Telegraph Peak", "45_450", 908)]
    targets = []
    for name, rmc, drill_sol in mappings:
        matches = [f for f in campaign if f["properties"]["RMC"] == rmc]
        if len(matches) != 1:
            raise ValueError(f"Expected one waypoint for {name}, {rmc}")
        feature = matches[0]
        targets.append({"name": name, "rmc": rmc, "drill_sol": drill_sol,
                        "waypoint_sol": feature["properties"]["sol"],
                        "coordinate_role": "associated rover pose, not exact drill-hole position",
                        "lon_lat": feature["geometry"]["coordinates"][:2],
                        "xy_m": project(feature["geometry"]["coordinates"]),
                        "activity": "Drilled rock sample collected for laboratory analysis",
                        "association_source": DRILL_URL, "association_source_page": 5})

    segments = []
    for feature in traverse["features"]:
        geometry = feature["geometry"]
        if geometry["type"] == "LineString":
            lines = [geometry["coordinates"]]
        elif geometry["type"] == "MultiLineString":
            lines = geometry["coordinates"]
        else:
            raise ValueError("Unexpected NASA traverse geometry")
        for line in lines:
            points = [project(point) for point in line]
            for a, b in zip(points, points[1:]):
                clipped = clip_segment(a, b, bounds)
                if clipped is not None:
                    segments.append(clipped)
    if not segments:
        raise ValueError("No measured traverse intersects candidate AOI")

    with (RAW / DEM).open("rb") as stream:
        header = stream.read(24880).decode("ascii")
    width, height = int(number(header, "LINE_SAMPLES")), int(number(header, "LINES"))
    if label_value(header, "SAMPLE_TYPE") != "PC_REAL" or number(header, "SAMPLE_BITS") != 32:
        raise ValueError("Unsupported DEM encoding")
    scale = number(header, "MAP_SCALE")
    for key, expected in [("A_AXIS_RADIUS", RADIUS / 1000), ("CENTER_LONGITUDE", LON0),
                          ("CENTER_LATITUDE", 0), ("MAP_PROJECTION_ROTATION", 0)]:
        if number(header, key) != expected:
            raise ValueError(f"Unexpected DEM projection: {key}")
    offset = (int(number(header, "^IMAGE")) - 1) * int(number(header, "RECORD_BYTES"))
    if (RAW / DEM).stat().st_size != offset + width * height * 4:
        raise ValueError("DEM length differs from label")
    missing = struct.unpack(">f", bytes.fromhex(label_value(header, "MISSING_CONSTANT").split("#")[1]))[0]
    dem = np.memmap(RAW / DEM, dtype="<f4", mode="r", offset=offset, shape=(height, width))
    sample_offset = number(header, "SAMPLE_PROJECTION_OFFSET")
    line_offset = number(header, "LINE_PROJECTION_OFFSET")
    origins = {
        "observed_gdal_pds": [-scale * (sample_offset + 0.5), scale * (line_offset + 0.5)],
        "ua_pds_jp2_convention_candidate": [-scale * (sample_offset - 1), scale * (line_offset - 1)],
    }
    coverage = {}
    for name, origin in origins.items():
        c0, r0, c1, r1 = window(bounds, origin, scale, width, height)
        block = dem[r0:r1, c0:c1]
        mask = np.isfinite(block) & (block != missing)
        coverage[name] = {"origin_xy_m": origin, "pixel_window_covering_aoi": [c0, r0, c1, r1],
                          "checked_cells": int(mask.size), "missing_or_nonfinite_cells": int((~mask).sum()),
                          "valid_percent": float(mask.mean() * 100),
                          "min_elevation_m": float(block[mask].min()) if mask.any() else None,
                          "max_elevation_m": float(block[mask].max()) if mask.any() else None}
    if any(item["missing_or_nonfinite_cells"] for item in coverage.values()):
        raise ValueError("AOI has missing DEM samples; inspect before accepting")

    sources = []
    source_files = [("MSL_waypoints.json", WAYPOINT_URL), ("MSL_traverse.json", TRAVERSE_URL),
                    ("drill-sites-reference.pdf", DRILL_URL),
                    (DEM, "https://www.uahirise.org/dtm/dtm.php?ID=ESP_040770_1755")]
    for filename, url in source_files:
        sources.append({"local_filename": filename, "source_url": url,
                        "sha256": hashlib.sha256((RAW / filename).read_bytes()).hexdigest()})

    report = {
        "schema_version": 1,
        "status": "candidate: DEM missing-value coverage checked; georeferencing and visual alignment unresolved",
        "selection_date": "2026-11-14",
        "body": "Mars", "crs_wkt": WKT,
        "coordinate_conversion": "x=3396190*radians(lon-137.39), y=3396190*radians(lat); no Earth CRS",
        "waypoint_projection_crosscheck_max_residual_m": residual,
        "bounds_xy_m": bounds, "center_xy_m": center.tolist(),
        "center_lon_lat": [LON0 + math.degrees(center[0] / RADIUS), math.degrees(center[1] / RADIUS)],
        "width_projected_m": 1000, "height_projected_m": 1000, "area_projected_m2": 1000000,
        "selection_rule": "Center the 1000 m projected square on the bounds of published final-drive waypoints for sols 753 through 923, inclusive",
        "campaign_waypoint_count": len(campaign),
        "campaign_waypoints": [{"sol": f["properties"]["sol"], "rmc": f["properties"]["RMC"],
                                "xy_m": project(f["geometry"]["coordinates"])} for f in campaign],
        "science_target_rover_proxies": targets,
        "dem_coverage": coverage,
        "traverse_note": "Spatially clipped official traverse geometry; source has no sol fields, so this layer is not temporally filtered to the campaign. It is not an EVA route or straight waypoint interpolation.",
        "traverse_segments_xy_m": segments,
        "sources": sources,
        "limitations": ["Exact drill-hole coordinates and absolute geolocation accuracy are not established.",
                        "1000 x 1000 m refers to the projected grid, not an exact geodesic surface area.",
                        "The 1.5-pixel DEM/JP2 origin discrepancy is not corrected by this selection.",
                        "Finite non-missing samples do not establish terrain accuracy or traversability.",
                        "No raster crop, terrain derivative, or frontend integration is produced."],
    }

    # Optional real-image preview and pixel-quality inspection, not a terrain export.
    try:
        from PIL import Image
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.collections import LineCollection
    except ImportError:
        report["imagery_coverage"] = "not checked: install Pillow and Matplotlib for optional preview"
    else:
        image_checks = {}
        origin = origins["ua_pds_jp2_convention_candidate"]
        c0, r0, c1, r1 = window(bounds, origin, scale, width, height)
        images = {}
        for name in ORTHOS:
            label = (RAW / (name + ".LBL")).read_text(encoding="utf-8")
            for key in ["MAP_SCALE", "SAMPLE_PROJECTION_OFFSET", "LINE_PROJECTION_OFFSET",
                        "A_AXIS_RADIUS", "CENTER_LONGITUDE", "CENTER_LATITUDE", "MAP_PROJECTION_ROTATION"]:
                if number(label, key) != number(header, key):
                    raise ValueError(f"Image/DEM label mismatch: {key}")
            with Image.open(RAW / (name + ".JP2")) as image:
                if image.size != (width, height) or image.mode != "L":
                    raise ValueError("Unexpected ortho dimensions or mode")
                pixels = np.array(image.crop((c0, r0, c1, r1)))
            image_checks[name] = {"checked_cells": int(pixels.size),
                                  "null_code_0_cells": int((pixels == 0).sum()),
                                  "low_saturation_code_1_cells": int((pixels == 1).sum()),
                                  "high_saturation_code_255_cells": int((pixels == 255).sum())}
            images[name] = pixels
            sources.extend({"local_filename": name + suffix,
                            "source_url": "https://www.uahirise.org/dtm/dtm.php?ID=ESP_040770_1755",
                            "sha256": hashlib.sha256((RAW / (name + suffix)).read_bytes()).hexdigest()}
                           for suffix in (".JP2", ".LBL"))
        report["imagery_coverage"] = image_checks
        preferred = min(ORTHOS, key=lambda name: sum(image_checks[name][key] for key in
                        ("null_code_0_cells", "low_saturation_code_1_cells", "high_saturation_code_255_cells")))
        report["preview_imagery"] = preferred
        extent = [origin[0] + c0 * scale, origin[0] + c1 * scale,
                  origin[1] - r1 * scale, origin[1] - r0 * scale]
        fig, axes = plt.subplots(1, 2, figsize=(13, 7))
        for ax in axes:
            ax.imshow(images[preferred], cmap="gray", extent=extent, origin="upper", vmin=0, vmax=255)
            ax.add_collection(LineCollection(segments, colors="#f6c54b", linewidths=1.2))
            ax.set_aspect("equal")
            ax.set_xlabel("Mars easting (m); central meridian 137.39 E")
            ax.set_ylabel("Mars northing (m)")
            ax.ticklabel_format(style="plain", useOffset=False)
        xmin, ymin, xmax, ymax = bounds
        axes[0].plot([xmin, xmax, xmax, xmin, xmin], [ymin, ymin, ymax, ymax, ymin], color="#ff7744", lw=2)
        axes[0].set_xlim(xmin - 15, xmax + 15)
        axes[0].set_ylim(ymin - 15, ymax + 15)
        axes[0].set_title("Candidate AOI: 1000 x 1000 projected metres")
        axes[1].set_xlim(center[0] - 70, center[0] + 70)
        axes[1].set_ylim(center[1] - 70, center[1] + 70)
        axes[1].set_title("Pahrump Hills science campaign: detail")
        for target, offset_text in zip(targets, [(12, 22), (12, -4), (12, -20)]):
            x, y = target["xy_m"]
            for ax in axes:
                ax.scatter([x], [y], c="#42d8ee", edgecolors="black", s=38, zorder=4)
            axes[1].annotate(target["name"] + "\nrover " + target["rmc"], (x, y),
                             xytext=offset_text, textcoords="offset points", fontsize=9,
                             color="white", bbox={"facecolor": "black", "alpha": .7, "pad": 3},
                             arrowprops={"arrowstyle": "-", "color": "#42d8ee"})
        fig.suptitle("Pahrump Hills | source-based candidate selection", fontsize=15)
        fig.text(.5, .025, "Image: NASA/JPL-Caltech/UArizona | Traverse: NASA/JPL MMGIS | Cyan: rover poses associated with drill targets, not exact holes\nCandidate only: DEM/JP2 origin discrepancy unresolved. This is not a calculated EVA route.", ha="center", fontsize=8)
        fig.tight_layout(rect=(0, .09, 1, .94))
        OUT.mkdir(parents=True, exist_ok=True)
        fig.savefig(OUT / "pahrump-hills-aoi-preview.png", dpi=160)
        plt.close(fig)

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "pahrump-hills-aoi.json"
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    print("Candidate bounds [xmin, ymin, xmax, ymax]:", bounds)
    print("Campaign waypoint count:", len(campaign))
    print("Official traverse segments intersecting AOI:", len(segments))
    print("DEM coverage:", coverage)
    print("Report:", path)


if __name__ == "__main__":
    main()
