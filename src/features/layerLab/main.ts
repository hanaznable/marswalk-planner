import { CRS, circleMarker, imageOverlay, latLngBounds, layerGroup, map as createMap, polyline, rectangle } from 'leaflet'
import type { Layer, ImageOverlay } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { loadTerrainPackage } from '../datasets/loadTerrainPackage'
import { loadScienceTargets } from '../datasets/loadScienceTargets'
import { splitByCoverage } from '../datasets/scienceTargets'
import { mapToCell, rasterBounds } from '../datasets/terrainContract'
import { previewRgba, previewValues, type RasterPreview } from './rasterPreview'
import { loadSurfaceImage, surfaceImageryRegistry } from '../mapLayers/surfaceImagery'
import './style.css'

interface Point { x: number; y: number }
interface Observation extends Point { name: string; sol: number; flags: string[]; sourceLine: number }
interface LabContext {
  purpose: string
  terrainPackageId: string
  terrainManifestSha256: string
  apxsSource: { table_url: string }
  waypoints: (Point & { rmc: string; sol: number })[]
  observations: Observation[]
  traverseSegments: [number, number][][]
  mineralFindings: (Point & { name: string; description: string; sourceUrl: string })[]
  limitations: string[]
}
interface LayerEntry {
  id: string
  title: string
  detail: string
  status: string
  source: string
  layer?: Layer
  raster?: RasterPreview
  visible?: boolean
}

const base = import.meta.env.BASE_URL
const root = document.querySelector<HTMLDivElement>('#layer-lab')!
root.innerHTML = `
  <header><div><span class="eyebrow">DEVELOPER B - LOCAL DATA REVIEW</span><h1>Polaris Module <span>Layer Lab</span></h1></div><a class="app-link">Open planner ↗</a></header>
  <div class="lab-layout"><aside><p class="intro">Pahrump Hills - 1 × 1 km<br>Compare layers and send feedback. Previews do not change routing or approved targets.</p>
    <p id="load-status" role="status">Loading terrain and research context…</p><div id="layer-controls"></div>
    <section class="feedback"><h2>Your feedback</h2><label for="feedback-notes">Which layers help? What looks wrong or unclear?</label><textarea id="feedback-notes" rows="4" placeholder="Layer name, preferred opacity, observations…"></textarea><button id="download-feedback" disabled>Download feedback JSON</button><p>Saved locally with layer settings and the terrain version.</p></section>
  </aside><main><div class="map-wrap"><div id="lab-map" aria-label="Layer comparison map"></div><button id="fit-map">Fit study area</button></div>
    <div id="inspect" role="status">Move over the map to inspect the 5 m terrain cells.</div>
    <div class="notice">Research preview - absolute geolocation unverified. Color scales show measurements or declared terrain derivatives, not natural surface colors. No layer here certifies safe traversal.</div>
    <details><summary>Sources and review limitations</summary><ul id="limitations"></ul><p><a href="https://www.uahirise.org/dtm/dtm.php?ID=ESP_040770_1755" target="_blank" rel="noreferrer">HiRISE terrain - NASA/JPL-Caltech/UArizona</a></p></details>
  </main></div>`
root.querySelector<HTMLAnchorElement>('.app-link')!.href = base
const loadStatus = document.querySelector<HTMLParagraphElement>('#load-status')!
const controls = document.querySelector<HTMLDivElement>('#layer-controls')!
const feedbackButton = document.querySelector<HTMLButtonElement>('#download-feedback')!
const map = createMap('lab-map', { crs: CRS.Simple, minZoom: -4, maxZoom: 3, zoomSnap: 0.5, attributionControl: true })
map.attributionControl.addAttribution('NASA/JPL-Caltech/UArizona - NASA PDS - research previews')
map.setView([0, 0], 0)
const resize = new ResizeObserver(() => map.invalidateSize())
resize.observe(document.querySelector('#lab-map')!)
import.meta.hot?.dispose(() => { resize.disconnect(); map.remove() })

function textElement<K extends keyof HTMLElementTagNameMap>(tag: K, text: string, className = ''): HTMLElementTagNameMap[K] {
  const item = document.createElement(tag)
  item.textContent = text
  item.className = className
  return item
}

async function readJson(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.json()
}

