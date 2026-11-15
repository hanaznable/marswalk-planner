import { circleMarker, layerGroup, polygon } from 'leaflet'
import type { ScienceActivity, ScienceActivityCollection } from '../datasets/scienceActivities'
import type { TerrainPackage } from '../datasets/terrainPackage'
import { toLatLng } from '../map/waypointPlacement'
import { scienceMapLocations } from './mapLocations'

export interface ScienceMapOverlay {
  collection: ScienceActivityCollection | null
  visible: boolean
  equipmentIds: readonly string[]
  selectedActivityIds: readonly string[]
  onAdd: (activity: ScienceActivity) => boolean
}
const colors = { water: '#65c8c6', mineralogy: '#e59fdb', orbital: '#d2c278', textures: '#8db6ff' }

/** Geometry is in the same Mars projected frame as the active terrain. */
export function scienceEvidenceLayer(terrain: TerrainPackage, collection: ScienceActivityCollection, actions: { canAdd: (a: ScienceActivity) => boolean; add: (a: ScienceActivity) => boolean }) {
  const group = layerGroup()
  for (const { point, activities, kind } of scienceMapLocations(collection)) {
    const color = colors[kind]
    const popup = () => {
      const root = document.createElement('div')
      root.className = 'science-evidence-popup'
      const text = (tag: string, value: string) => { const n = document.createElement(tag); n.textContent = value; return n }
      for (const activity of activities) {
        const item = document.createElement('section')
        item.append(text('strong', activity.title), text('p', activity.experiment))
        item.append(text('p', activity.category === 'orbital-candidate' ? 'Orbital candidate - image-based follow-up area' : activity.experimentType === 'rock-sampling' ? 'Proposed rock sampling' : 'Historical follow-up'))
        const details = document.createElement('details')
        details.append(text('summary', 'Evidence and sources'))
        for (const e of collection.evidence.filter(e => activity.evidenceIds.includes(e.id))) {
          details.append(text('p', e.statement))
          for (const s of e.sources) {
            const link = document.createElement('a'); link.href = s.url; link.textContent = s.attribution; link.target = '_blank'; link.rel = 'noreferrer'; details.append(link, document.createElement('br'))
          }
        }
        if (activity.procedure) {
          details.append(text('h4', 'Collection plan'))
          const steps = document.createElement('ol')
          activity.procedure.steps.forEach(step => steps.append(text('li', step)))
          details.append(steps, text('p', activity.procedure.outcome))
          for (const s of activity.procedure.sources) {
            const link = document.createElement('a'); link.href = s.url; link.textContent = s.attribution; link.target = '_blank'; link.rel = 'noreferrer'; details.append(link, document.createElement('br'))
          }
        }
        item.append(details)
        const button = document.createElement('button')
        button.type = 'button'; button.className = 'context-add-waypoint'
        button.disabled = !actions.canAdd(activity)
        button.textContent = button.disabled ? 'Manage activity in Science' : 'Add to route'
        button.addEventListener('click', e => {
          e.stopPropagation()
          if (actions.add(activity)) {
            button.disabled = true
            button.textContent = 'Added to route'
          }
        })
        item.append(button)
        root.append(item)
      }
      return root
    }
    const accessIds = new Set(activities.map(a => a.access.evidenceId))
    for (const evidence of collection.evidence.filter(e => accessIds.has(e.id))) {
      if (evidence.footprint.type !== 'area') continue
      polygon(evidence.footprint.ring.map(([x, y]) => toLatLng(terrain.manifest.raster, { x, y })), { pane: 'historyContext', className: 'orbital-candidate-area', color, weight: 2, dashArray: '6 4', fillOpacity: .12, bubblingMouseEvents: false }).bindPopup(popup, { minWidth: 260, maxWidth: 320, maxHeight: 300 }).addTo(group)
    }
    circleMarker(toLatLng(terrain.manifest.raster, point), { pane: 'historyContext', className: `science-evidence-marker science-${kind}-marker`, radius: 6, color, weight: 2, fillOpacity: .65, bubblingMouseEvents: false }).bindPopup(popup, { minWidth: 260, maxWidth: 320, maxHeight: 300 }).addTo(group)
  }
  return group
}
