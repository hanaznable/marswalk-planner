"""Record existing source-based rover-position proxies; no runtime schema changes.

Requires the locally downloaded NASA waypoint snapshot for verification. Writes
only a documentation artifact, never into the existing terrain package.
"""

import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    aoi = json.loads((ROOT / "docs/terrain/pahrump-hills-aoi.json").read_text(encoding="utf-8"))
    package_dir = ROOT / "public/data/gale/pahrump-hills-v1"
    manifest_path = package_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    raster = manifest["raster"]
    x0, dx, rx, y0, ry, dy = raster["geoTransform"]
    if rx != 0 or ry != 0 or dx <= 0 or dy >= 0:
        raise ValueError("Expected north-up package grid")
    # These projection parameters come from the recorded source validation,
    # and must be checked against the actual package rather than assumed globally.
    plan = json.loads((ROOT / "docs/terrain/pahrump-hills-package-plan.json").read_text(encoding="utf-8"))
    radius = plan["crs"]["radius_m"]
    lon0 = plan["crs"]["central_meridian_deg"]
    if manifest["crs"]["wkt"] != plan["crs"]["wkt"]:
        raise ValueError("Package CRS differs from validated projection plan")
    sources = {item["local_filename"]: item for item in aoi["sources"]}
    waypoint_path = ROOT / "data/raw/pahrump-hills/MSL_waypoints.json"
    raw = waypoint_path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != sources["MSL_waypoints.json"]["sha256"]:
        raise ValueError("Waypoint source snapshot changed; re-review associations")
    waypoints = json.loads(raw)
    elevation = (package_dir / manifest["layers"]["elevation"]["url"]).read_bytes()
    import struct
    records = []
    residuals = []
    for target in aoi["science_target_rover_proxies"]:
        matches = [f for f in waypoints["features"] if f["properties"]["RMC"] == target["rmc"]]
        if len(matches) != 1:
            raise ValueError("Ambiguous source RMC association")
        source = matches[0]
        lon, lat = source["geometry"]["coordinates"][:2]
        if [lon, lat] != target["lon_lat"]:
            raise ValueError("Previously reviewed coordinates changed")
        x, y = radius * math.radians(lon - lon0), radius * math.radians(lat)
        row, col = math.floor((y - y0) / dy), math.floor((x - x0) / dx)
        if not (0 <= row < raster["height"] and 0 <= col < raster["width"]):
            raise ValueError("Target proxy is outside package coverage")
        z = struct.unpack_from("<f", elevation, (row * raster["width"] + col) * 4)[0]
        if not math.isfinite(z):
            raise ValueError("Target proxy falls on missing elevation")
        p = source["properties"]
        residuals.extend([abs(p["easting"] - radius * math.radians(lon)), abs(p["northing"] - y)])
        records.append({
            "name": target["name"], "suggested_activity_kind": "drill-site",
            "position_role": "associated-rover-position-proxy-not-exact-drill-hole",
            "association": {"rmc": target["rmc"], "activity_sol": target["drill_sol"],
                            "position_record_sol": p["sol"],
                            "method": "Exact site/drive join, not nearest-date interpolation",
                            "reference_url": target["association_source"], "reference_page": 5},
            "source_coordinates": {"longitude_east_deg": lon, "latitude_deg": lat},
            "package_source_crs_position_m": {"x": x, "y": y},
            "package_cell": {"row": row, "col": col},
            "local_map_position_m": {"x": x-x0, "y": y-(y0+raster["height"]*dy)},
            "uncertaintyMeters": None,
            "uncertainty_reason": "No positional uncertainty supplied by the source snapshot; numerical precision is not accuracy",
            "description_limit": "Drilled sample target associated with this rover pose; no exact hole coordinate or instrument-result inference",
        })
    result = {
        "kind": "science-position-provenance-not-runtime-contract",
        "terrainPackageId": manifest["id"],
        "terrain_manifest_sha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
        "source_frame": {
            "representation": "Mars longitude/latitude degrees, longitude east-positive, latitude north-positive",
            "formal_crs_in_source_json": waypoints.get("crs"),
            "interpretation": "Mars spherical/planetocentric-compatible coordinate interpretation used for the prototype; source JSON does not formally declare a datum or latitude type",
            "crosscheck": "Source easting/northing numerically match R*radians(lon), R*radians(lat); this does not establish an independently certified datum tie",
        },
        "conversion": {
            "target_crs_wkt": manifest["crs"]["wkt"], "sphere_radius_m": radius,
            "central_meridian_east_deg": lon0, "standard_parallel_deg": 0,
            "projected_x": "R * radians(longitude_east_deg - central_meridian_east_deg)",
            "projected_y": "R * radians(latitude_deg)",
            "local_map_x": "projected_x - terrain_west_edge",
            "local_map_y": "projected_y - terrain_south_edge",
            "grid_col": "floor((projected_x - geoTransform[0]) / geoTransform[1])",
            "grid_row": "floor((projected_y - geoTransform[3]) / geoTransform[5])",
            "origin_policy": "Use the package geotransform to map projected positions to cells. Do not add/subtract the raster's 1.5-pixel interpretation difference to rover coordinates.",
            "source_projected_properties_max_residual_m_for_these_records": max(residuals),
        },
        "position_source": sources["MSL_waypoints.json"],
        "activity_association_source": sources["drill-sites-reference.pdf"],
        "activity_context_url": "https://www.jpl.nasa.gov/images/pia21709-key-locations-studied-at-pahrump-hills-on-mars/",
        "records": records,
        "not_established": ["Exact drill-hole or remote-observation footprint positions",
                            "Source-stated positional uncertainty or certified global/local datum alignment",
                            "Observation-site coordinates for every rover waypoint"],
    }
    output = ROOT / "docs/terrain/science-positions-provenance.json"
    output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")
    print("Provenance:", output)
    for record in records:
        print(record["name"], record["package_source_crs_position_m"], record["package_cell"])


if __name__ == "__main__":
    main()
