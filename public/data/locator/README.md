# Fixed Mars locator

Global context only; not a terrain or navigation layer.

Source: [NASA/JPL Solar System Simulator Mars texture map](https://space.jpl.nasa.gov/tmaps/mars.html).
[Original JPEG](https://space.jpl.nasa.gov/tmaps/pix/mar0kuu2.jpg): Viking imagery,
processed by USGS; credit Caltech/JPL/USGS, 1440 x 720 pixels.

`gale-globe.png` is an orthographic projection centered on the nominal Gale landing
region, 4.5 degrees south, 137.4 degrees east, north up. Location reference:
[NASA MSL landing overview](https://science.nasa.gov/resource/daybreak-at-gale-crater/).
The source map runs -180 to +180 degrees east, north to south. Soft display shading
is illustrative, not modeled illumination. The centered UI marker indicates the
region at planetary scale, not an exact crater footprint or the 1 km terrain bounds.

Regenerate: `python scripts/terrain/export_mars_locator.py` (Pillow).
The output is static: no animation, globe controls, WebGL or runtime map projection.


## Gale and Pahrump context inset

Clicking the globe toggles a panel of static, unmodified NASA images. Neither image
can pan, zoom or rotate. The globe remains fixed. Close with the globe button,
Close control or Escape.

- `gale-context.jpg`: [PIA16058, Curiosity Cradled by Gale Crater](https://science.nasa.gov/photojournal/curiosity-cradled-by-gale-crater/).
  Source asset: https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia16/pia16058/PIA16058.jpg?fit=clip&w=960
  Credit NASA/JPL-Caltech/ESA/DLR/FU Berlin/MSSS. Southeast-facing oblique view;
  its green dot is the landing site, not Pahrump Hills.
- `pahrump-context.jpg`: [PIA18474, Slopes of Mount Sharp](https://www.jpl.nasa.gov/images/pia18474-slopes-of-mount-sharp/).
  Source asset: https://d2pn8kiwq2w21t.cloudfront.net/original_images/jpegPIA18474.jpg
  Credit NASA/JPL-Caltech/Univ. of Arizona. NASA's original labels identify
  Pahrump Hills within the Murray Formation; colors show topographic context,
  not natural surface color. This is a regional detail, not the entire crater.

The perspective overview has a project-authored broad highlight near the northwestern
base of Mount Sharp. Its placement is an approximate visual locator, not a
georeferenced point or the terrain-package boundary. The caption explicitly labels
it approximate. The underlying NASA image is unchanged; an SVG provides the highlight.
Use the separately labelled NASA regional map for local context.
