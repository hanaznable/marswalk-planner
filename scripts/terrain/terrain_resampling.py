"""Metric raster operations, independent of region, file format and frontend."""

import math

import numpy as np


def horn_slope_with_halo(elevation, cell_size):
    """Slope degrees for interior cells; require all nine real samples.

    Input includes a one-cell halo. Output is two rows/columns smaller.
    Row direction only changes the gradient sign, not slope magnitude.
    """
    z = np.asarray(elevation, dtype=np.float64)
    if z.ndim != 2 or min(z.shape) < 3 or not math.isfinite(cell_size) or cell_size <= 0:
        raise ValueError("Need a 2D raster with halo and positive finite cell size")
    neighbours = [z[r:r + z.shape[0] - 2, c:c + z.shape[1] - 2]
                  for r in range(3) for c in range(3)]
    a, b, c, d, _, f, g, h, i = neighbours
    valid = np.logical_and.reduce([np.isfinite(part) for part in neighbours])
    dx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * cell_size)
    dy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * cell_size)
    slope = np.degrees(np.arctan(np.hypot(dx, dy)))
    return np.where(valid, slope, np.nan)


def axis_overlaps(start, step, count, source_start, source_step, source_count):
    """Positive-direction pixel-edge intervals and exact positive overlaps."""
    if not all(math.isfinite(v) for v in (start, step, source_start, source_step)) or step <= 0 or source_step <= 0:
        raise ValueError("Invalid axis geometry")
    if count <= 0 or source_count <= 0:
        raise ValueError("Invalid axis size")
    result = []
    for index in range(count):
        left, right = start + index * step, start + (index + 1) * step
        first = math.floor((left - source_start) / source_step)
        last = math.ceil((right - source_start) / source_step)
        indices, weights = [], []
        for source_index in range(first, last):
            overlap = min(right, source_start + (source_index + 1) * source_step) - max(left, source_start + source_index * source_step)
            if overlap > 1e-9:
                if not 0 <= source_index < source_count:
                    raise ValueError("Target cell extends outside supplied source window")
                indices.append(source_index)
                weights.append(overlap)
        if not indices or not math.isclose(sum(weights), step, rel_tol=0, abs_tol=1e-7):
            raise ValueError("Target cell is not fully covered")
        result.append((np.array(indices), np.array(weights)))
    return result


def aggregate_terrain(elevation, slope, x_overlaps, y_overlaps):
    """Area-weighted elevation, maximum native slope; never fill unknowns."""
    elevation = np.asarray(elevation, dtype=np.float64)
    slope = np.asarray(slope, dtype=np.float64)
    if elevation.ndim != 2 or elevation.shape != slope.shape:
        raise ValueError("Elevation and native slope grids must match")
    height, width = len(y_overlaps), len(x_overlaps)
    output_z = np.full((height, width), np.nan, dtype=np.float64)
    output_s = np.full_like(output_z, np.nan)
    for row, (ri, rw) in enumerate(y_overlaps):
        for col, (ci, cw) in enumerate(x_overlaps):
            z = elevation[np.ix_(ri, ci)]
            s = slope[np.ix_(ri, ci)]
            if np.isfinite(z).all():
                weights = rw[:, None] * cw[None, :]
                output_z[row, col] = np.sum(z * weights) / weights.sum()
            if np.isfinite(s).all() and np.isfinite(z).all():
                output_s[row, col] = s.max()
    return output_z, output_s
