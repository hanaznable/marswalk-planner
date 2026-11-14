"""Clipping checks for the historical context line, not an EVA route."""
import unittest
from export_layer_lab import clip_segment


class TraverseClippingTests(unittest.TestCase):
    def test_crossing_segment_ends_at_real_boundary_intersections(self):
        self.assertEqual(clip_segment([-10, 5], [20, 5], [0, 0, 10, 10]), [[0, 5], [10, 5]])

    def test_parallel_outside_segment_is_removed(self):
        self.assertIsNone(clip_segment([-1, 0], [-1, 10], [0, 0, 10, 10]))

    def test_inside_segment_keeps_its_geometry(self):
        self.assertEqual(clip_segment([2, 3], [8, 7], [0, 0, 10, 10]), [[2, 3], [8, 7]])


if __name__ == "__main__":
    unittest.main()
