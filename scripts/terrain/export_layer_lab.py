"""Build display-only Layer Lab context; never changes terrain or route inputs."""

import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clip_segment(a, b, bounds):
    """Liang-Barsky clipping in projected metres; no invented intermediate route."""
    xmin, ymin, xmax, ymax = bounds
    dx, dy = b[0] - a[0], b[1] - a[1]
    lo, hi = 0.0, 1.0
    for p, q in ((-dx, a[0] - xmin), (dx, xmax - a[0]),
                 (-dy, a[1] - ymin), (dy, ymax - a[1])):
        if p == 0:
            if q < 0:
                return None
            continue
        t = q / p
        if p < 0:
            lo = max(lo, t)
        else:
            hi = min(hi, t)
        if lo > hi:
            return None
    return [[a[0] + lo * dx, a[1] + lo * dy],
            [a[0] + hi * dx, a[1] + hi * dy]]


def main():
    inventory_path = ROOT / "docs/terrain/apxs-observation-inventory.json"
    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
    package_path = ROOT / "public/data/gale/pahrump-hills-v1/manifest.json"
    manifest = json.loads(package_path.read_text(encoding="utf-8"))
    if digest(package_path) != inventory["terrainManifestSha256"]:
        raise ValueError("Research inventory needs review for this terrain version")
    conversion = inventory["conversion"]
    if conversion["target_crs_wkt"] != manifest["crs"]["wkt"] or conversion["standard_parallel_deg"] != 0:
        raise ValueError("Unsupported source projection")
    radius = conversion["sphere_radius_m"]
    lon0 = conversion["central_meridian_east_deg"]

    def project(point):
        return [radius * math.radians(point[0] - lon0), radius * math.radians(point[1])]

    raster = manifest["raster"]
    x, dx, rx, y, ry, dy = raster["geoTransform"]
    if rx or ry or dx <= 0 or dy >= 0:
        raise ValueError("Only north-up terrain supported")
    bounds = [x, y + raster["height"] * dy, x + raster["width"] * dx, y]
    source_report = json.loads((ROOT / "docs/terrain/pahrump-hills-aoi.json").read_text(encoding="utf-8"))
    sources = {s["local_filename"]: s for s in source_report["sources"]}
    raw = ROOT / "data/raw/pahrump-hills"
    for filename in ("MSL_waypoints.json", "MSL_traverse.json"):
        if digest(raw / filename) != sources[filename]["sha256"]:
            raise ValueError("Source snapshot changed: " + filename)
    waypoints = []
    for feature in json.loads((raw / "MSL_waypoints.json").read_text(encoding="utf-8"))["features"]:
        px, py = project(feature["geometry"]["coordinates"])
        if bounds[0] <= px < bounds[2] and bounds[1] < py <= bounds[3]:
            props = feature["properties"]
            waypoints.append({"x": px, "y": py, "rmc": props["RMC"], "sol": props["sol"]})
    segments = []
    for feature in json.loads((raw / "MSL_traverse.json").read_text(encoding="utf-8"))["features"]:
        geometry = feature["geometry"]
        if geometry["type"] not in ("MultiLineString", "LineString"):
            raise ValueError("Unreviewed traverse geometry type")
        lines = geometry["coordinates"] if geometry["type"] == "MultiLineString" else [geometry["coordinates"]]
        for line in lines:
            for a, b in zip(line, line[1:]):
                segment = clip_segment(project(a), project(b), bounds)
                if segment is not None and segment[0] != segment[1]:
                    segments.append(segment)
    observations = [{
        "name": r["target_name_verbatim"], "sol": r["measurement_start_sol"],
        "x": r["projected_position_m"]["x"], "y": r["projected_position_m"]["y"],
        "flags": r["review_flags"], "sourceLine": r["source_csv_line"],
    } for r in inventory["measurements"] if r["finite_terrain_coverage"]]
    buckskin = next(r for r in observations if r["name"] == "Buckskin_DRT_raster1")
    result = {
        "contractVersion": 1, "purpose": "display-only-research-preview",
        "terrainPackageId": manifest["id"], "terrainManifestSha256": digest(package_path),
        "bounds": bounds, "apxsSource": inventory["source"],
        "apxsInventorySha256": digest(inventory_path),
        "sources": [sources["MSL_waypoints.json"], sources["MSL_traverse.json"]],
        "waypoints": waypoints, "observations": observations, "traverseSegments": segments,
        "mineralFindings": [{
            "name": "Buckskin: tridymite", "x": buckskin["x"], "y": buckskin["y"],
            "description": "Published CheMin detection in the Buckskin drill sample. Rover-position proxy, not an exact sample footprint. No abundance raster is implied.",
            "sourceUrl": "https://www.jpl.nasa.gov/news/nasa-scientists-discover-unexpected-mineral-on-mars/",
        }],
        "limitations": [
            "All vectors inherit the prototype terrain's unverified absolute geolocation.",
            "APXS candidates include repeat measurements, low-quality records and handled samples; they are not approved mission targets.",
            "Traverse is a spatial subset of the source snapshot, not a sol-filtered campaign route or a calculated EVA path.",
            "This preview does not change route costs, EVA assumptions or the planning app's science collection.",
        ],
    }
    output = ROOT / "public/data/layer-lab/pahrump-hills-v1/context.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")
    print(f"Layer Lab: {len(observations)} APXS records, {len(waypoints)} waypoints, {len(segments)} clipped traverse segments")
    print(output)


if __name__ == "__main__":
    main()
