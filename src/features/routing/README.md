# Route planning boundary

`components/RoutePlanner.tsx` is an empty-state UI. No route, distance, duration,
traversability, or safety calculation exists yet. Future algorithms should be
pure TypeScript modules here, independent of React, Leaflet, and the 3D renderer.
Accept validated, processed dataset inputs rather than fetching data or reading
map state inside an algorithm. Do not use Earth geodesy for Mars.
