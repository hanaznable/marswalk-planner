# Science suggestions - implementation guide

Current feature branch: `feature/science-suggestions`. Runtime collection:
`pahrump-hills-activities-v3`, bound to the exact `pahrump-hills-v1` terrain
manifest SHA-256. Terrain, routing costs and EVA arithmetic are unchanged.

## Delivered behavior

- Three objectives: rock textures, past water activity and mineral diversity.
- Fourteen activities: ten photography activities (including two orbital imaging
  candidates) and four proposed rock-chip collection activities.
- Four equipment capabilities: Field camera, Close-up imaging optics, Rock
  sampling tools and Labelled sample containers. Requirements remain visible;
  available items are green with a check, missing items yellow with a minus.
- One **Science missions** switch controls the 2D science markers, orbital
  polygons and original Buckskin finding. Ten distinct activity locations are
  shown; experiments and objectives sharing a location share its popup.
- Source evidence and proposed experiments remain distinct. Details retain
  provenance, collection plans and planning assumptions.

The layer is display-only. It does not modify terrain or route costs. It is
available in 2D; selected route waypoints are also visible in 3D.

## Selection and persistence

Activities at the same grid cell reuse one waypoint. Removing an activity removes
its generated stop only when no other activity shares it; pre-existing manual or
observation stops remain. Ownership transfers between activities sharing a stop.
Legacy snapshots without ownership metadata conservatively retain their stops.
Removing a route waypoint or confirming Clear all removes its activity associations.
Cancelling Clear all keeps both. Region changes reset science selections.

Equipment and objective choices do not silently remove already selected activities.
Missing equipment remains visible on those activity cards. All activity durations
are null; the user's time-per-stop applies once per physical stop, not per activity.

Mission format v3 stores oxygen settings alongside the collection, hash, choices
and waypoint associations; legacy v1/v2 missions still open. See the
[oxygen model](eva/oxygen-budget.md). Saved collection snapshots are preserved when the
runtime collection changes. Mission JSON and printable reports retain evidence,
procedures and original access positions. Reports disclose relocated stops.
The collection hash identifies the original source snapshot; it is not an
independent authenticity signature for a user-editable imported mission.

## Source preparation and reproducibility

- [Activity contract](science-activity-contract-proposal.md): independent parser,
  source, geometry, coverage and version rules.
- [Original source review](terrain/science-activity-review.md): MAHLI/APXS context
  for Pelona, Punchbowl and Pickhandle.
- [Water/mineral/orbital review](terrain/science-objectives-v2.md): published
  Garden City and CheMin evidence plus project-reviewed HiRISE imaging regions.
- [Sampling review](terrain/rock-sampling-v3.md): tool functions, collection
  planning assumptions and source links.

Earlier v1 and v2 collections are retained as source snapshots for the exporter
chain and compatibility tests. They are not loaded instead of v3 for a new plan.
The draft candidate inventory is historical research, not selectable runtime data.

Run exporters in order from the repository root:

```sh
python scripts/terrain/export_science_activities.py
python scripts/terrain/export_science_objectives_v2.py
python scripts/terrain/export_rock_sampling_v3.py
```

Review JSON must use LF line endings, matching `.gitattributes`. Provenance hashes
cover those exact bytes, so regeneration and clean Git checkouts agree on Windows
and other systems. Do not replace review input hashes to accept a changed source
without checking what changed.

## Local review

Run `npm run dev`, refresh the page, and open Science. Choose an objective, select
its required equipment and add activities. Test shared photography/sampling stops,
removal, Clear all cancellation/confirmation, saving/reopening and report export.
Use a fresh page for the latest collection; opening an older mission intentionally
restores its older evidence. Unavailable regions show an empty state; failed
science downloads offer Retry.

Run `npm test`, `npm run lint` and `npm run build` before merging. The
[merge review](science-suggestions-merge-review.md) records the current checks.

## Remaining scope

CRISM mineral rasters, thermal data, geologic units and hazards need independently
reviewed products; see [pending-layer preparation](terrain/pending-layer-next-steps.md).
Orbital candidates are project-authored imaging regions, not mineral detections or
proof of unvisited terrain. Sample availability, laboratory results, task duration,
payload budgets and certified Mars EVA equipment are not inferred.