async function start() {
  const manifestUrl = `${base}data/gale/pahrump-hills-v1/manifest.json`
  const [loaded, context, collection] = await Promise.all([
    loadTerrainPackage(manifestUrl),
    readJson(`${base}data/layer-lab/pahrump-hills-v1/context.json`) as Promise<LabContext>,
    loadScienceTargets(`${base}data/science/pahrump-hills-v1/targets.json`),
  ])
  const { terrain, basemapUrl } = loaded
  let colorError = ''
  const colorAsset = await loadSurfaceImage(base + surfaceImageryRegistry[terrain.manifest.id], manifestUrl, terrain)
    .catch((error: unknown) => { colorError = error instanceof Error ? error.message : String(error); return null })
  const colorUrl = colorAsset ? URL.createObjectURL(new Blob([colorAsset.bytes], { type: 'image/jpeg' })) : null
  import.meta.hot?.dispose(() => { if (colorUrl) URL.revokeObjectURL(colorUrl) })
  const { raster } = terrain.manifest
  if (context.purpose !== 'display-only-research-preview' || context.terrainPackageId !== terrain.manifest.id) throw new Error('Preview context does not match the terrain')
  const response = await fetch(manifestUrl)
  if (!response.ok) throw new Error('Could not verify terrain version')
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await response.arrayBuffer())), (v) => v.toString(16).padStart(2, '0')).join('')
  if (hash !== context.terrainManifestSha256 || hash !== collection.terrainManifestSha256) throw new Error('Terrain version changed; regenerate and review preview data')
  const extent = rasterBounds(raster)
  const bounds = latLngBounds([extent.minY, extent.minX], [extent.maxY, extent.maxX])
  const validPoint = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y) && mapToCell(raster, point) !== null
  if (![...context.waypoints, ...context.observations, ...context.mineralFindings].every(validPoint)) throw new Error('Preview points outside terrain coverage')
  for (const segment of context.traverseSegments) {
    if (segment.length !== 2 || !segment.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= extent.minX && x <= extent.maxX && y >= extent.minY && y <= extent.maxY)) throw new Error('Invalid clipped traverse segment')
  }
  map.fitBounds(bounds, { padding: [25, 25] })
  document.querySelector('#fit-map')!.addEventListener('click', () => map.fitBounds(bounds, { padding: [25, 25] }))
  rectangle(bounds, { color: '#e2b492', weight: 1, fill: false, interactive: false }).addTo(map)

  const entries: LayerEntry[] = []
  if (basemapUrl) {
    const image = imageOverlay(basemapUrl, bounds, { zIndex: 100, alt: 'Validated grayscale HiRISE orthoimage' })
    entries.push({ id: 'imagery', title: 'Grayscale surface imagery', detail: 'Existing DEM-aligned HiRISE orthoimage.', status: 'Existing data', source: 'https://www.uahirise.org/dtm/dtm.php?ID=ESP_040770_1755', layer: image, visible: true })
    image.on('error', () => { loadStatus.textContent = 'The grayscale image failed to load. Other loaded layers remain available.' })
  }
  const terrainSource = 'https://www.uahirise.org/dtm/dtm.php?ID=ESP_040770_1755'
  const rasterEntries: LayerEntry[] = [
    { id: 'elevation', raster: 'elevation', title: 'Elevation', detail: '5 m area-weighted heights, metres relative to the Mars datum. Negative heights are expected.', status: 'Existing data', source: terrainSource },
    { id: 'slope', raster: 'slope', title: 'Slope', detail: 'Maximum native-resolution Horn slope within each 5 m cell. Conservative; not a safety classification.', status: 'Existing data', source: terrainSource },
  ]
  function rasterLayer(entry: LayerEntry) {
    const kind = entry.raster!
    const preview = previewValues(terrain, kind)
    const canvas = document.createElement('canvas')
    canvas.width = raster.width; canvas.height = raster.height
    const drawing = canvas.getContext('2d')!
    const pixels = drawing.createImageData(raster.width, raster.height)
    for (let i = 0; i < preview.values.length; i++) pixels.data.set(previewRgba(preview.values[i], preview.min, preview.max, kind), i * 4)
    drawing.putImageData(pixels, 0, 0)
    return imageOverlay(canvas.toDataURL('image/png'), bounds, { opacity: 0.7, zIndex: 200 + rasterEntries.indexOf(entry), className: 'lab-raster', alt: entry.title })
  }
  entries.push(...rasterEntries)

  const science = layerGroup()
  for (const { target } of splitByCoverage(collection, terrain).inside) {
    circleMarker([target.position.y, target.position.x], { radius: 6, color: '#fcaf69', fillOpacity: 0.9 }).bindPopup(textElement('p', `${target.name}: drill-associated rover-position proxy. Activity sol ${target.activitySol}; position sol ${target.positionSol}. Uncertainty unstated.`)).addTo(science)
  }
  entries.push({ id: 'drill-sites', title: 'Reviewed drill proxies', detail: 'The three sourced drill activities already delivered to the planner. Positions are rover proxies.', status: 'Reviewed source associations', source: 'https://www.jpl.nasa.gov/images/pia21709-key-locations-studied-at-pahrump-hills-on-mars/', layer: science, visible: true })
  const apxs = layerGroup()
  const grouped = new Map<string, Observation[]>()
  for (const observation of context.observations) {
    const key = `${observation.x},${observation.y}`
    grouped.set(key, [...(grouped.get(key) ?? []), observation])
  }
  for (const group of grouped.values()) {
    const popup = document.createElement('div')
    popup.append(textElement('strong', `${group.length} APXS measurement record(s)`), textElement('p', 'Research candidates - rover-position proxies. Repeats and handled samples are not separate mission sites.'))
    const list = document.createElement('ul')
    for (const observation of group) list.append(textElement('li', `${observation.name} - sol ${observation.sol} - CSV row ${observation.sourceLine}${observation.flags.length ? ' - ' + observation.flags.join('; ') : ''}`))
    popup.append(list)
    const link = textElement('a', 'Published APXS table')
    link.href = context.apxsSource.table_url; link.target = '_blank'; link.rel = 'noreferrer'; popup.append(link)
    circleMarker([group[0].y, group[0].x], { radius: 6, color: group.some((o) => o.flags.length) ? '#fb9d6b' : '#bda1ff', fillOpacity: 0.8 }).bindPopup(popup, { maxHeight: 270 }).addTo(apxs)
  }
  entries.push({ id: 'apxs', title: 'APXS observation candidates', detail: `${context.observations.length} measurement records at ${grouped.size} coordinate pairs. Click markers for exact names and source flags. Orange marks a group with review flags.`, status: 'Research candidates', source: context.apxsSource.table_url, layer: apxs })
  const traverse = layerGroup()
  for (const segment of context.traverseSegments) polyline(segment.map(([x, y]) => [y, x]), { color: '#f6cf69', weight: 2, interactive: false }).addTo(traverse)
  entries.push({ id: 'traverse', title: 'Historical Curiosity traverse', detail: 'Spatially clipped source line. Not filtered to a campaign or sol range; not a proposed EVA route.', status: 'Historical context', source: 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json', layer: traverse })
  const minerals = layerGroup()
  for (const point of context.mineralFindings) {
    const popup = document.createElement('div')
    popup.append(textElement('strong', point.name), textElement('p', point.description))
    const link = textElement('a', 'NASA/JPL finding'); link.href = point.sourceUrl; link.target = '_blank'; link.rel = 'noreferrer'; popup.append(link)
    circleMarker([point.y, point.x], { radius: 9, color: '#e59fdb', weight: 3, fillOpacity: 0.3 }).bindPopup(popup).addTo(minerals)
  }
  entries.push({ id: 'minerals', title: 'Published mineral finding', detail: 'Buckskin: CheMin identified tridymite in a drilled sample. One sourced finding, not a continuous mineral-abundance map.', status: 'Published sample finding', source: context.mineralFindings[0].sourceUrl, layer: minerals })
  entries.push(
    { id: 'crism', title: 'CRISM mineral indicators', detail: 'Needs a validated overlapping scene, spectral products and quality masks. No raster supplied yet.', status: 'Awaiting validated data', source: 'https://pds-geosciences.wustl.edu/missions/mro/crism.htm' },
    { id: 'thermal', title: 'THEMIS thermal context', detail: 'Needs a validated product with acquisition time and scale. Nominal IR sampling is about 100 m; not an astronaut thermal model.', status: 'Awaiting validated data', source: 'https://themis-data.asu.edu/faq' },
    { id: 'geology', title: 'Geological units and contacts', detail: 'Needs a published, georeferenced map suitable for this footprint and scale.', status: 'Awaiting validated data', source: 'https://ode.rsl.wustl.edu/mars/' },
    { id: 'hazards', title: 'Surface hazards', detail: 'No verified dune, loose-material or block-field inventory. Slope cannot replace one.', status: 'Awaiting mapped evidence', source: terrainSource },
    { id: 'surface-color', title: 'Enhanced RGB surface imagery', detail: colorAsset ? `${colorAsset.manifest.colorCoverage}. Enhanced color with synthetic blue; empirical relative registration, absolute position unverified.` : `RGB unavailable: ${colorError}`, status: colorAsset ? 'Registered prototype' : 'Load failed', source: 'https://www.uahirise.org/ESP_039280_1755', layer: colorAsset && colorUrl ? imageOverlay(colorUrl, bounds, { zIndex: 110, alt: colorAsset.manifest.title }) : undefined },
  )

  const settings = new Map<string, { visible: boolean; opacity: number }>()
  const switches = new Map<string, HTMLInputElement>()
  function setVisible(entry: LayerEntry, visible: boolean) {
    if (visible && !entry.layer && entry.raster) {
      entry.layer = rasterLayer(entry)
      ;(entry.layer as ImageOverlay).setOpacity(settings.get(entry.id)!.opacity)
    }
    if (!entry.layer) return
    if (visible) entry.layer.addTo(map); else map.removeLayer(entry.layer)
    settings.get(entry.id)!.visible = visible
    switches.get(entry.id)!.checked = visible
  }
  for (const entry of entries) {
    const available = Boolean(entry.layer || entry.raster)
    const card = textElement('section', '', `layer-card${available ? '' : ' pending'}`)
    const label = textElement('label', '', 'layer-title')
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.disabled = !available
    checkbox.setAttribute('aria-label', `Show ${entry.title}`)
    label.append(checkbox, textElement('span', entry.title))
    card.append(label, textElement('span', entry.status, 'badge'), textElement('p', entry.detail))
    const source = textElement('a', 'Source ↗'); source.href = entry.source; source.target = '_blank'; source.rel = 'noreferrer'; card.append(source)
    settings.set(entry.id, { visible: Boolean(entry.visible), opacity: entry.raster ? 0.7 : 1 })
    switches.set(entry.id, checkbox)
    if (available) {
      checkbox.addEventListener('change', () => setVisible(entry, checkbox.checked))
      if (entry.layer) setVisible(entry, Boolean(entry.visible))
      if (entry.raster || entry.id === 'imagery') {
        const sliderLabel = textElement('label', 'Opacity ', 'opacity-label')
        const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.value = entry.raster ? '70' : '100'; slider.setAttribute('aria-label', `${entry.title} opacity`)
        slider.addEventListener('input', () => {
          const opacity = Number(slider.value) / 100
          settings.get(entry.id)!.opacity = opacity
          if (entry.layer) (entry.layer as ImageOverlay).setOpacity(opacity)
        })
        sliderLabel.append(slider); card.append(sliderLabel)
      }
      if (entry.raster) {
        const preview = previewValues(terrain, entry.raster)
        const legend = textElement('div', '', `legend legend-${entry.raster}`)
        legend.append(textElement('span', `${preview.min.toFixed(2)} — ${preview.max.toFixed(2)} ${preview.unit}`)); card.append(legend)
        const solo = textElement('button', 'Compare this layer alone')
        solo.addEventListener('click', () => { for (const other of entries) if (other.layer || other.raster) setVisible(other, other.id === entry.id) })
        card.append(solo)
      }
    }
    controls.append(card)
  }
  for (const limitation of context.limitations) document.querySelector('#limitations')!.append(textElement('li', limitation))
  map.on('mousemove', (event) => {
    const cell = mapToCell(raster, { x: event.latlng.lng, y: event.latlng.lat })
    const inspect = document.querySelector('#inspect')!
    if (!cell) { inspect.textContent = 'Outside the delivered terrain footprint.'; return }
    const index = cell.row * raster.width + cell.col
    inspect.textContent = `Cell ${cell.row}, ${cell.col} - elevation ${terrain.elevation[index].toFixed(2)} m - native-maximum slope ${terrain.slope[index].toFixed(2)}°`
  })
  feedbackButton.disabled = false
  feedbackButton.addEventListener('click', () => {
    const report = { kind: 'layer-lab-feedback', terrainPackageId: context.terrainPackageId, terrainManifestSha256: hash, createdAt: new Date().toISOString(), layers: Object.fromEntries(settings), notes: document.querySelector<HTMLTextAreaElement>('#feedback-notes')!.value }
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'polaris-layer-feedback.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
  loadStatus.textContent = `${entries.filter((entry) => entry.layer || entry.raster).length} testable layers - ${entries.filter((entry) => !entry.layer && !entry.raster).length} awaiting data/processing. No route inputs changed.`
}

start().catch((error: unknown) => {
  loadStatus.textContent = `Layer Lab could not load: ${error instanceof Error ? error.message : String(error)}. Reload to retry.`
  loadStatus.classList.add('error')
})
