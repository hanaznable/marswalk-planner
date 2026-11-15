"""Reproduce the first reviewed follow-up collection; no network or raw files needed."""
import hashlib
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public/data/science-activities/pahrump-hills-v1/v1"
PDF = "https://www.hou.usra.edu/meetings/lpsc2015/pdf/2855.pdf"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    inventory_bytes = (ROOT / "docs/terrain/science-activity-candidates.json").read_bytes()
    review = json.loads(inventory_bytes)
    terrain_dir = ROOT / "public/data/gale/pahrump-hills-v1"
    manifest_bytes = (terrain_dir / "manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    context_bytes = (ROOT / "public/data/layer-lab/pahrump-hills-v1/context.json").read_bytes()
    context = json.loads(context_bytes)
    if digest(manifest_bytes) != review["terrainManifestSha256"] or digest(context_bytes) != review["contextSha256"]:
        raise ValueError("Reviewed source snapshots changed; repeat the review before exporting")
    source = {"url": PDF, "attribution": "McBride et al. (2015), LPSC abstract 2855", "provides": "MAHLI outcrop and named-target observations"}
    settings = [
        ("shoemaker-imaging", "Photograph Pelona layering", "Photograph layered rock textures", "MAHLI observations at Shoemaker describe closely spaced layers at Pelona.", "Shoemaker section, page 1", "Revisit the documented imaging target to compare visible layer spacing and surface textures."),
        ("book-cliffs-imaging", "Photograph Punchbowl textures", "Photograph crystals and surrounding rock", "The Book Cliffs imaging account describes pale crystals in Punchbowl, Afton Canyon and Topanga targets.", "Book Cliffs section, page 2", "Photograph the historical target setting to document crystal shapes and their surrounding rock."),
        ("chinle-comparison", "Photograph Pickhandle bedding", "Photograph bedding from different angles", "MAHLI imaged Pickhandle among the Chinle targets investigated for different lamination patterns.", "Chinle section, page 2", "Use multiple views of the historical target setting to compare visible bedding patterns."),
    ]
    evidence, activities = [], []
    for aid, title, experiment, statement, section, rationale in settings:
        candidate = next(c for c in review["candidates"] if c["id"] == aid)
        row = next(c for c in context["observations"] if c["sourceLine"] == candidate["sourceLine"])
        if row["name"] != candidate["targetName"] or row["sol"] != candidate["measurementSol"] or row["flags"]:
            raise ValueError("Measurement identity or quality changed")
        pos = candidate["sourcePosition"]
        if (row["x"], row["y"]) != (pos["x"], pos["y"]):
            raise ValueError("Source position changed")
        g = manifest["raster"]["geoTransform"]
        col = math.floor((pos["x"] - g[0]) / g[1])
        r = math.floor((pos["y"] - g[3]) / g[5])
        width, height = manifest["raster"]["width"], manifest["raster"]["height"]
        if not (0 <= r < height and 0 <= col < width):
            raise ValueError("Activity outside coverage")
        for layer in ["elevation", "slope"]:
            data = (terrain_dir / manifest["layers"][layer]["url"]).read_bytes()
            if not math.isfinite(struct.unpack_from("<f", data, 4 * (r * width + col))[0]):
                raise ValueError("Activity on no-data terrain")
        apxs_id, image_id = aid + "-apxs", aid + "-imaging"
        apxs_source = {"url": context["apxsSource"]["table_url"], "attribution": "Berger (2020), NASA PDS, doi:10.17189/1519050", "provides": f"Target, measurement sol and associated rover position; CSV row {row['sourceLine']}"}
        common = {"mission": "MSL Curiosity", "targetName": row["name"], "footprint": {"type": "point", "position": pos}, "qualityFlags": [], "links": {"targetId": None, "apxsRecordId": candidate["recordId"]}}
        evidence.append({**common, "id": apxs_id, "kind": "apxs-measurement", "instrument": "APXS", "sol": row["sol"], "statement": f"The archived APXS table records {row['name']} on mission sol {row['sol']}.", "productIds": [candidate["recordId"]], "sources": [apxs_source]})
        evidence.append({**common, "id": image_id, "kind": "image-observation", "instrument": "MAHLI", "sol": None, "statement": statement, "productIds": ["LPSC-2015-2855: " + section], "sources": [source]})
        activities.append({"id": aid, "title": title, "category": "historical-follow-up", "experiment": experiment, "objectiveIds": ["rock-textures"], "evidenceIds": [apxs_id, image_id], "requiredEquipmentIds": ["field-camera"], "access": {"evidenceId": apxs_id, "point": {"x": pos["x"], "y": pos["y"]}, "selectionBasis": "associated-rover-position", "justification": "Use the published APXS-associated rover position as the planning access point for the named imaging target."}, "rationale": rationale, "limitations": ["The planning position is an associated rover pose, not the measured rock footprint.", "Camera equipment is a planning assumption; source observations do not establish access, safety or task duration.", "Image-observation statements are published target context, not a new geometry solution or an exact imaging-sol association."], "durationMinutes": None, "durationSource": None, "review": {"status": "reviewed", "by": "Codex - source/content review for Developer B", "date": "2026-11-15"}})
    collection = {"contractVersion": 1, "id": "pahrump-hills-activities-v1", "terrainPackageId": manifest["id"], "terrainManifestSha256": digest(manifest_bytes), "synthetic": False, "objectives": [{"id": "rock-textures", "title": "Study rock textures", "description": "How do visible layering and crystal textures differ among the documented outcrops?", "sources": [source]}], "equipment": [{"id": "field-camera", "name": "Field camera", "description": "A camera for visual documentation; no specified performance or suit integration.", "basis": "scenario-assumption", "sources": []}], "evidence": evidence, "activities": activities}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(collection, indent=2) + "\n").encode()
    (OUTPUT / "activities.json").write_bytes(encoded)
    provenance = {"kind": "science-activity-review", "date": "2026-11-15", "reviewer": "Codex - source/content review for Developer B", "scope": "Primary-source content, named-target associations, source snapshot identity and finite terrain coverage; not independent positional or scientific certification", "inputs": {"terrainManifestSha256": digest(manifest_bytes), "contextSha256": digest(context_bytes), "candidateInventorySha256": digest(inventory_bytes), "apxsTableSha256": context["apxsSource"]["table_sha256"]}, "primarySource": source, "sourceSections": [entry[4] for entry in settings], "output_sha256": {"activities.json": digest(encoded)}, "excluded": ["Garden City: specific feature association remains draft", "Buckskin: separate sample-context follow-up remains draft", "Orbital candidates: no reviewed individual feature yet"], "processing": "No new source positions, chemical values, mineral claims or activity durations generated; source positions are preserved."}
    (OUTPUT / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8", newline="\n")
    print("Exported 3 historical follow-ups; no runtime registry or UI changed.")


if __name__ == "__main__":
    main()
