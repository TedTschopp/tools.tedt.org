"""Native land-access footprints, Census place profiles and USACiv regional comparisons."""

import csv
import io
import json
import tempfile
import zipfile
from collections import defaultdict

import numpy as np
import shapefile
import shapely as sh
from pyproj import CRS
from shapely.geometry import shape

from fetch import MILE, OUT, RAW
from geography import attributes_at, grid, parts, pct, project, rings, shape_records, territory, write_json


def profiles(places):
    by_id = {p["id"]: {} for p in places}
    with zipfile.ZipFile(RAW / "places.zip") as archive:
        rows = csv.DictReader(io.StringIO(archive.read(archive.namelist()[0]).decode("utf-8-sig")), delimiter="\t")
        for r in rows:
            if r["GEOID"] in by_id:
                suffix = r["NAME"].split()[-1]
                by_id[r["GEOID"]].update(state=r["USPS"], kind={"city": "City", "town": "Town", "CDP": "Census-designated place"}.get(suffix, "Census place"))
    counties = [(r["GEOID"], project(g)) for r, g in shape_records("counties")]
    points = sh.points([(p["x"] * MILE, -p["y"] * MILE) for p in places])
    indices = attributes_at([g for _, g in counties], points)
    for p, idx in zip(places, indices):
        if idx >= 0:
            by_id[p["id"]]["county"] = counties[idx][0]
    fields = {
        "B01003": {"population": 1}, "B19013": {"income": 1}, "B25077": {"home": 1},
        "B23025": {"labor": 3, "employed": 4, "unemployed": 5},
        "B25003": {"homes": 1, "rented": 3}, "B25040": {"heated": 1, "electric": 4},
    }
    for table, cols in fields.items():
        with (RAW / (table + ".dat")).open(encoding="latin1") as f:
            header = next(f).strip().split("|")
            lookup = {k: header.index(f"{table}_E{n:03}") for k, n in cols.items()}
            for line in f:
                if not line.startswith("1600000US"):
                    continue
                row = line.rstrip().split("|")
                dest = by_id.get(row[0][9:])
                if dest is not None:
                    dest.update({k: int(row[i]) for k, i in lookup.items() if row[i].isdigit()})
    for dest in by_id.values():
        for out, num, den in (("renters", "rented", "homes"), ("electricHeat", "electric", "heated"), ("unemployment", "unemployed", "labor")):
            dest[out] = pct(dest.pop(num, None), dest.pop(den, None))
    with zipfile.ZipFile(RAW / "usaciv-source.zip") as z:
        def get(key):
            return json.loads(z.read("usaciv/web/data/" + key + ".json"))
        states = get("states")
        return {
            "places": by_id, "nation": get("nation"),
            "state": next(s for s in states if s["fips"] == "06"), "stateCount": len(states),
            "districtColors": {d["id"]: d["color"] for d in get("districts")["catalog"]},
        }


ACCESS = {"Restricted Access": "restricted", "No Public Access": "closed"}


def access_polygons(boundary):
    by_type = defaultdict(list)
    for _, g in shape_records("military-land"):
        geo = sh.make_valid(project(g))
        if boundary.intersects(geo):
            by_type["military"].extend(parts(geo, "Polygon"))
    with tempfile.TemporaryDirectory() as tmp, zipfile.ZipFile(RAW / "cpad-2026a.zip") as z:
        name = next(n[:-4] for n in z.namelist() if n.endswith("_Units.shp"))
        assert CRS.from_wkt(z.read(name + ".prj").decode()).to_epsg() == 3310
        for ext in (".shp", ".shx", ".dbf"):
            z.extract(name + ext, tmp)
        with shapefile.Reader(f"{tmp}/{name}", encodingErrors="replace") as reader:
            for record in reader.iterRecords(fields=["ACCESS_TYP"]):
                kind = ACCESS.get(record[0])
                if not kind:
                    continue
                item = reader.shape(record.oid, bbox=boundary.bounds)
                if item is None:
                    continue
                try:
                    geo = sh.make_valid(shape(item.__geo_interface__))
                except shapefile.RingSamplingError:
                    # A few CPAD paths have collapsed holes. Reconstruct polygonal
                    # area from the source ring topology without those zero-area rings.
                    stops = [*item.parts, len(item.points)]
                    lines = [item.points[a:b] for a, b in zip(stops, stops[1:]) if b - a >= 4]
                    geo = sh.make_valid(sh.build_area(sh.MultiLineString(lines)))
                if boundary.intersects(geo):
                    by_type[kind].extend(parts(geo, "Polygon"))
    return {kind: sh.union_all(list(parts(sh.union_all(geos).intersection(boundary), "Polygon")))
            for kind, geos in by_type.items()}


