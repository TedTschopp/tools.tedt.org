"""Join small-area publisher data to the actual sample point of each clipped hex."""

import csv
import gzip
import json
from collections import Counter, defaultdict

import numpy as np
import rasterio
import rasterio.features
import shapely as sh
from fetch import MILE, RAW
from geography import (
    FORWARD,
    INVERSE,
    attributes_at,
    parts,
    pct,
    project,
    shape_records,
)
from pyproj import Transformer
from regional import workbook
from utility import EV_FIELDS, generators, regular_cell

# Each list is the exact sequence of source estimates used by the metric.
ACS = {
    "home_value": ("B25077_E001",),
    "homeMoe": ("B25077_M001",),
    "median_age": ("B01002_E001",),
    "income": ("B19013_E001",),
    "density": ("B01003_E001",),
    "poverty": ("C17002_E002", "C17002_E003", "C17002_E001"),
    "foreign_born": ("B05012_E003", "B05012_E001"),
    "bachelors": tuple(f"B15003_E{n:03}" for n in (22, 23, 24, 25, 1)),
    "broadband": ("B28002_E004", "B28002_E001"),
    "commute": ("B08013_E001", "B08303_E001"),
    "homeownership": ("B25003_E002", "B25003_E001"),
    "uninsured": tuple(f"B27010_E{n:03}" for n in (17, 33, 50, 66, 1)),
    "veterans_pct": ("B21001_E002", "B21001_E001"),
    "population": ("B01003_E001",),
    "veterans": ("B21001_E002",),
    "armedForces": ("B23025_E006",),
    "armedForcesPct": ("B23025_E006", "B23025_E001"),
    "electricHeat": ("B25040_E004", "B25040_E001"),
    "renters": ("B25003_E003", "B25003_E001"),
    "multifamily": tuple(f"B25024_E{n:03}" for n in (4, 5, 6, 7, 8, 9, 1)),
}
HEALTH = {
    "mentalDistress": "mhlth",
    "depression": "depression",
    "poorHealth": "ghlth",
    "inactivity": "lpa",
}
ZIP_FIELDS = (
    "gwh",
    "resGwh",
    "commercialGwh",
    "industrialGwh",
    "agriculturalGwh",
    "agShare",
    "plugShare",
    "chargeRate",
    "vehicles",
    "plugIns",
    "zipPorts",
    "publishedClassMonths",
)
POWER = {
    "solarMW": "solar",
    "windMW": "wind",
    "storageMW": "battery",
    "geoMW": "geo",
    "hydroMW": "hydro",
}


def scalar(s):
    try:
        n = float(s)
    except (ValueError, TypeError):
        return None
    return (int(n) if n.is_integer() else n) if n >= 0 and np.isfinite(n) else None


def census_rows():
    needed = defaultdict(set)
    for terms in ACS.values():
        for term in terms:
            needed[term.split("_")[0]].add(term)
    values, available = defaultdict(dict), defaultdict(set)
    prefixes = {b"1500000US06": "bg", b"1400000US06": "tract"}
    for table, columns in needed.items():
        with (RAW / (table + ".dat")).open("rb") as f:
            labels = f.readline().decode().strip().split("|")
            selected = [(labels.index(k), k) for k in sorted(columns)]
            for line in f:
                level = prefixes.get(line[:11])
                if level is None:
                    continue
                row = line.rstrip(b"\r\n").split(b"|")
                gid = row[0][9:].decode()
                available[table].add(level)
                dest = values[gid]
                for j, k in selected:
                    dest[k] = scalar(row[j])
    return values, available


def geometry_rows(boundary, key, id_field):
    records = []
    for r, g in shape_records(key):
        geom = project(g)
        if boundary.intersects(geom):
            records.append((str(r[id_field]), r, geom))
    return sorted(records, key=lambda v: v[0])


