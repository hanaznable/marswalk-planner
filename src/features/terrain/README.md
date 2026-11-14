# 3D visualization boundary

This feature currently contains only a UI placeholder. Future Three.js / React
Three Fiber rendering should live here and consume processed, attributed
elevation data through the datasets boundary. It must not import or depend on
Leaflet, and should load on demand rather than increasing the 2D startup bundle.
