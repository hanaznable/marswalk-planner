import type { TerrainState } from '../../features/map/useTerrainSource'

function terrainStatus(state: TerrainState): string {
  switch (state.status) {
    case 'loading':
      return 'LOADING TERRAIN PACKAGE'
    case 'error':
      return 'TERRAIN PACKAGE FAILED TO LOAD'
    case 'none':
      return 'NO TERRAIN PACKAGE FOR THIS REGION'
    case 'ready':
      return state.terrain.manifest.synthetic
        ? 'SYNTHETIC TERRAIN · NOT NASA DATA'
        : `TERRAIN ${state.terrain.manifest.id.toUpperCase()} LOADED · NO SCIENCE TARGETS YET`
  }
}

export function StatusBar({ terrainState }: { terrainState: TerrainState }) {
  return (
    <footer className="status-bar">
      <span>
        <span className="status-dot" /> LOCAL WORKSPACE
      </span>
      <span className="footer-center" role="status">
        {terrainStatus(terrainState)}
      </span>
      <span>
        MARSWALK <span className="muted">/</span> EXPLORATION STARTS HERE
      </span>
    </footer>
  )
}
