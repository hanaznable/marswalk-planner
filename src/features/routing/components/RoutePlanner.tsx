import { Icon } from '../../../components/ui/Icon'

export function RoutePlanner() {
  return (
    <div className="route-planner">
      <div className="section-heading">
        <h2>Your next expedition</h2>
        <span className="tag">DRAFT</span>
      </div>
      <p className="panel-description">Every discovery starts with a plan.</p>
      <div className="route-empty">
        <div className="route-diagram" aria-hidden="true">
          <span className="route-node" />
          <span className="route-dash" />
          <Icon name="pin" size={25} />
        </div>
        <h3>No route planned yet</h3>
        <p>
          Once surface data is available, this is where you’ll plan your
          exploration route.
        </p>
      </div>
      <button className="add-waypoint" disabled>
        <Icon name="plus" size={16} />
        Add first waypoint
        <Icon name="lock" size={13} />
      </button>
      <p className="availability-note">Available after map data integration</p>
      <div className="route-summary">
        <span className="eyebrow">ROUTE SUMMARY</span>
        <dl>
          <div>
            <dt>Waypoints</dt>
            <dd>—</dd>
          </div>
          <div>
            <dt>Total distance</dt>
            <dd>—</dd>
          </div>
          <div>
            <dt>Estimated duration</dt>
            <dd>—</dd>
          </div>
        </dl>
        <div className="summary-note">
          <Icon name="info" size={13} />
          <span>Route calculations are not implemented.</span>
        </div>
      </div>
    </div>
  )
}
