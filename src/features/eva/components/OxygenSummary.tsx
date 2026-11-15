import type { OxygenAlternatives } from '../oxygenBudget'
import { formatDuration } from '../evaEstimate'

export function OxygenSummary({ oxygen }: { oxygen: OxygenAlternatives | null }) {
  if (!oxygen) return null
  return <section className="oxygen-summary" aria-label="Oxygen budget">
    <h3>Oxygen reach estimate</h3>
    <p>Per astronaut - 30 min planning reserve included</p>
    {([['Shortest', oxygen.shortest], ['Slope-aware', oxygen.slopeAware]] as const).map(([label, budget]) => <div className="oxygen-budget-row" key={label}>
      <strong>{label}</strong>
      {budget ? <>
        <span className={budget.withinBudget ? 'oxygen-enough' : 'oxygen-shortfall'}>{budget.withinBudget ? 'Within budget' : budget.cutoffPhase === 'stop' ? 'Budget ends during a stop' : budget.cutoffLegKind === 'return' ? 'Budget ends on the return leg' : 'Oxygen budget exceeded'}</span>
        <meter min={0} max={budget.totalDistanceMeters || 1} value={budget.reachableDistanceMeters} aria-label={`${label} distance within oxygen budget`} />
        <span>{Math.round(budget.reachableDistanceMeters)} / {Math.round(budget.totalDistanceMeters)} m within budget</span>
        <span>{formatDuration(budget.availableMinutes)} available / {formatDuration(budget.requiredMinutes)} planned</span>
        <span>O2: {budget.requiredKg.toFixed(3)} kg required / {budget.capacityKg.toFixed(2)} kg available</span>
      </> : <span>No complete route</span>}
    </div>)}
  </section>
}
