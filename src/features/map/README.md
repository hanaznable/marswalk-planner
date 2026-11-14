# 2D map boundary

`MapCanvas` owns the Leaflet instance, its cleanup, resize handling, and viewport
navigation. `MapViewport` composes that renderer with view controls; it does not
own scientific data or route calculations. `LayersPanel` is UI-only until real
datasets are integrated.

The current map is empty and uses non-geographic `CRS.Simple`. The fixed grid is
a viewport decoration, not a georeferenced map layer. There are no tile requests,
coordinates, scale bar, or Earth geodesic calculations. When integrating real
Mars data, configure an appropriate CRS and retain required source attribution.
The decorative globe is not a scientific visualization.

Leaflet stays inside this feature. Route algorithms should exchange validated
domain data, never Leaflet objects. The future terrain renderer is independent
and is selected at the UI composition boundary.