def encode_boundary(geometry):
    # Compact source cartography in thousandths of a projected mile. A feature
    # includes its bounds followed by delta-coded rings, including interior holes.
    rings = []
    for part in parts(geometry, "Polygon"):
        for ring in [part.exterior, *part.interiors]:
            xy = np.rint(
                np.asarray(ring.coords)[:-1, :2] * [1000 / MILE, -1000 / MILE]
            ).astype("int32")
            if len(xy) < 3:
                continue
            delta = np.diff(xy, axis=0)
            rings.append(
                np.concatenate([xy[:1], delta[(delta != 0).any(axis=1)]])
                .ravel()
                .tolist()
            )
    left, bottom, right, top = geometry.bounds
    return [
        int(np.floor(left * 1000 / MILE)),
        int(np.floor(-top * 1000 / MILE)),
        int(np.ceil(right * 1000 / MILE)),
        int(np.ceil(-bottom * 1000 / MILE)),
        rings,
    ]


SOURCE_LAYERS = {
    "bg": ("block-groups", "GEOID", "sce-acs-block-groups"),
    "tract": ("tracts", "GEOID", "sce-acs-tracts"),
    "zcta": ("zctas", "ZCTA5CE20", "sce-zip-areas"),
    "health": ("tracts-2023", "GEOID", "sce-health-tracts"),
    "work": ("block-groups-2020", "GEOID", "sce-employment-block-groups"),
}


def write_source_layers(archive, boundary, local):
    for layer, (shapefile, id_field, name) in SOURCE_LAYERS.items():
        tab = local["tables"][layer]
        data = {row[0]: row for row in tab["rows"]}
        with archive.open(name + ".geojson", "w") as dest:
            dest.write(b'{"type":"FeatureCollection","features":[')
            first = True
            for gid, _, g in geometry_rows(boundary, shapefile, id_field):
                polygon = g if boundary.covers(g) else g.intersection(boundary)
                if polygon.area <= 0:
                    continue
                if polygon.geom_type == "GeometryCollection":
                    polygon = sh.union_all(list(parts(polygon, "Polygon")))
                props = dict(zip(tab["columns"], data[gid]))
                if not first:
                    dest.write(b",")
                first = False
                head = json.dumps(
                    {"type": "Feature", "id": gid, "properties": props},
                    separators=(",", ":"),
                )[:-1]
                wgs = sh.transform(polygon, INVERSE.transform, interleaved=False)
                dest.write((head + ',"geometry":' + sh.to_geojson(wgs) + "}").encode())
            dest.write(b"]}")


def acs_value(metric, row, land):
    terms = [row.get(c) for c in ACS[metric]]
    if None in terms:
        return None
    if metric == "density":
        return round(terms[0] * MILE**2 / land, 2) if land else None
    if len(terms) == 1:
        return terms[0]
    if metric == "commute":
        return round(terms[0] / terms[1], 2) if terms[1] else None
    return pct(sum(terms[:-1]), terms[-1])


def quarter_class(rows, kind):
    values = [rows.get((m, kind)) for m in (7, 8, 9)]
    return sum(values) if None not in values else None


