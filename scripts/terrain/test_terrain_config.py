"""Small synthetic unit cases for grid boundaries; not scientific demo data."""

import copy
import json
import tempfile
import unittest
from pathlib import Path

from terrain_config import covering_grid, validate_config, workspace_path

ROOT = Path(__file__).resolve().parents[2]


class TerrainConfigTests(unittest.TestCase):
    def setUp(self):
        self.config = json.loads((ROOT / "scripts/terrain/regions/pahrump-hills.json").read_text())

    def test_different_region_and_extent_need_no_algorithm_change(self):
        config = copy.deepcopy(self.config)
        config["id"] = "another-mars-region"
        config["aoi"]["bounds_xy_m"] = [10, 20, 2010, 3020]
        self.assertEqual(validate_config(config)["id"], "another-mars-region")

    def test_reject_nonfinite_and_reversed_extent(self):
        for bounds in ([0, 0, float("nan"), 1], [1, 0, 0, 1], [0, 0, True, 1]):
            with self.subTest(bounds=bounds):
                config = copy.deepcopy(self.config)
                config["aoi"]["bounds_xy_m"] = bounds
                with self.assertRaises(ValueError):
                    validate_config(config)

    def test_origin_convention_cannot_be_implicit(self):
        self.config["georeferencing"]["working_origin_convention"] = "guess"
        with self.assertRaises(ValueError):
            validate_config(self.config)

    def test_acceptance_requires_evidence(self):
        self.config["georeferencing"]["review_status"] = "accepted_for_prototype"
        self.config["georeferencing"]["review_evidence"] = []
        with self.assertRaises(ValueError):
            validate_config(self.config)

    def test_exact_grid_edges_do_not_add_pixels(self):
        grid = covering_grid([2, 4, 6, 8], [0, 10], 2, 5, 5)
        self.assertEqual(grid["source_window"], {"col_offset": 1, "row_offset": 1, "cols": 2, "rows": 2})
        self.assertEqual(grid["origin_upper_left_corner_xy_m"], [2, 8])

    def test_fractional_bounds_cover_whole_requested_area(self):
        grid = covering_grid([1, 3, 7, 9], [0, 10], 2, 5, 5)
        self.assertEqual(grid["bounds_xy_m"], [0, 2, 8, 10])

    def test_out_of_coverage_is_not_clamped(self):
        with self.assertRaises(ValueError):
            covering_grid([-1, 0, 4, 4], [0, 10], 2, 5, 5)

    def test_real_candidate_has_expected_native_window(self):
        grid = covering_grid(self.config["aoi"]["bounds_xy_m"],
                             [-3268.481521560707, -271632.01075430337],
                             1.0117571650087, 6220, 12171)
        self.assertEqual((grid["cols"], grid["rows"]), (989, 989))

    def test_workspace_path_rejects_escape(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertEqual(workspace_path(root, "inputs/dem.img"), root / "inputs/dem.img")
            with self.assertRaises(ValueError):
                workspace_path(root, "../outside.img")


if __name__ == "__main__":
    unittest.main()
