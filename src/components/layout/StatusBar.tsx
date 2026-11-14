import { datasetRegistry } from '../../features/datasets/registry'

export function StatusBar() {
  return (
    <footer className="status-bar">
      <span>
        <span className="status-dot" /> LOCAL WORKSPACE
      </span>
      <span className="footer-center">
        {datasetRegistry.length} DATASETS LOADED <span>/</span> NO MISSION DATA
        CONNECTED
      </span>
      <span>
        MARSWALK <span className="muted">/</span> EXPLORATION STARTS HERE
      </span>
    </footer>
  )
}
