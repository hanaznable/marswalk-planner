"""Export reviewed rover-position proxies using the agreed science contract v1.

Standard library only. Region-specific source joins belong in the reviewed input,
not in this exporter. This adapter supports spherical equirectangular proxies;
new source frames or exact target locations require their own reviewed adapter.
"""

import argparse
import hashlib
import json
import math
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export(review_path, terrain_dir, output_dir):
    review = json.loads(review_path.read_text(encoding="utf-8"))
    manifest_path = terrain_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    digest = sha256(manifest_path)
    if (review["terrainPackageId"] != manifest["id"] or
            review["terrain_manifest_sha256"] != digest or manifest["synthetic"]):
        raise ValueError("Reviewed positions do not match this real terrain manifest")
    conversion = review["conversion"]
    if conversion["target_crs_wkt"] != manifest["crs"]["wkt"]:
        raise ValueError("Reviewed CRS differs from the terrain CRS")
    if conversion["standard_parallel_deg"] != 0:
        raise ValueError("This adapter requires zero standard parallel")
    radius = conversion["sphere_radius_m"]
    lon0 = conversion["central_meridian_east_deg"]
    if not math.isfinite(radius) or radius <= 0 or not math.isfinite(lon0):
        raise ValueError("Invalid reviewed projection parameters")
    raster = manifest["raster"]
    x0, dx, rx, y0, ry, dy = raster["geoTransform"]
    if rx != 0 or ry != 0 or dx <= 0 or dy >= 0:
        raise ValueError("This adapter requires a north-up metre grid")
    layers = []
    for name in ("elevation", "slope"):
        layer_path = (terrain_dir / manifest["layers"][name]["url"]).resolve()
        if not layer_path.is_relative_to(terrain_dir.resolve()):
            raise ValueError("Layer must be inside the terrain package")
        data = layer_path.read_bytes()
        if len(data) != raster["width"] * raster["height"] * 4:
            raise ValueError("Unexpected Float32 layer length")
        layers.append(data)
    targets = []
    ids = set()
    for record in review["records"]:
        if (record["position_role"] != "associated-rover-position-proxy-not-exact-drill-hole"
                or record["suggested_activity_kind"] != "drill-site"):
            raise ValueError("Only reviewed drill-associated rover proxies are supported")
        if record["uncertaintyMeters"] is not None:
            raise ValueError("This source adapter has no stated positional uncertainty")
        coords = record["source_coordinates"]
        x = radius * math.radians(coords["longitude_east_deg"] - lon0)
        y = radius * math.radians(coords["latitude_deg"])
        recorded = record["package_source_crs_position_m"]
        if not all(math.isfinite(v) for v in (x, y)) or not (
                math.isclose(x, recorded["x"], rel_tol=0, abs_tol=1e-8) and
                math.isclose(y, recorded["y"], rel_tol=0, abs_tol=1e-8)):
            raise ValueError("Recomputed coordinates differ from reviewed positions")
        row, col = math.floor((y - y0) / dy), math.floor((x - x0) / dx)
        if not (0 <= row < raster["height"] and 0 <= col < raster["width"]):
            raise ValueError("Target falls outside terrain coverage")
        if record["package_cell"] != {"row": row, "col": col}:
            raise ValueError("Target cell differs from the review")
        offset = (row * raster["width"] + col) * 4
        if not all(math.isfinite(struct.unpack_from("<f", data, offset)[0]) for data in layers):
            raise ValueError("Target falls on missing terrain data")
        association = record["association"]
        target_id = "curiosity-" + re.sub(r"[^a-z0-9]+", "-", record["name"].lower()).strip("-")
        if target_id in ids:
            raise ValueError("Duplicate target id")
        ids.add(target_id)
        for field in ("activity_sol", "position_record_sol"):
            value = association[field]
            if type(value) is not int or value < 0:
                raise ValueError("Reviewed sols must be non-negative integers")
        targets.append({
            "id": target_id, "name": record["name"], "kind": "drill-site",
            "position": {"x": x, "y": y, "uncertaintyMeters": None,
                         "basis": "rover-position-proxy"},
            "mission": "MSL Curiosity", "activitySol": association["activity_sol"],
            "positionSol": association["position_record_sol"],
            "description": (f"Curiosity drilled a sample at {record['name']}. "
                            "This marker uses an associated rover position, not the exact drill-hole location."),
            "sources": [
                {"url": review["position_source"]["source_url"], "attribution": "NASA/JPL-Caltech",
                 "provides": "Rover position and position-record sol"},
                {"url": association["reference_url"], "attribution": "NASA",
                 "provides": "Drill activity sol and site/drive association (slide 5)"},
                {"url": review["activity_context_url"], "attribution": "NASA/JPL-Caltech",
                 "provides": "Named Pahrump Hills drill activities; no exact hole coordinates"},
            ],
        })
    if not targets:
        raise ValueError("No reviewed targets to export")
    collection = {"contractVersion": 1, "id": manifest["id"] + "-targets-v1",
                  "terrainPackageId": manifest["id"], "terrainManifestSha256": digest,
                  "synthetic": False, "targets": targets}
    # Keep outputs separate: never alter the hashed terrain package or review.
    if output_dir.resolve() == terrain_dir.resolve() or terrain_dir.resolve() in output_dir.resolve().parents:
        raise ValueError("Science outputs must be separate from the terrain package")
    output_dir.mkdir(parents=True, exist_ok=True)
    target_path = output_dir / "targets.json"
    target_path.write_text(json.dumps(collection, indent=2, allow_nan=False) + "\n",
                           encoding="utf-8", newline="\n")
    provenance = {
        "kind": "science-target-collection-provenance",
        "terrainPackageId": manifest["id"], "terrainManifestSha256": digest,
        "review_input_sha256": sha256(review_path),
        "output_sha256": {"targets.json": sha256(target_path)},
        "method": "Export reviewed site/drive joins; recompute projected positions and check both terrain layers. No new scientific interpretation.",
        "review": review,
    }
    (output_dir / "provenance.json").write_text(
        json.dumps(provenance, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")
    print(f"Exported {len(targets)} reviewed rover-position proxies to {target_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--review", type=Path, default=ROOT / "docs/terrain/science-positions-provenance.json")
    parser.add_argument("--terrain-dir", type=Path, default=ROOT / "public/data/gale/pahrump-hills-v1")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "public/data/science/pahrump-hills-v1")
    args = parser.parse_args()
    export(args.review, args.terrain_dir, args.output_dir)
