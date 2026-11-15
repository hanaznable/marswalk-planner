# Oxygen budget - source review and implementation

Reviewed 2026-11-15. Model ID: `nasa-bvad-mars-closed-loop-v1`.

## Primary sources

1. [NASA Life Support Baseline Values and Assumptions Document, Rev2, February 2022](https://ntrs.nasa.gov/api/citations/20210024855/downloads/BVAD_2.15.22-final.pdf#page=148),
   section 4.6.2, printed page 134 (PDF page 148). The Mars surface discussion
   gives **0.076 kg/hour** oxygen usage for a closed-loop PLSS scenario that
   consumes oxygen through metabolism and leakage. The following text separately
   discusses higher-demand technologies; this rate does not apply to all suits.
2. [NASA Suited for Spacewalking, revised August 1994](https://ntrs.nasa.gov/api/citations/19950007475/downloads/19950007475.pdf#page=26),
   printed page 17 (PDF page 26). EMU primary tanks contain **0.54 kg total**;
   the separate secondary oxygen pack is an emergency system and is excluded here.
   The primary capacity is a hardware reference, not a claim that an EMU is a
   Mars-qualified suit or that this model reproduces its certified endurance.
3. [NASA EVA Hardware & Operations Overview, 29 June 2012](https://ntrs.nasa.gov/api/citations/20120011735/downloads/20120011735.pdf#page=10),
   slide 10. The EMU operations breakdown includes a **30-minute reserve**.
   The app adopts 30 minutes as a project planning allowance; it is not a NASA
   Mars flight rule and is not the secondary oxygen pack's emergency duration.

The 2022 BVAD also lists a different metabolic-only baseline and lunar estimates.
They are not combined with the selected Mars closed-loop rate. In particular,
leakage is not added twice. The model uses the explicitly stated rate rather than
attempting to infer a personalized physiology equation from unrelated tables.

## Equation and units

This application derives a constant-rate **mass balance** from the NASA baseline:

```text
q = 0.076 kg O2 / (astronaut hour)
t_plan = path_distance / walking_speed + sum(outbound waypoint stop times)
t_reserve = 0.5 hours
m_required = q * (t_plan + t_reserve)
t_available_for_plan = max(0, m_departure / q - t_reserve)
m_remaining_at_time_t = m_departure - q * t
```

This algebra is the application's implementation, not a newly discovered NASA
physiological formula. Calculations use one astronaut and one independent supply.
The slider selects **usable primary oxygen at departure**, in kg, after any
preparation/pressurization losses. It does not select tank shell mass or internal
volume. Litres alone would need pressure, temperature and gas-state assumptions.

Default: 0.54 kg. Slider: 0.05-1.50 kg in 0.01 kg increments. Only the default is
the cited EMU primary capacity; other slider values are custom trade-study masses,
not asserted examples of flight hardware. For 0.54 kg the selected scenario yields
about 396 minutes after the planning reserve. This is an oxygen-only estimate,
not a replication of the EMU seven-hour operational specification.

## Time and geometry

The model traverses the actual calculated path in order at the user's walking
speed. It consumes time at every outbound waypoint after the start, including the
destination. When Return to start is selected, it also traverses the independently
computed return leg and does not add another stop on returning to the start.
Activities sharing a physical stop do not add extra stop time, consistent with
the current EVA duration model.

A boundary is interpolated along the actual path segment where the planning
budget runs out. If it runs out during a stop, the marker remains at that stop;
the summary distinguishes reaching all path metres from completing the work.
The marker is the **reserve boundary**, not the point of zero oxygen.

The 2D map retains the usual route styles for the funded prefix, adds amber
dashes beyond the budget and labels the boundary for each alternative. Both
alternatives have separate numerical summaries; identical routes need one marker.
Round-trip segments can overlap spatially: the summary and return-leg status
describe the chronological distance, which cannot be inferred from map color alone.
Failed routes receive no oxygen-reach prediction. Their existing red failure
connectors remain independent. Selected tank size never changes A* route costs.

Both **2D and 3D** use the same calculated oxygen paths and boundary points. The
3D overlay drapes these source-CRS paths onto the terrain, follows display
exaggeration, and shows the same amber dashed beyond-budget sections and O2
markers. Neither renderer recalculates the oxygen model.

## Boundaries

The constant rate does not model individual fitness, body mass, varying work rate,
grade-dependent metabolic demand, real suit leakage, regulator performance,
temperature, CO2 scrubbing, water, battery or thermal limits. Walking speed changes
elapsed time but does not invent a new workload-dependent oxygen coefficient.
Startup, prebreathe and airlock supplies are outside the departure inventory.
There are no refills. Emergency oxygen is not used to extend nominal reach.

A one-way reachable point does not imply a possible return. Selecting Return to
start includes that path in the estimate; the model still does not establish safe
or certified EVA endurance. A large tank cannot establish adequacy of other
life-support systems.

## Saved missions and reports

Mission format **v3** stores `settings.oxygenCapacityKg` and the oxygen model ID.
Formats v1 and v2 remain readable; opening them initializes the current default
explicitly in the planner. New builds reject unknown oxygen models and out-of-range
capacities. Older builds reject the new mission version instead of silently
dropping oxygen settings. This format version is independent of the science
collection's own v3 identifier.

JSON and printable reports preserve capacity, rate, reserve, source links,
required mass, shortfall, available/planned time and the source-CRS cutoff point.
The oxygen section does not duplicate full path geometry already exported in the
route section. Existing report format v1 receives the oxygen section additively.

## Validation

262 automated tests, lint and production build pass. Oxygen tests cover published
constants, mass balance, partial-cell interpolation, stopping-time depletion,
return-leg chronology, speed effects, failed paths, invalid capacities, report
metadata and mission-v3 persistence/validation.

Ten production-browser assertions pass: the default/reference supply, low-budget
markers and amber segments, speed changes, higher supply, return selection,
save/reopen, printable sources, mobile width and runtime exceptions.
