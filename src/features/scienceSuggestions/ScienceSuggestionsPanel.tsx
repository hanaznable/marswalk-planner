import type { ScienceSuggestions } from './useScienceSuggestions'
import './style.css'
import { Icon } from '../../components/ui/Icon'
export function ScienceSuggestionsPanel({ controller }: { controller: ScienceSuggestions }) {
  const c = controller
  if (c.status === 'none') return <section className="science-suggestions"><h2>Science suggestions</h2><p>No suggestions for this region yet.</p></section>
  if (!c.collection) return <section className="science-suggestions" role="status"><h2>Science suggestions</h2><p>{c.status === 'error' ? c.error : 'Loading suggestions…'}</p>{c.status === 'error' && <button onClick={c.retry}>Retry</button>}</section>
  const activities = c.collection.activities.filter(a => a.review.status === 'reviewed' && a.objectiveIds.includes(c.objective))
  return <section className="science-suggestions" aria-label="Science suggestions">
    <h2>Science suggestions</h2>
    {c.mismatch && <p role="status">Using the saved mission's science collection.</p>}
    <label className="science-objective">Objective<select value={c.objective} onChange={e => c.setObjective(e.target.value)}>{c.collection.objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
    <fieldset><legend>Equipment</legend>{c.collection.equipment.map(e => <label key={e.id}><input type="checkbox" checked={c.equipment.includes(e.id)} onChange={() => c.toggleEquipment(e.id)} />{e.name}</label>)}</fieldset>
    <div className="science-cards">{activities.map(a => {
      const selected = c.selected.some(s => s.activityId === a.id)
      const missing = a.requiredEquipmentIds.filter(id => !c.equipment.includes(id))
      return <article className={`science-card${selected ? ' is-selected' : ''}`} key={a.id}>
        <header className="science-card-header">
          <span className="science-category">{a.category === 'historical-follow-up' ? 'Historical follow-up' : 'Orbital candidate'}</span>
          {selected && <span className="science-added">On route</span>}
          <h3>{a.title}</h3>
        </header>
        <dl className="science-experiment"><dt>Proposed experiment</dt><dd>{a.experiment}</dd></dl>
        <div className="science-equipment">
          <strong>Required equipment</strong>
          <ul>{a.requiredEquipmentIds.map(id => {
            const available = c.equipment.includes(id)
            const name = c.collection!.equipment.find(e => e.id === id)!.name
            return <li key={id} className={available ? 'equipment-available' : 'equipment-missing'} aria-label={`${name}: ${available ? 'available' : 'missing'}`} title={available ? 'Available' : 'Missing'}>
              <Icon name={available ? 'check' : 'minus'} size={12} />{name}
            </li>
          })}</ul>
        </div>
        <details className="science-evidence"><summary>Why this stop?</summary>
          <section className="science-rationale"><h4>Scientific purpose</h4><p>{a.rationale}</p></section>
          <section className="science-evidence-list"><h4>{a.category === 'orbital-candidate' ? 'Orbital evidence' : 'Historical evidence'}</h4>
            {c.collection!.evidence.filter(e => a.evidenceIds.includes(e.id)).map(e => <article className="science-evidence-item" key={e.id}>
              <header><h5>{e.instrument === 'APXS' ? 'Chemical measurement' : e.instrument === 'MAHLI' ? 'Close-up imaging' : e.instrument}</h5><span>{e.instrument}</span></header>
              <dl className="science-evidence-meta"><dt>Target record</dt><dd>{e.targetName}</dd>{e.sol !== null && <><dt>Mission day</dt><dd>Sol {e.sol}</dd></>}</dl>
              <p>{e.statement}</p>
              {e.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer"><span>Read source ↗</span><small>{s.attribution}</small></a>)}
            </article>)}
          </section>
          {a.procedure && <section className="science-procedure"><h4>Collection plan</h4>
            <ol>{a.procedure.steps.map(step => <li key={step}>{step}</li>)}</ol>
            <p><strong>Planned output:</strong> {a.procedure.outcome}</p>
            {a.procedure.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.attribution}</a>)}
          </section>}
          <details className="science-technical"><summary>Methods and planning assumptions</summary><ul>{a.limitations.map(l => <li key={l}>{l}</li>)}</ul><p><strong>Timing:</strong> your time-per-stop setting.</p><p><strong>Equipment:</strong> planning assumptions.</p></details>
        </details>
        <button className={selected ? 'science-remove' : 'science-add'} disabled={!selected && missing.length > 0} onClick={() => selected ? c.remove(a.id) : c.add(a)}>{selected ? 'Remove activity' : 'Add to route'}</button>
      </article>
    })}</div>
    {!activities.length && <p>No activities match this objective.</p>}
    {c.selected.length > 0 && <details className="science-selection"><summary>Selected activities ({c.selected.length})</summary>{c.selected.map(s => <div key={s.activityId}>{c.collection!.activities.find(a => a.id === s.activityId)?.title}<button onClick={() => c.remove(s.activityId)}>Remove</button></div>)}</details>}
  </section>
}
