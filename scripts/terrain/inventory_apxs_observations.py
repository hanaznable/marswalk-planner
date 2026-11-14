"""Research inventory, not runtime targets: spatially filter a PDS APXS table.

Uses the reviewed prototype Mars projection. Repeated measurements, sample dumps
and source quality flags remain visible for review; no mineral map is inferred.
Download inputs explicitly; this script makes no network requests.
"""

import argparse
import csv
import hashlib
import json
import math
import struct
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = "https://pds-geosciences.wustl.edu/msl/urn-nasa-pds-msl_apxs_supplement_sols_0_2301/"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inventory(table_path, label_path, terrain_dir, review_path, waypoint_path, output):
    review = json.loads(review_path.read_text(encoding="utf-8"))
    manifest_path = terrain_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if review["terrain_manifest_sha256"] != sha(manifest_path):
        raise ValueError("Terrain changed since the coordinate review")
    conversion = review["conversion"]
    if conversion["target_crs_wkt"] != manifest["crs"]["wkt"] or conversion["standard_parallel_deg"] != 0:
        raise ValueError("Unsupported or unreviewed projection")
    radius, lon0 = conversion["sphere_radius_m"], conversion["central_meridian_east_deg"]
    label = ET.parse(label_path).getroot()
    ns = {"p": "http://pds.nasa.gov/pds4/pds/v1"}
    fields = label.findall(".//p:Table_Delimited/p:Record_Delimited/p:Field_Delimited/p:name", ns)
    # This published snapshot contains byte 0xB5 (micro sign), despite the label's
    # ASCII field declarations. Decode explicitly as Windows-1252; retain bytes
    # and their hash unchanged and report the discrepancy for reviewers.
    with table_path.open(encoding="cp1252", newline="") as stream:
        reader = csv.DictReader(stream)
        # The published CSV and XML have documented naming differences, including
        # a repeated "Elevation" label. Check their ordered correspondence rather
        # than silently trusting names or confusing the two elevation fields.
        aliases = {"Comments/Interpretation": "Comment/Interpretation",
                   "Elevation_2": "Elevation", "Standoff_distance": "Standoff"}
        headers = reader.fieldnames or []
        if len(headers) != len(fields) or any(
                aliases.get(header, header.replace("_error", "_err")) != field.text
                for header, field in zip(headers, fields)):
            raise ValueError("CSV columns do not match the PDS label")
        header_differences = [{"column": i, "csv": header, "xml": field.text}
                              for i, (header, field) in enumerate(zip(headers, fields), start=1)
                              if header != field.text]
        rows = list(reader)
    expected_rows = int(label.findtext(".//p:Table_Delimited/p:records", namespaces=ns))
    if len(rows) != expected_rows or any(None in row for row in rows):
        raise ValueError("CSV record layout does not match the PDS label")
    if sha(waypoint_path) != review["position_source"]["sha256"]:
        raise ValueError("Waypoint snapshot differs from the reviewed source")
    waypoints = json.loads(waypoint_path.read_text(encoding="utf-8"))["features"]
    raster = manifest["raster"]
    x0, dx, rx, y0, ry, dy = raster["geoTransform"]
    if rx or ry or dx <= 0 or dy >= 0:
        raise ValueError("Only north-up grids supported")
    width, height = raster["width"], raster["height"]
    layer_bytes = {}
    for name in ("elevation", "slope"):
        path = (terrain_dir / manifest["layers"][name]["url"]).resolve()
        if not path.is_relative_to(terrain_dir.resolve()):
            raise ValueError("Layer path outside package")
        layer_bytes[name] = path.read_bytes()
        if len(layer_bytes[name]) != width * height * 4:
            raise ValueError("Unexpected Float32 raster length")
    selected = []
    for line, record in enumerate(rows, start=2):
        lon, lat = float(record["Longitude"]), float(record["Latitude"])
        x, y = radius * math.radians(lon - lon0), radius * math.radians(lat)
        if not all(math.isfinite(value) for value in (x, y)):
            raise ValueError("Nonfinite source coordinates")
        row, col = math.floor((y - y0) / dy), math.floor((x - x0) / dx)
        if not (0 <= row < height and 0 <= col < width):
            continue
        offset = (row * width + col) * 4
        samples = {name: struct.unpack_from("<f", data, offset)[0] for name, data in layer_bytes.items()}
        # A numerical cross-check only, never an activity association inferred by date.
        matches = []
        for feature in waypoints:
            wlon, wlat = feature["geometry"]["coordinates"][:2]
            separation = math.hypot(radius * math.radians(lon - wlon), radius * math.radians(lat - wlat))
            if separation <= 0.01:
                matches.append({"rmc": feature["properties"]["RMC"],
                                "position_sol": feature["properties"]["sol"],
                                "numerical_separation_m": separation})
        flags = []
        if "low quality" in record["Comments/Interpretation"].lower():
            flags.append("source-flags-low-quality-spectrum")
        if record["Preparation_method"].lower() == "failed":
            flags.append("source-flags-failed-preparation")
        if record["Preparation_method"].lower() in ("presieve", "postsieve") or "dump" in record["Target"].lower():
            flags.append("sample-handling-location-not-necessarily-original-sample-site")
        selected.append({
            "source_csv_line": line, "target_name_verbatim": record["Target"],
            "measurement_start_sol": int(record["Sol"]),
            "source_lon_lat_deg": [lon, lat], "projected_position_m": {"x": x, "y": y},
            "cell": {"row": row, "col": col},
            "finite_terrain_coverage": all(math.isfinite(value) for value in samples.values()),
            "outcrop_field_verbatim": record["Informal_waypoint/outcrop_name"],
            "preparation_code_verbatim": record["Preparation_method"],
            "source_comments_verbatim": record["Comments/Interpretation"],
            "review_flags": flags,
            "waypoint_coordinate_matches_within_1cm": matches,
            "status": "candidate-not-approved-for-runtime",
        })
    inside_waypoints = []
    for feature in waypoints:
        lon, lat = feature["geometry"]["coordinates"][:2]
        row = math.floor((radius * math.radians(lat) - y0) / dy)
        col = math.floor((radius * math.radians(lon - lon0) - x0) / dx)
        if 0 <= row < height and 0 <= col < width:
            inside_waypoints.append(feature)
    result = {
        "kind": "research-inventory-not-runtime-science-targets", "terrainPackageId": manifest["id"],
        "terrainManifestSha256": sha(manifest_path),
        "source": {"citation": "Berger, J. A. (2020), Overview of MSL APXS Targets from Sol 0 to 2301, doi:10.17189/1519050",
                   "table_url": ARCHIVE + "data/" + table_path.name, "table_sha256": sha(table_path),
                   "label_url": ARCHIVE + "data/" + label_path.name, "label_sha256": sha(label_path)},
        "waypoint_source": review["position_source"], "conversion": conversion,
        "source_csv_xml_header_differences": header_differences,
        "source_text_encoding": "Windows-1252; source contains non-ASCII micro signs despite ASCII field declarations",
        "summary": {"source_measurement_rows": len(rows), "in_footprint_measurement_rows": len(selected),
                    "unique_verbatim_target_names": len({r["target_name_verbatim"] for r in selected}),
                    "unique_coordinate_pairs": len({tuple(r["source_lon_lat_deg"]) for r in selected}),
                    "finite_terrain_rows": sum(r["finite_terrain_coverage"] for r in selected),
                    "rows_matching_waypoint_coordinates_within_1cm": sum(bool(r["waypoint_coordinate_matches_within_1cm"]) for r in selected),
                    "in_footprint_waypoints": len(inside_waypoints),
                    "review_flag_counts": dict(Counter(flag for r in selected for flag in r["review_flags"]))},
        "limitations": [
            "Spatial inclusion uses the prototype Mars coordinate interpretation, not independently validated absolute alignment.",
            "PDS labels call these target coordinates, but repeated locations numerically match rover poses. Do not claim surveyed target footprints.",
            "Rows are measurements, not distinct sites; raster repeats and sample dumps must be reviewed before display.",
            "Element/oxide chemistry is not a mineral identification map. No abundances are converted or interpolated here.",
            "Low-quality/failed records remain in this research inventory and are not approved for runtime use.",
        ],
        "measurements": selected,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(result["summary"], indent=2))
    print("Research inventory:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    raw = ROOT / "data/raw/pahrump-hills/science-research"
    parser.add_argument("--table", type=Path, default=raw / "ds01_2020je006536rr.csv")
    parser.add_argument("--label", type=Path, default=raw / "ds01_2020je006536rr.xml")
    parser.add_argument("--terrain-dir", type=Path, default=ROOT / "public/data/gale/pahrump-hills-v1")
    parser.add_argument("--review", type=Path, default=ROOT / "docs/terrain/science-positions-provenance.json")
    parser.add_argument("--waypoints", type=Path, default=ROOT / "data/raw/pahrump-hills/MSL_waypoints.json")
    parser.add_argument("--output", type=Path, default=ROOT / "docs/terrain/apxs-observation-inventory.json")
    args = parser.parse_args()
    inventory(args.table, args.label, args.terrain_dir, args.review, args.waypoints, args.output)
