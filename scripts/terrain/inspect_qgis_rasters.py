"""Run inside QGIS to compare raster readers without modifying source files."""

from osgeo import gdal
from qgis.core import QgsProject


def inspect_loaded_rasters():
    print("=== Raster reader comparison ===")
    print(gdal.VersionInfo("--version"))
    count = 0

    for layer in QgsProject.instance().mapLayers().values():
        path = layer.source().split("|")[0]
        if not path.lower().endswith((".img", ".jp2")):
            continue

        count += 1
        print("\nLAYER:", layer.name())
        print("FILE:", path)
        drivers = ["JP2ECW", "JP2OpenJPEG"] if path.lower().endswith(".jp2") else ["PDS"]

        for driver in drivers:
            if gdal.GetDriverByName(driver) is None:
                print(driver, "driver unavailable")
                continue

            dataset = None
            try:
                dataset = gdal.OpenEx(
                    path,
                    gdal.OF_RASTER | gdal.OF_READONLY,
                    allowed_drivers=[driver],
                )
                if dataset is None:
                    print(driver, "could not open file:", gdal.GetLastErrorMsg())
                    continue

                print("Driver:", dataset.GetDriver().ShortName)
                print("Size:", dataset.RasterXSize, dataset.RasterYSize)
                print("GeoTransform:", dataset.GetGeoTransform())
                print("NoData:", dataset.GetRasterBand(1).GetNoDataValue())
                if driver == "JP2OpenJPEG":
                    for source in ("GEOJP2", "GMLJP2", "PAM", "WORLDFILE"):
                        source_dataset = None
                        try:
                            source_dataset = gdal.OpenEx(
                                path,
                                gdal.OF_RASTER | gdal.OF_READONLY,
                                allowed_drivers=[driver],
                                open_options=["GEOREF_SOURCES=" + source],
                            )
                            transform = (
                                source_dataset.GetGeoTransform(can_return_null=True)
                                if source_dataset is not None else None
                            )
                            print("Georeferencing source:", source, "GeoTransform:", transform)
                        except RuntimeError as error:
                            print("Georeferencing source:", source, "ERROR:", str(error))
                        finally:
                            source_dataset = None
            except RuntimeError as error:
                print(driver, "ERROR:", str(error))
            finally:
                dataset = None

    print("\nInspected raster layers:", count)
    print("=== Comparison complete ===")


inspect_loaded_rasters()
