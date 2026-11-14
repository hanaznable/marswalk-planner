"""Create diagnostic hillshades inside QGIS; never modify original rasters.

The two outputs use identical elevation pixels and shading settings, but retain
different origin interpretations. They are review artifacts, not an approved
terrain package or a reproduction of the orbital image's actual illumination.
"""

import json
import sys
import tempfile
from pathlib import Path

from osgeo import gdal
from qgis.core import QgsProject, QgsRasterLayer


def preview_hillshade(config_relative="scripts/terrain/regions/pahrump-hills.json"):
    project = QgsProject.instance()
    starts = [Path.cwd()]
    starts.extend(Path(layer.source().split("|")[0]).parent
                  for layer in project.mapLayers().values()
                  if layer.source().lower().split("|")[0].endswith((".img", ".jp2")))
    root = None
    for start in starts:
        for parent in [start, *start.parents]:
            if (parent / config_relative).is_file():
                root = parent
                break
        if root is not None:
            break
    if root is None:
        raise RuntimeError("Load a source raster from the project folder first")

    module_dir = str(root / "scripts/terrain")
    sys.path.insert(0, module_dir)
    try:
        from terrain_config import load_config, workspace_path
        from plan_terrain_package import build_plan
    finally:
        sys.path.remove(module_dir)

    config = load_config(workspace_path(root, config_relative))
    plan = build_plan(config)
    if plan["source_dem_scale"] != 1 or plan["source_dem_offset"] != 0:
        raise ValueError("Hillshade helper currently requires unscaled metre elevations")
    source_path = workspace_path(root, config["sources"]["dem"]["path"])
    source = gdal.OpenEx(str(source_path), gdal.OF_RASTER | gdal.OF_READONLY, allowed_drivers=["PDS"])
    if source is None:
        raise RuntimeError("GDAL could not open source DEM")
    transform = source.GetGeoTransform()
    size = plan["planned_grid"]["cell_size_m"]
    if transform[1:] != (size, 0.0, transform[3], 0.0, -size):
        raise ValueError("Unexpected GDAL grid spacing or rotation")
    win = plan["planned_grid"]["source_window"]
    col, row, cols, rows = win["col_offset"], win["row_offset"], win["cols"], win["rows"]
    pad = 2
    if col < pad or row < pad or col + cols + pad > source.RasterXSize or row + rows + pad > source.RasterYSize:
        raise ValueError("This review helper needs a two-pixel source border around the AOI")

    # Read a small in-memory window with a halo for the 3x3 derivative stencil.
    # Elevation pixels are not resampled or edited.
    subset = gdal.Translate("", source, format="MEM", srcWin=[col-pad, row-pad, cols+2*pad, rows+2*pad])
    if subset is None:
        raise RuntimeError("Could not read DEM review window")
    subset.SetProjection(plan["crs"]["wkt"])
    shaded = gdal.DEMProcessing(
        "", subset, "hillshade", format="MEM", alg="Horn",
        azimuth=315.0, altitude=45.0, zFactor=1.0, scale=1.0,
        computeEdges=False,
    )
    if shaded is None:
        raise RuntimeError("GDAL hillshade failed")

    output_parent = source_path.parent / "validation-preview"
    output_parent.mkdir(exist_ok=True)
    output_dir = Path(tempfile.mkdtemp(prefix="hillshade-", dir=output_parent))
    native_origin = [transform[0] + col * size, transform[3] - row * size]
    candidate_origin = plan["planned_grid"]["origin_upper_left_corner_xy_m"]
    alternatives = [
        ("reader-origin", "A - Hillshade: PDS reader origin", native_origin),
        ("working-origin", "B - Hillshade: candidate working origin", candidate_origin),
    ]
    outputs = []
    for key, title, origin in alternatives:
        path = output_dir / (key + ".tif")
        output = gdal.Translate(str(path), shaded, format="GTiff",
                                srcWin=[pad, pad, cols, rows],
                                creationOptions=["COMPRESS=DEFLATE", "TILED=YES"])
        if output is None:
            raise RuntimeError("Could not write diagnostic hillshade")
        expected_transform = (origin[0], size, 0.0, origin[1], 0.0, -size)
        output.SetGeoTransform(expected_transform)
        output.SetProjection(plan["crs"]["wkt"])
        output.SetMetadataItem("PURPOSE", "Diagnostic only; georeferencing review pending")
        output.FlushCache()
        if output.GetGeoTransform() != expected_transform:
            raise RuntimeError("Output transform differs from requested review origin")
        output = None
        outputs.append({"path": str(path), "label": title, "origin_xy_m": origin})

    shaded = subset = source = None
    record = {
        "purpose": "visual diagnostic, not alignment acceptance",
        "region_id": config["id"], "gdal_version": gdal.VersionInfo("--version"),
        "config_path": config_relative, "sources": config["sources"],
        "grid": plan["planned_grid"], "outputs": outputs,
        "hillshade_settings": {"algorithm": "Horn", "azimuth_deg": 315, "altitude_deg": 45,
                               "vertical_exaggeration": 1, "scale": 1, "compute_edges": False},
        "notes": ["Identical source pixels and shading in both outputs; only origin interpretation differs.",
                  "Lighting is a visualization setting, not the historical Sun position.",
                  "Compare terrain boundaries, not identical brightness or every small image feature.",
                  "Visual agreement cannot certify absolute accuracy or resolve an imperceptible offset."],
    }
    (output_dir / "review-settings.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    group = project.layerTreeRoot().insertGroup(0, "Terrain alignment REVIEW - " + config["id"])
    for index, output in enumerate(outputs):
        layer = QgsRasterLayer(output["path"], output["label"], "gdal")
        if not layer.isValid():
            raise RuntimeError("QGIS could not load diagnostic hillshade")
        layer.setAbstract("Diagnostic only; original elevation pixels unchanged. See " + str(output_dir / "review-settings.json"))
        layer.renderer().setOpacity(0.5)
        project.addMapLayer(layer, False)
        node = group.addLayer(layer)
        node.setItemVisibilityChecked(index == 1)
    group.setIsMutuallyExclusive(True, 1)
    print("=== Hillshade review ready ===")
    print("Outputs:", output_dir)
    print("A: PDS reader origin; B: candidate working origin. Both at 50% opacity.")
    print("Keep the ortho visible beneath them. Switch A/B or hide the review group.")
    print("Compare rock/cliff boundaries at close zoom. This is not an automatic alignment verdict.")


preview_hillshade()
