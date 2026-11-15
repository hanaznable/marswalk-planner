# 2D map boundary

`MapCanvas` owns the Leaflet instance, cleanup, resizing, imagery, route and
marker rendering, and pointer/keyboard navigation. `MapViewport` composes 2D and
lazy-loaded 3D views. `LayersPanel` controls display layers and exposes terrain
source information. Calculations and data preparation remain outside renderers.

`useTerrainSource` loads the selected real package with explicit loading, error
and retry states. Regions without a package stay empty. Synthetic terrain is
available only through its explicitly labelled development selection.

Leaflet uses `CRS.Simple` with local metres east/north of the raster's south-west
corner. Explicit helpers convert to/from the source Mars projected CRS retained
in the manifest. This is a georeferenced local terrain view, without Earth tiles
or Earth geodesic calculations. The optional metric grid is drawn over terrain in map coordinates and scales
with zoom. Edge labels show local east/north metres from the south-west origin;
labels thin out when crowded. The map toolbar distinguishes display spacing from
routing cell size. A metric scale bar remains visible with the grid off, using
CRS.Simple Euclidean distances. These controls do not change routing.

Waypoints, routes and science selections use shared domain state. Layer visibility
does not change route calculations. The independent `../terrain3d/` feature
renders the same planner state; route editing remains in 2D.
