# 3D terrain view

A read-only 3D view of the active terrain package, with the planner's
waypoints, routes, science targets and selected context layers. It reuses the
loaded `TerrainPackage`, the image URL the 2D map already resolved (orthoimage
or validated enhanced RGB), the route results from `useRoutePlan` and the
display-layer state. It fetches no data of its own and runs no routing,
slope or EVA calculation.

## Files

| File | Role |
| --- | --- |
| `sceneFrame.ts` | Source CRS ↔ scene coordinates, vertical origin, display scale (pure) |
| `terrainMesh.ts` | Mesh positions, UVs and triangles from the elevation layer (pure) |
| `overlays.ts` | Surface sampling and placement of routes, waypoints and markers (pure) |
| `terrainRenderer.ts` | Three.js scene, camera, controls, textures, labels and disposal |
| `Terrain3DView.tsx` | React wrapper and the view's controls; lazy-loaded |
| `Terrain3DPanel.tsx` | Lazy loading, error boundary and the no-WebGL fallback to 2D |

Three.js is loaded only when the 3D view is first opened. The 2D bundle does
not include it.

## Coordinate conventions

| Source (manifest CRS, north-up) | Scene (Three.js) |
| --- | --- |
| x = east (m) | +x = east |
| y = north (m) | −z = north (+z = south) |
| elevation (m, Mars datum) | +y = up |

- **Horizontal origin:** the centre of the raster footprint, derived from the
  manifest geotransform.
- **Vertical origin:** the midpoint of the valid elevation range of the loaded
  layer. Heights around −4,000 m are valid Mars-datum values; the offset only
  keeps scene numbers small. Readouts use the original package values.
- **Vertical scale:** 1× (true scale) by default. 2×, 3× and 5× are display
  settings shown on screen; they change scene heights only, never slope,
  distances, route costs or EVA estimates.
- **Mesh:** one vertex per elevation cell, at the cell centre, so route paths
  (which run through cell centres) sit exactly on mesh vertices. The surface
  therefore ends half a cell inside the footprint edge; nothing is
  extrapolated. A triangle is drawn only when all three vertices have data, so
  no-data cells stay holes.
- **Texture:** UVs are relative to the raster footprint, u east and v north
  (v = 1 at the north edge, matching image row 0 with the default flipY).
  `imageUvTransform` fits imagery with a different footprint; the current
  basemap and enhanced RGB manifests both match the raster footprint exactly.
- **Markers:** waypoints and science targets are drawn at their snapped
  routing-cell centres, as in 2D. APXS and mineral markers use their source
  positions. Heights come from the displayed surface plus a small lift
  (0.3 × cell size, scaled with the vertical scale) so lines and markers stay
  visible above the triangulated surface.
- **Lighting and normals:** artificial display lighting (not the historical
  Sun). Mesh normals are a rendering aid; slope always comes from the
  package's slope layer.

## Limits

- View only: waypoints are added and moved in the 2D map.
- The 3D view does not improve positional accuracy. Enhanced RGB keeps its
  stated caveats (relative registration, partial colour coverage, synthetic
  blue), and drill-site markers remain rover-position proxies.
- Marker labels are HTML overlays and are not hidden behind ridges.
