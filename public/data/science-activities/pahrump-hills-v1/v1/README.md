# Pahrump Hills science activities v1

Three project-authored historical follow-ups: Pelona, Punchbowl and Pickhandle.
This retained source snapshot is used by later exporters and legacy mission tests.
New plans load v3 instead; see the current implementation guide. Sources remain
available in expandable details when this snapshot is restored from a saved plan.

APXS records supply target metadata and rover-position proxies. Independent
imaging context comes from [McBride et al., LPSC 2015 abstract 2855](https://www.hou.usra.edu/meetings/lpsc2015/pdf/2855.pdf).
See [the content review](../../../../../docs/terrain/science-activity-review.md).
No new chemical/mineral result, exact rock geometry or imaging sol is inferred.
Camera equipment is a scenario assumption; activity durations are null.

The source/content review was performed by Codex for Developer B on 2026-11-15.
It is not independent scientific/positional certification or approval of a real EVA.
Sources and limitations remain in the collection and provenance.

Regenerate from the repository root:

```sh
python scripts/terrain/export_science_activities.py
npm test
```

The exporter checks the terrain/context snapshots recorded in the candidate
inventory. It fetches no raw data and changes no existing terrain/science assets.
`provenance.json` records input/output hashes and source sections.
The [revised proposal](../../../../../docs/science-activity-contract-proposal.md)
describes the new parser's independent schema. Garden City, Buckskin and orbital
candidates are not delivered in this collection.
