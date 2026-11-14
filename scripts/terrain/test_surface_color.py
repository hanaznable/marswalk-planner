"""Numerical checks with synthetic inputs, not additional NASA measurements."""
import tempfile
import unittest
from pathlib import Path

import numpy as np

from inspect_surface_color import phase_shift, read_geojp2
from register_surface_color import fit_affine_shifts


class ColorRegistrationTests(unittest.TestCase):
    def test_recovers_known_translation_direction(self):
        reference = np.random.default_rng(43).normal(size=(128, 128))
        moving = np.roll(reference, (4, -7), axis=(0, 1))
        result = phase_shift(reference, moving, limit=16)
        self.assertEqual(result["moving_to_reference_shift_col_px"], 7)
        self.assertEqual(result["moving_to_reference_shift_row_px"], -4)
        self.assertGreater(result["diagnostic_shift_correlation"], 0.999)

    def test_recovers_known_affine_displacement_at_unused_point(self):
        samples = []
        for x, y in ((0, 0), (0, 100), (100, 0), (100, 100)):
            samples.append({"centre_col_row": [x, y],
                            "moving_to_reference_shift_col_px": 5 + .02*x - .01*y,
                            "moving_to_reference_shift_row_px": -8 + .01*x + .03*y})
        fitted = fit_affine_shifts(samples)
        np.testing.assert_allclose(np.array([1, 30, 70]) @ fitted, [4.9, -5.6], atol=1e-10)

    def test_rejects_collinear_training_points(self):
        samples = [{"centre_col_row": [x, x], "moving_to_reference_shift_col_px": 0,
                    "moving_to_reference_shift_row_px": 0} for x in (0, 1, 2)]
        with self.assertRaises(ValueError):
            fit_affine_shifts(samples)

    def test_rejects_truncated_jp2_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "truncated.jp2"
            path.write_bytes(b"\x00\x00\x02\x00uuid")
            with self.assertRaises(ValueError):
                read_geojp2(path)


if __name__ == "__main__":
    unittest.main()
