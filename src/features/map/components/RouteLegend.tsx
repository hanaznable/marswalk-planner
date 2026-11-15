import type { RouteAlternatives } from '../../routing'
import type { OxygenAlternatives } from '../../eva/oxygenBudget'

export function RouteLegend({ routes, oxygen }: { routes: RouteAlternatives | null; oxygen?: OxygenAlternatives | null }) {
  if (!routes) return null
  return <div className="route-legend" aria-label="Route legend">
    <span><span className="legend-swatch shortest" aria-hidden="true" /> Shortest</span>
    <span><span className="legend-swatch slope-limited" aria-hidden="true" /> Slope-aware</span>
    {routes.terrain.legs.some(leg => leg.status === 'failed') && <span className="failed-route-legend"><span aria-hidden="true">--</span> No slope-aware connection</span>}
    {(oxygen?.shortest?.cutoffPoint || oxygen?.slopeAware?.cutoffPoint) && <span className="oxygen-shortfall"><span className="oxygen-budget-swatch" aria-hidden="true" /> Beyond O2 budget</span>}
  </div>
}
