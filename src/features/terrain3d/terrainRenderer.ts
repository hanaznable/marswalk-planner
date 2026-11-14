/**
 * Three.js scene for the 3D terrain view. Framework-free: the React wrapper
 * creates one instance per mount and calls `dispose()` on unmount, which
 * releases every geometry, material, texture, DOM label, listener and the
 * WebGL context.
 *
 * Rendering is on demand (after camera moves, data changes and resizes), not a
 * continuous loop. Nothing here creates or edits waypoints.
 */
import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NearestFilter,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import type { PlacedTarget } from '../datasets/scienceTargets'
import { cellCenterToMap, mapToCell, type MapPoint, type RasterGrid } from '../datasets/terrainContract'
import { elevationAt, type TerrainPackage } from '../datasets/terrainPackage'
import type { MapContext, Observation } from '../mapLayers/context'
import type { RouteAlternatives, Waypoint } from '../routing'
import { drapeSegment, overlayLift, routeLines, surfacePoint, waypointAnchors } from './overlays'
import {
  createSceneFrame,
  elevationRange,
  footprintHalfSize,
  fromScene,
  type SceneFrame,
} from './sceneFrame'
import { buildTerrainMesh, imageUvTransform } from './terrainMesh'

export interface OverlayInput {
  readonly waypoints: readonly Waypoint[]
  readonly routes: RouteAlternatives | null
  readonly targets: readonly PlacedTarget[]
  readonly selectedTargetId: string | null
  readonly context: MapContext | null
  readonly showApxs: boolean
  readonly showTraverse: boolean
  readonly showMinerals: boolean
}

export interface Readout {
  /** Metres east/north of the footprint's south-west corner, as in the report. */
  readonly east: number
  readonly north: number
  /** Original package values; null where there is no data. */
  readonly elevation: number | null
  readonly slope: number | null
}

export interface RendererCallbacks {
  onTargetClick: (id: string) => void
  onReadout: (readout: Readout | null) => void
  onImageError: () => void
  onContextLost: () => void
}

const CAMERA_TILT = (40 * Math.PI) / 180

/** CSS colour variable from the app theme, so 3D lines match the 2D legend. */
function themeColour(name: string, fallback: string): Color {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return new Color(value || fallback)
}

function disposeTree(root: Object3D) {
  root.traverse((object) => {
    const item = object as Partial<Mesh>
    item.geometry?.dispose()
    const material = item.material as Material | Material[] | undefined
    for (const entry of Array.isArray(material) ? material : material ? [material] : []) entry.dispose()
  })
}

export class TerrainRenderer {
  private readonly renderer: WebGLRenderer
  private readonly labels: CSS2DRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(45, 1, 1, 10000)
  private readonly controls: OrbitControls
  private readonly overlayGroup = new Group()
  private readonly raycaster = new Raycaster()
  private readonly resizeObserver: ResizeObserver
  private readonly container: HTMLElement
  private readonly callbacks: RendererCallbacks

  private terrain: TerrainPackage | null = null
  private frame: SceneFrame | null = null
  private geometry: BufferGeometry | null = null
  private surface: Mesh | null = null
  private surfaceMaterial: MeshLambertMaterial | null = null
  private overlayMesh: Mesh | null = null
  private overlayMaterial: MeshBasicMaterial | null = null
  private imageTexture: Texture | null = null
  private fallbackTexture: Texture | null = null
  private rasterTexture: Texture | null = null
  private overlayInput: OverlayInput | null = null
  private verticalScale = 1
  private frameRequest = 0
  private pointerRequest = 0
  private imageToken = 0
  private disposed = false
  /** True once the user orbits, pans or zooms; until then resizes re-frame the footprint. */
  private userMoved = false

