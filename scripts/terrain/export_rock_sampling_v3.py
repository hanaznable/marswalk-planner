"""Add source-informed sampling proposals without rewriting earlier collections."""
import copy
import json

from export_science_activities import ROOT, digest

REVIEW = ROOT / "scripts/terrain/reviews/rock-sampling-v3.json"
OUTPUT = ROOT / "public/data/science-activities/pahrump-hills-v1/v3"


def main():
    if b"\r" in REVIEW.read_bytes():
        raise ValueError("Review files must use LF line endings, matching .gitattributes")
    review = json.loads(REVIEW.read_text(encoding="utf-8"))
    for path, expected in review["inputHashes"].items():
        if digest((ROOT / path).read_bytes()) != expected:
            raise ValueError(f"Reviewed input changed: {path}")
    base = ROOT / "public/data/science-activities/pahrump-hills-v1/v2/activities.json"
    collection = json.loads(base.read_text())
    collection["id"] = "pahrump-hills-activities-v3"
    sources = review["sources"]
    for activity in collection["activities"]:
        activity["experimentType"] = "photography"
    collection["equipment"] += [
        {"id": "rock-sampling-tools", "name": "Rock sampling tools", "description": "Geology hammer and rock-handling tools for a proposed chip sample. Tool functions are source-supported; exact Mars EVA hardware is a scenario assumption.", "basis": "scenario-assumption", "sources": [sources["tools"], sources["tool-development"]]},
        {"id": "sample-containers", "name": "Labelled sample containers", "description": "Individual sample containment and identification for later laboratory work. No capacity, contamination-control performance or Mars qualification is specified.", "basis": "scenario-assumption", "sources": [sources["containment"], sources["documentation"]]},
    ]
    for context_id in review["samplingContexts"]:
        context = next(a for a in collection["activities"] if a["id"] == context_id)
        evidence = next(e for e in collection["evidence"] if e["id"] == context["access"]["evidenceId"])
        name = evidence["targetName"]
        collection["activities"].append({
            "id": "rock-sample-" + evidence["id"],
            "title": "Collect a rock sample near " + name,
            "category": "historical-follow-up",
            "experimentType": "rock-sampling",
            "experiment": "Collect and document a rock chip for later laboratory analysis",
            "objectiveIds": copy.deepcopy(context["objectiveIds"]),
            "evidenceIds": copy.deepcopy(context["evidenceIds"]),
            "requiredEquipmentIds": ["field-camera", "rock-sampling-tools", "sample-containers"],
            "access": copy.deepcopy(context["access"]),
            "rationale": "Compare a new, documented sample from the " + name + " setting with published historical sample findings. The original findings motivate the visit; a new sample's composition must be measured separately.",
            "procedure": copy.deepcopy(review["procedure"]),
            "limitations": [
                "This is a project-proposed human activity, not a historical NASA chip-collection record or a verified Mars EVA procedure.",
                "The planning position is the existing associated rover pose, not an exact drill hole or a newly located collectable rock.",
                "Suitable material, collection feasibility and representativeness must be assessed on site; no mineral content is predicted for a new chip.",
                "Lunar tool functions inform scenario equipment. Hardware, handling and contamination-control procedures require mission-specific validation.",
                "No sample mass, container capacity, laboratory capability or task duration is inferred. Time uses the existing per-stop setting, not a sampling-time estimate.",
            ],
            "durationMinutes": None, "durationSource": None,
            "review": {"status": "reviewed", "by": review["reviewer"], "date": review["date"]},
        })
    OUTPUT.mkdir(parents=True, exist_ok=True)
    data = (json.dumps(collection, indent=2) + "\n").encode()
    (OUTPUT / "activities.json").write_bytes(data)
    provenance = {"kind": "rock-sampling-v3-provenance", "date": review["date"], "reviewer": review["reviewer"], "reviewConfigSha256": digest(REVIEW.read_bytes()), "inputHashes": review["inputHashes"], "sources": sources, "samplingContexts": review["samplingContexts"], "interpretation": review["interpretation"], "procedure": review["procedure"], "output_sha256": {"activities.json": digest(data)}}
    (OUTPUT / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Exported {len(collection['activities'])} activities, including four proposed rock-sampling follow-ups.")


if __name__ == "__main__":
    main()