def zip_values():
    vehicles = defaultdict(Counter)
    for year, group, _, z, n in workbook("vehicles.xlsx", "ZIP"):
        if year != 2025 or not str(z).isdigit() or len(str(z)) != 5:
            continue
        vehicles[str(z)]["vehicles"] += n
        if group in ("Battery Electric (BEV)", "Plug-in Hybrid (PHEV)"):
            vehicles[str(z)]["plugIns"] += n
    ports = Counter()
    for row in json.loads((RAW / "afdc-electric-ca.json").read_bytes())[
        "fuel_stations"
    ]:
        z = str(row.get("zip", ""))[:5]
        if len(z) == 5 and z.isdigit():
            ports[z] += sum(row.get(f) or 0 for f in EV_FIELDS.values())
    usage = defaultdict(dict)
    rows = iter(workbook("sce-zip-q3-2026.xlsx"))
    next(rows)
    next(rows)
    if str(next(rows)[6]).strip() != "TotalkWh":
        raise ValueError("SCE usage schema changed")
    for z, month, year, kind, combined, _, kwh, _ in rows:
        if year != 2026 or month not in (7, 8, 9) or combined not in ("Y", "N"):
            raise ValueError("Unexpected quarterly usage record")
        if combined == "N" and isinstance(kwh, (float, int)):
            if (month, kind) in usage[str(z)]:
                raise ValueError("Duplicate published class-month")
            usage[str(z)][month, kind] = kwh
    results = {}
    for z in set(vehicles) | set(usage) | set(ports):
        v = vehicles.get(z)
        rows = usage.get(z, {})
        # Only use separately reported sales. Publish quarterly metrics only with
        # all three months observed for the corresponding series.
        total = sum(rows.values()) if len({m for m, _ in rows}) == 3 else None

        res, ag = (
            quarter_class(rows, "Residential"),
            quarter_class(rows, "Agricultural"),
        )
        results[z] = {
            **{
                k: round(val / 1e6, 6) if val is not None else None
                for k, kind in [
                    ("commercialGwh", "Commercial"),
                    ("industrialGwh", "Industrial"),
                    ("agriculturalGwh", "Agricultural"),
                ]
                for val in [quarter_class(rows, kind)]
            },
            "gwh": round(total / 1e6, 6) if total is not None else None,
            "resGwh": round(res / 1e6, 6) if res is not None else None,
            "agShare": pct(ag, total),
            "publishedClassMonths": len(rows),
            "vehicles": v["vehicles"] if v else None,
            "plugIns": v["plugIns"] if v else None,
            "plugShare": pct(v["plugIns"], v["vehicles"]) if v else None,
            "zipPorts": ports[z],
            "chargeRate": round(1000 * ports[z] / v["plugIns"], 2)
            if v and v["plugIns"]
            else None,
        }
    return results


def land_percent(polygons):
    with rasterio.open(RAW / "nlcd.tif") as raster:
        warp = Transformer.from_crs(3310, raster.crs, always_xy=True)
        projected = sh.transform(polygons, warp.transform, interleaved=False)
        raster_ids = rasterio.features.rasterize(
            ((p, i + 1) for i, p in enumerate(projected)),
            out_shape=raster.shape,
            transform=raster.transform,
            fill=0,
            dtype="int32",
            all_touched=False,
        )
        cover = raster.read(1)
    valid = (raster_ids > 0) & np.isin(
        cover, [11, 12, 21, 22, 23, 24, 31, 41, 42, 43, 52, 71, 81, 82, 90, 95]
    )
    ids = raster_ids[valid]
    classes = cover[valid]
    count = lambda selected: np.bincount(selected, minlength=len(polygons) + 1)[1:]
    total = count(ids)
    result = {"landSamples": total}
    for field, codes in (
        ("forest", (41, 42, 43)),
        ("farmland", (81, 82)),
        ("pasture", (81,)),
        ("cropland", (82,)),
        ("developed", (21, 22, 23, 24)),
    ):
        # Integer scale in the tile binary is hundredths of one percent.
        result[field] = np.divide(
            10000.0 * count(ids[np.isin(classes, codes)]),
            total,
            out=np.full(len(total), np.nan),
            where=total > 0,
        )
    return result