  constructor(container: HTMLElement, callbacks: RendererCallbacks) {
    this.container = container
    this.callbacks = callbacks
    // Throws when WebGL is unavailable; the React wrapper shows the 2D fallback.
    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x101313)
    this.renderer.domElement.className = 'terrain3d-canvas'
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost)
    container.append(this.renderer.domElement)

    this.labels = new CSS2DRenderer()
    this.labels.domElement.className = 'terrain3d-labels'
    container.append(this.labels.domElement)

    // Artificial display lighting (not the historical Sun), kept soft because
    // the orthoimage already carries real illumination.
    this.scene.add(new AmbientLight(0xffffff, 1.9))
    const sun = new DirectionalLight(0xffffff, 1.1)
    sun.position.set(-1, 1.4, -1)
    this.scene.add(sun)
    this.scene.add(this.overlayGroup)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.screenSpacePanning = false
    this.controls.maxPolarAngle = (84 * Math.PI) / 180
    this.controls.addEventListener('change', this.handleControlsChange)
    this.controls.addEventListener('start', this.handleControlsStart)

    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove)
    this.renderer.domElement.addEventListener('pointerleave', this.handlePointerLeave)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
  }

  setTerrain(terrain: TerrainPackage) {
    if (terrain === this.terrain) return
    this.clearTerrain()
    const range = elevationRange(terrain.elevation)
    if (!range) throw new Error('The terrain package has no valid elevation samples.')
    this.terrain = terrain
    this.frame = createSceneFrame(terrain.manifest.raster, range, this.verticalScale)
    const mesh = buildTerrainMesh(terrain.manifest.raster, terrain.elevation, { ...this.frame, verticalScale: 1 })
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3))
    geometry.setAttribute('uv', new BufferAttribute(mesh.uvs, 2))
    geometry.setIndex(new BufferAttribute(mesh.indices, 1))
    // Normals are a lighting aid only; slope always comes from the package layer.
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    this.geometry = geometry

    this.surfaceMaterial = new MeshLambertMaterial({ side: DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
    this.surface = new Mesh(geometry, this.surfaceMaterial)
    this.surface.scale.y = this.verticalScale
    this.scene.add(this.surface)

    const { halfX, halfZ } = footprintHalfSize(terrain.manifest.raster)
    const extent = Math.max(halfX, halfZ) * 2
    this.camera.near = Math.max(0.5, extent / 2000)
    this.camera.far = extent * 20
    this.camera.updateProjectionMatrix()
    this.controls.minDistance = Math.max(10, extent / 100)
    this.controls.maxDistance = extent * 3
    this.resetView()
    this.rebuildOverlays()
  }

  /** Orthoimage or enhanced RGB; null shows an elevation-coloured surface instead. */
  setImage(url: string | null, footprint: RasterGrid | null, fallback: HTMLCanvasElement | null) {
    const token = ++this.imageToken
    this.imageTexture?.dispose()
    this.imageTexture = null
    this.fallbackTexture?.dispose()
    this.fallbackTexture = fallback ? this.canvasTexture(fallback, LinearFilter) : null
    this.applyBaseTexture(this.fallbackTexture)
    if (!url || !this.terrain) return
    const raster = this.terrain.manifest.raster
    new TextureLoader().load(
      url,
      (texture) => {
        if (this.disposed || token !== this.imageToken) {
          texture.dispose()
          return
        }
        texture.colorSpace = SRGBColorSpace
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
        texture.minFilter = LinearMipmapLinearFilter
        if (footprint) {
          const { repeat, offset } = imageUvTransform(raster, footprint)
          texture.repeat.set(...repeat)
          texture.offset.set(...offset)
        }
        this.imageTexture = texture
        this.applyBaseTexture(texture)
      },
      undefined,
      () => {
        if (!this.disposed && token === this.imageToken) this.callbacks.onImageError()
      },
    )
  }

  /** Elevation or slope colour layer draped on the surface (same pixels as 2D). */
  setRasterOverlay(canvas: HTMLCanvasElement | null, opacity: number) {
    this.rasterTexture?.dispose()
    this.rasterTexture = null
    if (this.overlayMesh) this.scene.remove(this.overlayMesh)
    this.overlayMaterial?.dispose()
    this.overlayMesh = null
    this.overlayMaterial = null
    if (canvas && this.geometry) {
      this.rasterTexture = this.canvasTexture(canvas, NearestFilter)
      this.overlayMaterial = new MeshBasicMaterial({ map: this.rasterTexture, transparent: true, opacity, depthWrite: false, side: DoubleSide })
      this.overlayMesh = new Mesh(this.geometry, this.overlayMaterial)
      this.overlayMesh.scale.y = this.verticalScale
      this.overlayMesh.renderOrder = 1
      this.scene.add(this.overlayMesh)
    }
    this.requestRender()
  }

  setOverlays(input: OverlayInput) {
    this.overlayInput = input
    this.rebuildOverlays()
  }

  /** Display-only exaggeration; package values and planning results are untouched. */
  setVerticalScale(scale: number) {
    if (scale === this.verticalScale) return
    const ratio = scale / this.verticalScale
    this.verticalScale = scale
    if (this.surface) this.surface.scale.y = scale
    if (this.overlayMesh) this.overlayMesh.scale.y = scale
    if (this.frame) this.frame = { ...this.frame, verticalScale: scale }
    this.controls.target.y *= ratio
    this.rebuildOverlays()
  }

  /** Frames the whole footprint from the south, looking north. */
  resetView() {
    if (!this.terrain) return
    const { halfX, halfZ } = footprintHalfSize(this.terrain.manifest.raster)
    // Closest distance at which all four footprint corners stay inside the view.
    const corners = [[-halfX, -halfZ], [halfX, -halfZ], [-halfX, halfZ], [halfX, halfZ]].map(([x, z]) => new Vector3(x, 0, z))
    const place = (distance: number) => {
      this.camera.position.set(0, distance * Math.sin(CAMERA_TILT), distance * Math.cos(CAMERA_TILT))
      this.camera.lookAt(0, 0, 0)
      this.camera.updateMatrixWorld()
    }
    const fits = (distance: number) => {
      place(distance)
      return corners.every((corner) => {
        const ndc = corner.clone().project(this.camera)
        return Math.abs(ndc.x) <= 0.92 && Math.abs(ndc.y) <= 0.85
      })
    }
    let near = Math.max(halfX, halfZ) * 0.5
    let far = Math.max(halfX, halfZ) * 8
    for (let i = 0; i < 30; i++) {
      const middle = (near + far) / 2
      if (fits(middle)) far = middle
      else near = middle
    }
    place(far)
    this.userMoved = false
    this.controls.target.set(0, 0, 0)
    this.controls.update()
    this.requestRender()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frameRequest)
    cancelAnimationFrame(this.pointerRequest)
    this.resizeObserver.disconnect()
    this.controls.removeEventListener('change', this.handleControlsChange)
    this.controls.removeEventListener('start', this.handleControlsStart)
    this.controls.dispose()
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointermove', this.handlePointerMove)
    canvas.removeEventListener('pointerleave', this.handlePointerLeave)
    canvas.removeEventListener('webglcontextlost', this.handleContextLost)
    this.clearTerrain()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    canvas.remove()
    this.labels.domElement.remove()
  }

  private clearTerrain() {
    this.clearOverlays()
    this.setRasterOverlay(null, 0)
    if (this.surface) this.scene.remove(this.surface)
    this.surfaceMaterial?.dispose()
    this.geometry?.dispose()
    this.imageTexture?.dispose()
    this.fallbackTexture?.dispose()
    this.surface = null
    this.surfaceMaterial = null
    this.geometry = null
    this.imageTexture = null
    this.fallbackTexture = null
    this.terrain = null
    this.frame = null
  }

  private canvasTexture(canvas: HTMLCanvasElement, filter: typeof NearestFilter | typeof LinearFilter) {
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.magFilter = filter
    texture.minFilter = filter
    texture.generateMipmaps = false
    return texture
  }

  private applyBaseTexture(texture: Texture | null) {
    if (!this.surfaceMaterial) return
    this.surfaceMaterial.map = texture
    this.surfaceMaterial.color.set(texture ? 0xffffff : 0x8a8f8c)
    this.surfaceMaterial.needsUpdate = true
    this.requestRender()
  }

  private clearOverlays() {
    for (const child of [...this.overlayGroup.children]) {
      this.overlayGroup.remove(child)
      disposeTree(child)
    }
    // CSS2DObjects remove their own elements when detached; clear any stragglers.
    this.labels.domElement.replaceChildren()
  }

  private rebuildOverlays() {
    this.clearOverlays()
    const terrain = this.terrain
    const frame = this.frame
    const input = this.overlayInput
    if (!terrain || !frame || !input) return this.requestRender()

    if (input.context && input.showTraverse) {
      const pairs = input.context.traverseSegments.flatMap(([a, b]) =>
        drapeSegment(terrain, frame, { x: a[0], y: a[1] }, { x: b[0], y: b[1] }),
      )
      if (pairs.length > 0) {
        const geometry = new LineSegmentsGeometry().setPositions(pairs)
        this.overlayGroup.add(new LineSegments2(geometry, this.lineMaterial(new Color('#f6cf69'), 2)))
      }
    }

    if (input.routes) {
      // Same pairing as 2D: slope-aware solid underneath, shortest dashed on top.
      this.addRoute(routeLines(terrain, frame, input.routes.terrain), themeColour('--route-slope-aware', '#3987e5'), 4, false)
      this.addRoute(routeLines(terrain, frame, input.routes.distance), themeColour('--route-shortest', '#c98500'), 3, true)
    }

    if (input.context && input.showApxs) {
      const grouped = new Map<string, Observation[]>()
      for (const point of input.context.observations) {
        const key = `${point.x},${point.y}`
        grouped.set(key, [...(grouped.get(key) ?? []), point])
      }
      for (const points of grouped.values()) {
        const flagged = points.some((point) => point.flags.length > 0)
        const names = points.map((point) => `${point.name} (sol ${point.sol})`).join(', ')
        this.addLabel(points[0], `terrain3d-dot apxs${flagged ? ' flagged' : ''}`, '', `APXS at an associated rover position: ${names}`)
      }
    }
    if (input.context && input.showMinerals) {
      for (const point of input.context.mineralFindings) {
        this.addLabel(point, 'terrain3d-dot mineral', '', `${point.name}: ${point.description}`)
      }
    }

    // Same anchor as the 2D marker: the target's snapped routing cell centre.
    for (const { target, cell } of input.targets) {
      const point = cellCenterToMap(terrain.manifest.raster, cell)
      const selected = target.id === input.selectedTargetId
      // Nearby targets would overlap, so only the selected one is named (as in the details card).
      const label = this.addLabel(point, `terrain3d-target${selected ? ' selected' : ''}`, selected ? target.name : '', `${target.name}. Select to show details.`, 'button')
      label?.addEventListener('click', () => this.callbacks.onTargetClick(target.id))
    }

    for (const anchor of waypointAnchors(terrain, frame, input.waypoints)) {
      const element = document.createElement('div')
      element.className = `waypoint-marker waypoint-${anchor.kind} terrain3d-waypoint`
      element.textContent = anchor.text
      element.title = anchor.title
      element.setAttribute('role', 'img')
      element.setAttribute('aria-label', anchor.title)
      const object = new CSS2DObject(element)
      // Slightly higher than a target on the same cell, so the label sort draws the waypoint on top, as in 2D.
      object.position.set(anchor.position.x, anchor.position.y + overlayLift(terrain) * frame.verticalScale, anchor.position.z)
      this.overlayGroup.add(object)
    }
    this.requestRender()
  }

  private addRoute(lines: Float32Array[], colour: Color, width: number, dashed: boolean) {
    for (const line of lines) {
      const geometry = new LineGeometry().setPositions(line)
      const object = new Line2(geometry, this.lineMaterial(colour, width, dashed))
      if (dashed) object.computeLineDistances()
      this.overlayGroup.add(object)
    }
  }

  private lineMaterial(colour: Color, width: number, dashed = false) {
    const size = this.renderer.getSize(new Vector2())
    return new LineMaterial({
      color: colour.getHex(),
      linewidth: width,
      dashed,
      dashSize: 8,
      gapSize: 6,
      resolution: size,
    })
  }

  private addLabel(point: MapPoint, className: string, text: string, title: string, tag: 'div' | 'button' = 'div') {
    if (!this.terrain || !this.frame) return null
    const position = surfacePoint(this.terrain, this.frame, point)
    if (!position) return null
    const element = document.createElement(tag)
    element.className = className
    element.title = title
    if (tag === 'button') {
      element.setAttribute('type', 'button')
      element.setAttribute('aria-label', title)
    } else {
      element.setAttribute('role', 'img')
      element.setAttribute('aria-label', title)
    }
    if (text) {
      const span = document.createElement('span')
      span.textContent = text
      element.append(span)
    }
    const object = new CSS2DObject(element)
    object.position.set(position.x, position.y, position.z)
    this.overlayGroup.add(object)
    return element
  }

  private resize() {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    this.renderer.setSize(width, height)
    this.labels.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    if (!this.userMoved) this.resetView()
    this.requestRender()
  }

  private requestRender() {
    if (this.disposed || this.frameRequest) return
    this.frameRequest = requestAnimationFrame(() => {
      this.frameRequest = 0
      if (this.disposed) return
      this.renderer.render(this.scene, this.camera)
      this.labels.render(this.scene, this.camera)
    })
  }

  private readonly handleControlsStart = () => {
    this.userMoved = true
  }

  private readonly handleControlsChange = () => {
    // Keep the orbit centre over the footprint so the terrain cannot be lost.
    if (this.terrain) {
      const { halfX, halfZ } = footprintHalfSize(this.terrain.manifest.raster)
      const target = this.controls.target
      target.x = Math.min(Math.max(target.x, -halfX), halfX)
      target.z = Math.min(Math.max(target.z, -halfZ), halfZ)
    }
    this.requestRender()
  }

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (this.pointerRequest || event.buttons !== 0) return
    const { clientX, clientY } = event
    this.pointerRequest = requestAnimationFrame(() => {
      this.pointerRequest = 0
      this.callbacks.onReadout(this.readoutAt(clientX, clientY))
    })
  }

  private readonly handlePointerLeave = () => this.callbacks.onReadout(null)

  private readonly handleContextLost = (event: Event) => {
    event.preventDefault()
    if (!this.disposed) this.callbacks.onContextLost()
  }

  private readoutAt(clientX: number, clientY: number): Readout | null {
    if (!this.surface || !this.terrain || !this.frame) return null
    const rect = this.renderer.domElement.getBoundingClientRect()
    const pointer = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(pointer, this.camera)
    const hit = this.raycaster.intersectObject(this.surface, false)[0]
    if (!hit) return null
    const { raster } = this.terrain.manifest
    const source = fromScene(this.frame, hit.point)
    const cell = mapToCell(raster, source)
    if (!cell) return null
    const [x0, , , y0, , dy] = raster.geoTransform
    const slope = this.terrain.slope[cell.row * raster.width + cell.col]
    return {
      east: source.x - x0,
      north: source.y - (y0 + raster.height * dy),
      elevation: elevationAt(this.terrain, cell),
      slope: Number.isFinite(slope) ? slope : null,
    }
  }
}
