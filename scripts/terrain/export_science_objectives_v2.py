"""Export reviewed water/mineral objectives and image-based orbital candidates."""
import copy
import json
import math
import struct
from export_science_activities import ROOT, digest

REVIEW = ROOT / "scripts/terrain/reviews/science-objectives-v2.json"
OUTPUT = ROOT / "public/data/science-activities/pahrump-hills-v1/v2"


def main():
    if b"\r" in REVIEW.read_bytes():
        raise ValueError("Review files must use LF line endings, matching .gitattributes")
    review = json.loads(REVIEW.read_text(encoding="utf-8"))
    for path, expected in review["inputHashes"].items():
        if digest((ROOT / path).read_bytes()) != expected:
            raise ValueError(f"Reviewed input changed: {path}")
    c = json.loads((ROOT / "public/data/science-activities/pahrump-hills-v1/v1/activities.json").read_text())
    context = json.loads((ROOT / "public/data/layer-lab/pahrump-hills-v1/context.json").read_text())
    targets = json.loads((ROOT / "public/data/science/pahrump-hills-v1/targets.json").read_text())["targets"]
    folder = ROOT / "public/data/gale/pahrump-hills-v1"
    manifest = json.loads((folder / "manifest.json").read_text())
    sources = review["sources"]
    c["id"] = "pahrump-hills-activities-v2"
    c["objectives"] += [
        {"id": "past-water", "title": "Investigate past water activity", "description": "What can documented veins and altered samples tell us about earlier fluid activity?", "sources": [sources["garden-city"], sources["pahrump-mineralogy"]]},
        {"id": "mineral-diversity", "title": "Investigate mineral diversity", "description": "How do published sample findings differ across the study area?", "sources": [sources["pahrump-mineralogy"], sources["mineral-comparison"], sources["buckskin"]]},
    ]
    def evidence(eid, name, instrument, kind, pos, statement, refs, products, sol=None, links=None, footprint=None):
        c["evidence"].append({"id": eid, "kind": kind, "mission": "MRO" if kind.startswith("orbital") else "MSL Curiosity", "instrument": instrument, "targetName": name, "sol": sol, "statement": statement, "footprint": footprint or {"type": "point", "position": copy.deepcopy(pos)}, "links": links or {"targetId": None, "apxsRecordId": None}, "productIds": products, "qualityFlags": [], "sources": refs})
    def activity(aid, title, experiment, objectives, evidence_ids, access_id, point, rationale, orbital=False):
        c["activities"].append({"id": aid, "title": title, "category": "orbital-candidate" if orbital else "historical-follow-up", "experiment": experiment, "objectiveIds": objectives, "evidenceIds": evidence_ids, "requiredEquipmentIds": ["field-camera"], "access": {"evidenceId": access_id, "point": {"x": point["x"], "y": point["y"]}, "selectionBasis": "reviewed-area-access" if orbital else "associated-rover-position", "justification": "Project-reviewed imaging access point within the source ROI." if orbital else "Existing sourced rover-position proxy for this investigation."}, "rationale": rationale, "limitations": ["An orbital candidate is a project-reviewed imaging region, not a mineral detection or a claim that no rover visited it." if orbital else "The planning position is an associated rover pose, not an exact rock footprint.", "Camera equipment is a planning assumption. Imaging does not reproduce laboratory mineral identification.", "Access geometry inherits the prototype terrain registration; no new positional accuracy is claimed."], "durationMinutes": None, "durationSource": None, "review": {"status": "reviewed", "by": review["reviewer"], "date": review["date"]}})
    row = next(r for r in context["observations"] if r["name"] == "Alvord_Mountain_raster1")
    if row["flags"]: raise ValueError("Garden City source flags require review")
    pos = {"x": row["x"], "y": row["y"], "basis": "rover-position-proxy", "uncertaintyMeters": None}
    row_id = f"apxs:{context['apxsSource']['table_sha256']}:row-{row['sourceLine']}"
    apxs_source = {"url": context["apxsSource"]["table_url"], "attribution": "Berger (2020), NASA PDS", "provides": f"Alvord Mountain measurement sol and rover-position proxy, CSV row {row['sourceLine']}"}
    evidence("garden-city-position", row["name"], "APXS", "apxs-measurement", pos, f"The APXS archive records Alvord_Mountain_raster1 on sol {row['sol']}.", [apxs_source], [row_id], row["sol"], {"targetId": None, "apxsRecordId": row_id})
    evidence("garden-city-veins", "Garden City - Alvord Mountain", "Mastcam / MAHLI / ChemCam", "image-observation", pos, "Published Garden City studies associate Alvord Mountain with vein investigations; the site's vein diversity supports study of earlier fluid activity.", [sources["garden-targets"], sources["garden-manuscript"], sources["garden-city"]], ["doi:10.1029/2018EA000482:Table-1", "JPL-Garden-City-2015-11-11"])
    activity("garden-city-vein-imaging", "Investigate Garden City veins", "Photograph vein textures and intersections", ["past-water"], ["garden-city-position", "garden-city-veins"], "garden-city-position", pos, "Document the historical vein-investigation setting to compare visible structures associated with past fluid activity.")
    for t in targets:
        name, eid, pos = t["name"], "mineralogy-" + t["id"], t["position"]
        evidence(eid, name, "CheMin", "chemin-mineralogy", pos, f"Rampe et al. report jarosite in the {name} sample, within a comparison of Pahrump Hills sample mineralogy.", [sources["pahrump-mineralogy"], sources["mineral-comparison"]], ["NTRS-20150019443", "PIA21146"], links={"targetId": t["id"], "apxsRecordId": None})
        objectives = ["mineral-diversity"] + (["past-water"] if name == "Confidence Hills" else [])
        activity("sample-context-" + t["id"], "Document " + name + " sample context", "Photograph the sampled outcrop setting", objectives, [eid], eid, pos, "Compare visible sample settings alongside published mineralogical evidence; field photographs do not identify jarosite.")
    row = next(r for r in context["observations"] if r["name"] == "Buckskin_DRT_raster1")
    pos = {"x": row["x"], "y": row["y"], "basis": "rover-position-proxy", "uncertaintyMeters": None}
    evidence("buckskin-mineralogy", "Buckskin", "CheMin", "chemin-mineralogy", pos, "NASA reports tridymite in the Buckskin drill sample collected on sol 1060.", [sources["buckskin"]], ["JPL-2016-157"], None, {"targetId": None, "apxsRecordId": f"apxs:{context['apxsSource']['table_sha256']}:row-{row['sourceLine']}"})
    activity("buckskin-context-imaging", "Document Buckskin sample context", "Photograph the mineral-study setting", ["mineral-diversity"], ["buckskin-mineralogy"], "buckskin-mineralogy", pos, "Relate the published sample finding to its visible outcrop setting without extrapolating a mineral map.")
    gt = manifest["basemap"]["geoTransform"]
    def xy(pixel): return [gt[0] + pixel[0] * gt[1], gt[3] + pixel[1] * gt[5]]
    for roi in review["orbitalRegions"]:
        ring = [xy(p) for p in roi["ringPixels"]]
        px, py = xy(roi["accessPixel"])
        footprint = {"type": "area", "ring": ring, "basis": "reviewed-orbital-footprint", "uncertaintyMeters": None, "nativeResolutionMeters": review["orbitalResolutionMeters"], "geometrySource": {"productId": "ESP_039280_1755_RED_C_02_ORTHO", "method": review["geometryMethod"], "sources": [sources["hirise"]]}}
        evidence(roi["id"] + "-image", roi["name"], "HiRISE", "orbital-image-observation", None, roi["observation"], [sources["hirise"]], ["ESP_039280_1755_RED_C_02_ORTHO", "project-ROI:" + roi["id"]], footprint=footprint)
        activity(roi["id"], roi["title"], roi["experiment"], ["rock-textures"], [roi["id"] + "-image"], roi["id"] + "-image", {"x": px, "y": py}, "Use orbital image morphology to select a follow-up imaging area away from the original three photography stops.", orbital=True)
    # Source-supported observing capability; the astronaut configuration remains a scenario assumption.
    c["equipment"].append({"id": "close-up-optics", "name": "Close-up imaging optics", "description": "Macro/close-up optics for documenting fine rock and vein textures. Can be integrated with the field camera; no MAHLI-equivalent performance or Mars EVA qualification is assumed.", "basis": "scenario-assumption", "sources": [sources["instrument-capabilities"]]})
    c["equipment"][0]["sources"] = [sources["instrument-capabilities"]]
    for a in c["activities"]:
        if a["id"] in review["closeUpImagingActivities"]:
            a["requiredEquipmentIds"].append("close-up-optics")
            a["limitations"].append("The close-up optics capability is motivated by MAHLI observations; exact optics, scale and astronaut access remain planning assumptions.")
    for a in c["activities"]:
        gt = manifest["raster"]["geoTransform"]; p = a["access"]["point"]
        col, row = math.floor((p["x"] - gt[0]) / gt[1]), math.floor((p["y"] - gt[3]) / gt[5])
        if not (0 <= col < manifest["raster"]["width"] and 0 <= row < manifest["raster"]["height"]): raise ValueError("Outside terrain")
        for name in ["elevation", "slope"]:
            value = struct.unpack_from("<f", (folder / manifest["layers"][name]["url"]).read_bytes(), 4 * (row * manifest["raster"]["width"] + col))[0]
            if not math.isfinite(value): raise ValueError("No-data access point")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    data = (json.dumps(c, indent=2) + "\n").encode()
    (OUTPUT / "activities.json").write_bytes(data)
    provenance = {"kind": "science-objectives-v2-provenance", "date": review["date"], "reviewer": review["reviewer"], "reviewConfigSha256": digest(REVIEW.read_bytes()), "inputHashes": review["inputHashes"], "sources": sources, "orbitalRegions": review["orbitalRegions"], "closeUpImagingActivities": review["closeUpImagingActivities"], "geometryMethod": review["geometryMethod"], "sourceAccessNotes": review["sourceAccessNotes"], "output_sha256": {"activities.json": digest(data)}, "limits": ["No new chemical values or quantitative mineral abundances exported.", "Orbital polygons are reviewed imaging regions, not mineral/unit boundaries or evidence of unvisited terrain.", "No CRISM or thermal product integrated."]}
    (OUTPUT / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Exported {len(c['objectives'])} objectives, {len(c['activities'])} activities, including 2 HiRISE orbital candidates.")


if __name__ == "__main__": main()
