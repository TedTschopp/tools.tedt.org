"""Summarize operating generation, battery storage and public EV charging inside SCE."""

import json
import math
from collections import Counter, defaultdict

import shapely as sh
from fetch import MILE, OUT, RAW
from geography import CORNERS, FORWARD, INVERSE, ROW, parts, territory, write_json
from regional import workbook

WIDTHS = (48, 12)
EV_FIELDS = {
    "level1": "ev_level1_evse_num",
    "level2": "ev_level2_evse_num",
    "dc": "ev_dc_fast_num",
}


def regular_cell(x, y, width):
    """The nearest pointy-top hex center in the atlas's odd-row lattice."""
    x, y = x / width, y / width
    row = math.floor(y / ROW + 0.5)
    candidates = []
    for r in range(row - 1, row + 2):
        offset = (r % 2) / 2
        c = math.floor(x - offset + 0.5)
        candidates.append(((x - c - offset) ** 2 + (y - r * ROW) ** 2, r, c))
    _, r, c = min(candidates)
    return c, r


def reporting_polygon(c, r, width):
    center = ((c + (r % 2) / 2) * width, r * ROW * width)
    return sh.Polygon((CORNERS * width + center) * [MILE, -MILE])


def anchor(boundary, c, r, width):
    """Place the symbol from its reporting geometry, independent of the source points."""
    x, y = (c + (r % 2) / 2) * width, r * ROW * width
    if sh.intersects_xy(boundary, x * MILE, -y * MILE):
        return x, y
    area = reporting_polygon(c, r, width).intersection(boundary)
    point = area.representative_point()
    if area.area <= 0 or point.is_empty:
        raise ValueError("Occupied reporting hex has no service-area overlap")
    return point.x / MILE, -point.y / MILE


def category(technology):
    if technology.startswith("Solar "):
        return "solar"
    if "Wind Turbine" in technology:
        return "wind"
    return "battery" if technology == "Batteries" else None


def generators(extra_power=False):
    rows = iter(workbook("generators.xlsx", "Operating"))
    if "October 2026" not in str(next(rows)[0]):
        raise ValueError("Unexpected EIA-860M reporting month")
    next(rows)
    fields = [str(v).strip() for v in next(rows)]
    sites, seen = {}, set()
    for values in rows:
        row = dict(zip(fields, values))
        if row["Plant State"] != "CA" or not str(row["Status"]).startswith("(OP)"):
            continue
        technology = str(row["Technology"])
        kind = category(technology)
        if extra_power:
            kind = {"Geothermal": "geo", "Conventional Hydroelectric": "hydro"}.get(
                technology, kind
            )
        if not kind:
            continue
        unit = (row["Plant ID"], row["Generator ID"])
        if unit in seen:
            raise ValueError("Duplicate operating generator")
        seen.add(unit)
        coords = float(row["Longitude"]), float(row["Latitude"])
        site = sites.setdefault(
            (unit[0], kind), {"coordinates": Counter(), "stats": Counter(sites=1)}
        )
        site["coordinates"][coords] += 1
        stats = site["stats"]
        stats["units"] += 1
        stats["mw"] += float(row["Nameplate Capacity (MW)"])
        energy = row["Nameplate Energy Capacity (MWh)"]
        if kind == "battery":
            stats["energyUnits"] += int(isinstance(energy, (int, float)))
            stats["mwh"] += energy if isinstance(energy, (int, float)) else 0
    for (_, kind), site in sites.items():
        # All units of a plant/technology are counted together. Use its modal reported point.
        coords = min(site["coordinates"], key=lambda xy: (-site["coordinates"][xy], xy))
        yield kind, coords, site["stats"]


def charging():
    source = json.loads((RAW / "afdc-electric-ca.json").read_bytes())
    rows = source["fuel_stations"]
    if len(rows) != source["total_results"] or len({v["id"] for v in rows}) != len(
        rows
    ):
        raise ValueError("Incomplete or duplicate AFDC station listing")
    for row in rows:
        if (
            row["fuel_type_code"],
            row["access_code"],
            row["status_code"],
            row["state"],
        ) != (
            "ELEC",
            "public",
            "E",
            "CA",
        ):
            raise ValueError("Unexpected station outside AFDC request filters")
        ports = {k: int(row.get(field) or 0) for k, field in EV_FIELDS.items()}
        yield (
            "ev",
            (row["longitude"], row["latitude"]),
            {
                "sites": 1,
                **ports,
                "ports": sum(ports.values()),
                "otherSites": int(bool(row.get("ev_other_evse"))),
                "restrictedSites": int(row.get("restricted_access") is True),
            },
        )


def rounded(metrics):
    return {k: (round(v, 3) if isinstance(v, float) else v) for k, v in metrics.items()}


def utility_geojson(boundary, width, areas):
    """One GIS layer per reporting scale, with numeric columns usable in GIS software."""
    features = []
    for area in areas:
        col, row = area["col"], area["row"]
        polygon = reporting_polygon(col, row, width)
        if not boundary.covers(polygon):
            polygon = polygon.intersection(boundary)
            if polygon.geom_type == "GeometryCollection":
                polygon = sh.union_all(list(parts(polygon, "Polygon")))
        props = {"width_mi": width, "col": col, "row": row, "near": area["near"]}
        for kind, values in area["values"].items():
            props.update(
                {f"{kind}_{metric}": value for metric, value in values.items()}
            )
        transformed = sh.transform(polygon, INVERSE.transform, interleaved=False)
        features.append(
            {
                "type": "Feature",
                "id": f"{width}:{col},{row}",
                "properties": props,
                "geometry": json.loads(sh.to_geojson(transformed)),
            }
        )
    return json.dumps(
        {"type": "FeatureCollection", "features": features}, separators=(",", ":")
    )


def build_utility(boundary, places):
    sh.prepare(boundary)
    groups = {w: defaultdict(lambda: defaultdict(Counter)) for w in (*WIDTHS, 1)}
    totals = defaultdict(Counter)
    for records in (generators(), charging()):
        for kind, (lon, lat), stats in records:
            east, north = FORWARD.transform(lon, lat)
            if not sh.intersects_xy(boundary, east, north):
                continue
            totals[kind].update(stats)
            for w in (*WIDTHS, 1) if kind == "ev" else WIDTHS:
                key = regular_cell(east / MILE, -north / MILE, w)
                groups[w][key][kind].update(stats)
    levels = {}
    for w, cells in groups.items():
        items = []
        for (c, r), kinds in sorted(cells.items(), key=lambda item: item[0][::-1]):
            x, y = anchor(boundary, c, r, w)
            label = min(places, key=lambda p: (p["x"] - x) ** 2 + (p["y"] - y) ** 2)[
                "name"
            ]
            items.append(
                {
                    "col": c,
                    "row": r,
                    "x": round(x, 6),
                    "y": round(y, 6),
                    "near": label,
                    "values": {k: rounded(v) for k, v in kinds.items()},
                }
            )
        levels[str(w)] = items
    return {
        "generationPeriod": "October 2026",
        "chargingDate": "2026-11-27",
        "totals": {k: rounded(v) for k, v in totals.items()},
        "levels": levels,
    }


if __name__ == "__main__":
    meta = json.loads((OUT / "atlas.json").read_bytes())
    result = build_utility(territory(), meta["places"])
    write_json("utility.json", result)
    print("Territory totals", json.dumps(result["totals"]))
    print("Occupied reporting hexes", {w: len(v) for w, v in result["levels"].items()})
