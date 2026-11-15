"""Render a fixed orthographic global locator from the JPL Viking map."""
from pathlib import Path
import math
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / "public/data/locator"
SIZE = 256
# Nominal Gale landing region, NASA MSL overview: 4.5 S, 137.4 E.
LAT, LON = map(math.radians, (-4.5, 137.4))


def main():
    source = Image.open(FOLDER / "mars-viking.jpg").convert("RGB")
    width, height = source.size
    output = Image.new("RGBA", (SIZE, SIZE))
    for row in range(SIZE):
        for col in range(SIZE):
            x = (col + .5 - SIZE / 2) / (SIZE / 2 - 2)
            y = -(row + .5 - SIZE / 2) / (SIZE / 2 - 2)
            rho2 = x*x + y*y
            if rho2 >= 1:
                continue
            z = math.sqrt(1 - rho2)
            lat = math.asin(z * math.sin(LAT) + y * math.cos(LAT))
            lon = LON + math.atan2(x, z * math.cos(LAT) - y * math.sin(LAT))
            # Equirectangular map: north at top, -180 E at left, +180 E at right.
            u = int(((lon + math.pi) % (2*math.pi)) / (2*math.pi) * width) % width
            v = min(height-1, max(0, int((math.pi/2-lat)/math.pi * height)))
            light = .52 + .48 * max(0, -.28*x + .32*y + .905*z)
            rgb = tuple(round(c * light) for c in source.getpixel((u, v)))
            output.putpixel((col, row), (*rgb, 255))
    output.save(FOLDER / "gale-globe.png", optimize=True)


if __name__ == "__main__":
    main()
