import type { SciencePlanSnapshot } from '../scienceSuggestions/model'

export function MissionBrief({ name, region, pahrump, sciencePlan, waypointCount, returnToStart }: {
  name: string | null
  region: string
  pahrump: boolean
  sciencePlan: SciencePlanSnapshot | null
  waypointCount: number
  returnToStart: boolean
}) {
  const selected = sciencePlan?.selections.map(selection => ({
    activity: sciencePlan.collection.activities.find(a => a.id === selection.activityId)!,
    waypoint: selection.waypointOrder,
  })) ?? []
  const objectiveIds = new Set(selected.flatMap(s => s.activity.objectiveIds))
  const objectives = sciencePlan?.collection.objectives.filter(o => objectiveIds.has(o.id)) ?? []
  const requiredIds = new Set(selected.flatMap(s => s.activity.requiredEquipmentIds))
  const equipment = sciencePlan?.collection.equipment.filter(e => requiredIds.has(e.id)) ?? []
  return <div className="mission-brief">
    <div className="section-heading"><h2>Mission brief</h2></div>
    <h3>{name ?? 'New exploration plan'}</h3>
    <p className="mission-brief-region">{region}</p>
    {pahrump && <section>
      <h3>Exploration area</h3>
      <p>Pahrump Hills lies at the base of Mount Sharp inside Gale Crater. Curiosity's investigations of its layered rocks provide context for studying past water activity and mineral diversity.</p>
      <a href="https://www.jpl.nasa.gov/images/pia18474-slopes-of-mount-sharp/" target="_blank" rel="noreferrer">NASA - Pahrump Hills setting</a>
    </section>}
    <section>
      <h3>Current plan</h3>
      <dl>
        <div><dt>Route</dt><dd>{waypointCount === 0 ? 'No waypoints placed' : `${waypointCount} waypoint${waypointCount === 1 ? '' : 's'} - ${returnToStart ? 'return to start' : 'one way'}`}</dd></div>
        <div><dt>Activities</dt><dd>{selected.length === 0 ? 'None selected' : `${selected.filter(s => s.activity.experimentType !== 'rock-sampling').length} imaging / ${selected.filter(s => s.activity.experimentType === 'rock-sampling').length} sampling`}</dd></div>
      </dl>
      {objectives.length > 0 && <><h3>Science objectives</h3><ul>{objectives.map(o => <li key={o.id}>{o.title}</li>)}</ul></>}
    </section>
    {selected.length > 0 && <section>
      <h3>Planned work</h3>
      <ol className="mission-brief-work">{selected.map(({ activity, waypoint }) => <li key={activity.id}><span>Waypoint {waypoint}</span><strong>{activity.title}</strong></li>)}</ol>
    </section>}
    {equipment.length > 0 && <section className="science-equipment">
      <h3>Required equipment</h3>
      <ul>{equipment.map(e => {
        const available = sciencePlan!.equipmentIds.includes(e.id)
        return <li key={e.id} className={available ? 'equipment-available' : 'equipment-missing'}>{e.name} - {available ? 'available' : 'missing'}</li>
      })}</ul>
    </section>}
  </div>
}
