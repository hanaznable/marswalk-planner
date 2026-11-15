import type { MarsRegion } from './types'

// Only regions with a registered terrain package show terrain. Others show an
// explicit "no terrain package" state. No coordinates are assumed here.
export const regions: readonly MarsRegion[] = [
  {
    id: 'gale-pahrump-hills',
    name: 'Gale Crater - Pahrump Hills',
    terrain: { kind: 'package', datasetId: 'pahrump-hills-v1' },
  },
  { id: 'jezero', name: 'Jezero Crater', terrain: null },
  {
    id: 'synthetic-dev',
    name: 'Development: synthetic terrain (not NASA data)',
    terrain: { kind: 'synthetic' },
  },
]