def land_access(boundary, row, col, area, tiles):
    footprints = access_polygons(boundary)
    kinds = ["military", "restricted", "closed"]
    shares = np.zeros((len(tiles), len(kinds)), dtype=np.int32)
    tree = sh.STRtree(tiles)
    for column, kind in enumerate(kinds):
        hits = np.zeros(len(tiles))
        for part in parts(footprints[kind], "Polygon"):
            ids = tree.query(part, predicate="intersects")
            sh.prepare(part)
            full = sh.covers(part, tiles[ids])
            hits[ids[full]] += area[ids[full]]
            edges = ids[~full]
            hits[edges] += sh.area(sh.intersection(tiles[edges], part))
        assert abs(hits.sum() - footprints[kind].area) < max(1, footprints[kind].area * 1e-8)
        assert (hits <= area * 1.000001 + 0.01).all()
        rounded = np.rint(10000 * np.minimum(hits / area, 1))
        shares[:, column] = np.where((hits > 0) & (rounded == 0), -1, rounded)
    # Dissolve overlaps for the display so an area classified twice is only painted once.
    groups = defaultdict(list)
    for part in parts(sh.union_all(list(footprints.values())).simplify(42), "Polygon"):
        x, y = part.representative_point().coords[0]
        groups[(int(x // (20 * MILE)), int(y // (20 * MILE)))].append(part)
    paths = []
    for polygons in groups.values():
        geom = sh.orient_polygons(sh.MultiPolygon(polygons))
        xmin, ymin, xmax, ymax = np.asarray(geom.bounds) / MILE
        paths.append({"bbox": [xmin, -ymax, xmax, -ymin], "rings": rings(geom, 1)})
    return {"classes": kinds, "units": "hundredths of one percent of the clipped hex; -1 denotes a positive area below rounding precision",
            "groups": paths, "byHex": {f"{col[i]},{row[i]}": shares[i].tolist() for i in np.flatnonzero(shares.any(axis=1))}}


GIS_NOTE = """Military and restricted land · Edison Atlas
land-access.json contains the display footprint and a sparse table of original polygon intersections. Each byHex key is the tile field in sce-one-mile.geojson (col,row). The three values, in classes order, are hundredths of a percent of the hex area inside SCE. A value of -1 means positive coverage below 0.005 percent. An absent tile has zero mapped area in each class. Different classes can overlap. groups contain simplified display rings in miles east and south of the California Albers origin (EPSG:3310).
Military boundaries are from U.S. Census Bureau TIGER/Line 2025. Restricted and closed are the published Restricted Access and No Public Access unit classes from the California Protected Areas Database (CPAD 2026a), GreenInfo Network. Data files and SHA-256 digests are in inputs.json.
geography-profiles.json contains whole-place ACS 2020-2024 five-year estimates keyed by Census place GEOID. Its state, nation, and industry comparisons are from the MIT-licensed USACiv snapshot. Metro records are in regional.json, keyed by CBSA.
"""


def write_civ_geography(places, boundary, row, col, area, tiles):
    write_json("geography-profiles.json", profiles(places))
    write_json("land-access.json", land_access(boundary, row, col, area, tiles))


if __name__ == "__main__":
    boundary = territory()
    row, col, _, area, tiles = grid(boundary)
    write_civ_geography(json.loads((OUT / "atlas.json").read_bytes())["places"], boundary, row, col, area, tiles)