def build_local(boundary, xy, polygons, cols, rows, tracts, utility):
    points = sh.points(xy)
    joins, tables, fields, outlines = {}, {}, {}, {}

    def table(key, columns, data):
        tables[key] = {"columns": ["id", *columns], "rows": data}
        for j, k in enumerate(columns, 1):
            fields[k] = {"layer": key, "index": j}

    def spatial(key, geos):
        joins[key] = attributes_at([g for _, _, g in geos], points)
        outlines[key] = [encode_boundary(g) for _, _, g in geos]

    source, available = census_rows()
    levels = {
        k: (
            "bg"
            if all("bg" in available[col.split("_")[0]] for col in terms)
            else "tract"
        )
        for k, terms in ACS.items()
    }
    bg = geometry_rows(boundary, "block-groups", "GEOID")
    spatial("bg", bg)
    for level in ("bg", "tract"):
        metrics = [k for k in ACS if levels[k] == level]
        records = (
            [(gid, r["ALAND"]) for gid, r, _ in bg]
            if level == "bg"
            else [(r[0], None) for r in tracts]
        )
        table(
            level,
            metrics,
            [
                [gid, *[acs_value(k, source.get(gid, {}), land) for k in metrics]]
                for gid, land in records
            ],
        )
    workplaces = geometry_rows(boundary, "block-groups-2020", "GEOID")
    spatial("work", workplaces)
    sector_fields = ["C000", *[f"CNS{i:02}" for i in range(1, 21)]]
    job_counts = {
        gid: np.zeros(len(sector_fields), dtype=np.int64) for gid, _, _ in workplaces
    }
    with gzip.open(RAW / "ca-wac-2024.csv.gz", "rt") as f:
        for observation in csv.DictReader(f):
            block_group = observation["w_geocode"][:12]
            if block_group in job_counts:
                job_counts[block_group] += [int(observation[k]) for k in sector_fields]
    if not all(int(v[0]) == int(v[1:].sum()) for v in job_counts.values()):
        raise ValueError("Census workplace sector totals do not reconcile")
    table(
        "work",
        sector_fields,
        [[gid, *job_counts[gid].tolist()] for gid, _, _ in workplaces],
    )
    tract_geom = {gid: g for gid, _, g in geometry_rows(boundary, "tracts", "GEOID")}
    outlines["tract"] = [encode_boundary(tract_geom[t[0]]) for t in tracts]
    geo = geometry_rows(boundary, "zctas", "ZCTA5CE20")
    spatial("zcta", geo)
    zips = zip_values()
    table(
        "zcta",
        ZIP_FIELDS,
        [[gid, *[zips.get(gid, {}).get(f) for f in ZIP_FIELDS]] for gid, _, _ in geo],
    )
    health = json.loads((RAW / "cdc-places-tract-ca.json").read_bytes())
    if (
        len(health) < 8000
        or len({r["tractfips"] for r in health}) != len(health)
        or len(health) >= 50000
    ):
        raise ValueError("Incomplete or duplicate California PLACES tract inventory")
    health = {r["tractfips"]: r for r in health}
    geo = geometry_rows(boundary, "tracts-2023", "GEOID")
    spatial("health", geo)
    table(
        "health",
        HEALTH,
        [
            [
                gid,
                *[
                    scalar(health.get(gid, {}).get(s + "_crudeprev"))
                    for s in HEALTH.values()
                ],
            ]
            for gid, _, _ in geo
        ],
    )
    power = defaultdict(Counter)
    for a in utility["levels"]["12"]:
        for k, v in a["values"].items():
            if "mw" in v:
                power[a["col"], a["row"]][k] = v["mw"]
    for kind, (lon, lat), v in generators(extra_power=True):
        if kind not in ("geo", "hydro"):
            continue
        east, north = FORWARD.transform(lon, lat)
        if sh.intersects_xy(boundary, east, north):
            power[regular_cell(east / MILE, -north / MILE, 12)][kind] += v["mw"]
    ids = [regular_cell(e / MILE, -n / MILE, 12) for e, n in xy]
    order = sorted(set(ids) | set(power))
    index = {cell: i for i, cell in enumerate(order)}
    joins["energyArea"] = np.asarray([index[cell] for cell in ids])
    table(
        "energyArea",
        POWER,
        [
            [f"{c},{r}", *[round(power[c, r][s], 3) for s in POWER.values()]]
            for c, r in order
        ],
    )
    ev = {(a["col"], a["row"]): a["values"]["ev"] for a in utility["levels"]["1"]}
    for k, f in (("chargers", "ports"), ("dcFast", "dc")):
        joins[k] = np.asarray([ev.get(cell, {}).get(f, 0) for cell in zip(cols, rows)])
        fields[k] = {"layer": "hex", "column": k, "divisor": 1}
    joins.update(land_percent(polygons))
    for k in ("forest", "farmland", "pasture", "cropland", "developed"):
        fields[k] = {"layer": "hex", "column": k, "divisor": 100}
    print(
        "Local publisher geographies",
        {k: len(v["rows"]) for k, v in tables.items()},
        "ACS",
        levels,
        flush=True,
    )
    return {"tables": tables, "fields": fields}, joins, outlines
