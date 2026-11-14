"""Analytic/synthetic unit fixtures only; never presented as NASA observations."""

import unittest
import numpy as np

from terrain_resampling import aggregate_terrain, axis_overlaps, horn_slope_with_halo


class TerrainResamplingTests(unittest.TestCase):
    def test_flat_surface_has_zero_slope(self):
        np.testing.assert_array_equal(horn_slope_with_halo(np.full((5, 5), -4000.), 1), np.zeros((3, 3)))

    def test_analytic_plane_slope(self):
        rows, cols = np.mgrid[:6, :7]
        surface = -4000 + 0.2 * cols * 2 + 0.3 * rows * 2
        expected = np.degrees(np.arctan(np.hypot(.2, .3)))
        np.testing.assert_allclose(horn_slope_with_halo(surface, 2), expected, atol=1e-10)

    def test_missing_stencil_propagates_without_filling(self):
        surface = np.ones((5, 5))
        surface[2, 2] = np.nan
        self.assertTrue(np.isnan(horn_slope_with_halo(surface, 1)).all())

    def test_area_weighted_mean_with_fractional_edges(self):
        x = axis_overlaps(.5, 1, 1, 0, 1, 2)
        y = axis_overlaps(0, 1, 1, 0, 1, 1)
        elevation, slope = aggregate_terrain([[10, 20]], [[2, 40]], x, y)
        self.assertEqual(elevation[0, 0], 15)
        self.assertEqual(slope[0, 0], 40)

    def test_partial_missing_overlap_blocks_cell(self):
        x = axis_overlaps(.5, 1, 1, 0, 1, 2)
        y = axis_overlaps(0, 1, 1, 0, 1, 1)
        elevation, slope = aggregate_terrain([[10, np.nan]], [[2, 40]], x, y)
        self.assertTrue(np.isnan(elevation[0, 0]))
        self.assertTrue(np.isnan(slope[0, 0]))

    def test_invalid_slope_does_not_invent_elevation_gaps(self):
        x = axis_overlaps(0, 2, 1, 0, 1, 2)
        y = axis_overlaps(0, 1, 1, 0, 1, 1)
        elevation, slope = aggregate_terrain([[10, 20]], [[2, np.nan]], x, y)
        self.assertEqual(elevation[0, 0], 15)
        self.assertTrue(np.isnan(slope[0, 0]))

    def test_outside_source_is_rejected(self):
        with self.assertRaises(ValueError):
            axis_overlaps(-.5, 1, 1, 0, 1, 2)


if __name__ == "__main__":
    unittest.main()
