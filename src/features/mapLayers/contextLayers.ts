import { circleMarker, layerGroup, polyline } from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'
import type { TerrainPackage } from '../datasets/terrainPackage'
import type { MapPoint } from '../datasets/terrainContract'
import { toLatLng } from '../map/waypointPlacement'
import type { MapContext, Observation } from './context'
import type { ContextDisplay } from './useDisplayLayers'
import type { WaypointOrigin } from '../datasets/waypointOrigin'
import { observationOrigin, mineralOrigin } from './waypointOrigins'

function node(tag: string, text: string) {
  const item = document.createElement(tag)
  item.textContent = text
  return item
}
function sourceLink(url: string) {
  const link = document.createElement('a')
  link.href = url; link.target = '_blank'; link.rel = 'noreferrer'; link.textContent = 'View source ↗'
  return link
}

export function ensureDisplayPanes(map: LeafletMap) {
  for (const [name, order] of [['baseSurface', 200], ['dataRaster', 300], ['historyContext', 350]] as const) {
    if (!map.getPane(name)) map.createPane(name).style.zIndex = String(order)
  }
}

export interface ContextWaypointActions {
  existingAt: (point: MapPoint) => string | null
  add: (point: MapPoint, label: string, origin: WaypointOrigin) => void
}

function waypointButton(point: MapPoint, label: string, actions: ContextWaypointActions, popup: HTMLElement, origin: WaypointOrigin) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'context-add-waypoint'
  button.setAttribute('aria-label', `Add ${label} as waypoint`)
  const existing = actions.existingAt(point)
  button.disabled = existing !== null
  button.textContent = existing ? `Already a waypoint (${existing})` : 'Add as waypoint'
  button.addEventListener('click', (event) => {
    event.stopPropagation()
    actions.add(point, label, origin)
    // All records in this popup share one rover position/routing cell.
    for (const item of popup.querySelectorAll<HTMLButtonElement>('.context-add-waypoint')) {
      item.disabled = true
      item.textContent = 'Position added as waypoint'
    }
  })
  return button
}

export function contextLayer(terrain: TerrainPackage, context: MapContext, kind: ContextDisplay, actions: ContextWaypointActions) {
  const group = layerGroup()
  const { raster } = terrain.manifest
  if (kind === 'apxs') {
    const grouped = new Map<string, Observation[]>()
    for (const point of context.observations) {
      const key = `${point.x},${point.y}`
      grouped.set(key, [...(grouped.get(key) ?? []), point])
    }
    for (const points of grouped.values()) {
      circleMarker(toLatLng(raster, points[0]), { pane: 'historyContext', className: 'apxs-marker', bubblingMouseEvents: false, radius: 6, color: points.some((point) => point.flags.length) ? '#fb9d6b' : '#bda1ff', weight: 2, fillOpacity: 0.85 }).bindPopup(() => {
        const popup = document.createElement('div')
        popup.className = 'apxs-popup'
        popup.append(node('strong', points.length === 1 ? points[0].name : `${points.length} APXS observations`))
        const list = document.createElement('ul')
        list.className = 'apxs-records'
        for (const point of points) {
          const item = document.createElement('li')
          if (points.length > 1) item.append(node('h4', point.name))
          const fields = document.createElement('dl')
          for (const [label, value] of [
            ['Target', point.name],
            ['Mission', 'NASA Curiosity'],
            ['Instrument', 'APXS - Alpha Particle X-ray Spectrometer'],
            ['Experiment', 'Elemental composition measurement'],
            ['Mission day', `Sol ${point.sol}`],
            ['Map position', 'Associated rover position'],
          ]) {
            fields.append(node('dt', label), node('dd', value))
          }
          item.append(fields)
          if (point.flags.length) item.append(node('p', `Source review flags: ${point.flags.join('; ')}`))
          item.append(waypointButton(point, `APXS: ${point.name} (rover proxy)`, actions, popup, observationOrigin(context, point)))
          const source = document.createElement('details')
          source.append(node('summary', 'Source record'))
          source.append(node('p', `Table row: ${point.sourceLine}. This identifies the measurement's row in the published CSV data table.`), sourceLink(context.apxsSource.table_url))
          item.append(source)
          list.append(item)
        }
        popup.append(list)
        return popup
      }, { className: 'apxs-observation-popup', minWidth: 280, maxWidth: 320, maxHeight: 380 }).addTo(group)
    }
  } else if (kind === 'traverse') {
    for (const segment of context.traverseSegments) polyline(segment.map(([x, y]) => toLatLng(raster, { x, y })), { pane: 'historyContext', className: 'historical-traverse', color: '#f6cf69', weight: 2, interactive: false }).addTo(group)
  } else {
    for (const point of context.mineralFindings) {
      circleMarker(toLatLng(raster, point), { pane: 'historyContext', className: 'mineral-marker', bubblingMouseEvents: false, radius: 9, color: '#e59fdb', weight: 3, fillOpacity: 0.3 }).bindPopup(() => {
        const popup = document.createElement('div')
        popup.append(node('strong', point.name), node('p', point.description), sourceLink(point.sourceUrl), waypointButton(point, `${point.name} (rover proxy)`, actions, popup, mineralOrigin(point)))
        return popup
      }).addTo(group)
    }
  }
  return group
}
