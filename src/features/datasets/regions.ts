import type { MarsRegion } from './types'

// Navigation choices only. No coordinates, coverage, or observations are assumed.
export const regions: readonly MarsRegion[] = [
  { id: 'jezero', name: 'Jezero Crater' },
  { id: 'gale', name: 'Gale Crater' },
]
