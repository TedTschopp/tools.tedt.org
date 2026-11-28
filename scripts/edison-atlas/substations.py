"""Count the public substation inventory inside clipped 12-mile reporting areas."""

import json
import math
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import shapely as sh
from fetch import MILE, RAW
from geography import ROW, parts, territory
from utility import anchor, reporting_polygon

LAYER = "https://drpep.sce.com/arcgis_server/rest/services/Hosted/ICA_Layer/FeatureServer/18"
SNAPSHOT = "drpep/substation-area-counts.json"


def area_ids(geometry):
    # SCE does the spatial join. Only record IDs are returned and used for deduplication.
    rings = []
    for piece in parts(geometry, "Polygon"):
        polygon = sh.orient_polygons(piece, exterior_cw=True)
        for ring in [polygon.exterior, *polygon.interiors]:
            rings.append([[round(x, 4), round(y, 4)] for x, y in ring.coords])
    if not rings:
        return set()
    body = urlencode(
        {
            "where": "1=1",
            "returnIdsOnly": "true",
            "returnGeometry": "false",
            "geometryType": "esriGeometryPolygon",
            "geometry": json.dumps({"rings": rings}, separators=(",", ":")),
            "inSR": 3310,
            "spatialRel": "esriSpatialRelIntersects",
            "f": "json",
        }
    ).encode()
    request = Request(
        LAYER + "/query",
        data=body,
        headers={"User-Agent": "Edison Atlas public planning data"},
    )
    for attempt in range(4):
        try:
            with urlopen(request, timeout=70) as response:
                obj = json.load(response)
            if "objectIds" not in obj or obj.get("exceededTransferLimit"):
                raise ValueError(str(obj)[:220])
            return set(obj["objectIds"] or [])
        except (OSError, ValueError):
            if attempt == 3:
                raise
            time.sleep(2**attempt)


def capture():
    dest = RAW / SNAPSHOT
    if dest.exists():
        return {SNAPSHOT: LAYER + "/query"}
    boundary = territory()
    xmin, ymin, xmax, ymax = [v / (12 * MILE) for v in boundary.bounds]
    areas = []
    for r in range(math.floor(-ymax / ROW) - 1, math.ceil(-ymin / ROW) + 2):
        for c in range(math.floor(xmin) - 1, math.ceil(xmax) + 2):
            polygon = reporting_polygon(c, r, 12)
            if polygon.intersects(boundary):
                clipped = polygon.intersection(boundary)
                if clipped.area:
                    areas.append((c, r, clipped))
    seen, rows = set(), []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for (c, r, _), ids in zip(
            areas, pool.map(lambda item: area_ids(item[2]), areas)
        ):
            # Shared-edge points get one stable assignment, in row/column order.
            count = len(ids - seen)
            seen.update(ids)
            if count:
                x, y = anchor(boundary, c, r, 12)
                rows.append(
                    {
                        "col": c,
                        "row": r,
                        "x": round(x, 6),
                        "y": round(y, 6),
                        "count": count,
                    }
                )
    # Independent checks on the original territory components at the same precision.
    control = set()
    for component in parts(boundary, "Polygon"):
        control.update(area_ids(component))
    if control != seen:
        raise ValueError(
            f"Substation area join disagrees with territory query: {len(seen)} vs {len(control)}"
        )
    dest.parent.mkdir(parents=True, exist_ok=True)
    temp = dest.with_suffix(".part")
    temp.write_text(
        json.dumps(
            {"width": 12, "included": len(seen), "areas": rows}, separators=(",", ":")
        )
    )
    temp.replace(dest)
    return {SNAPSHOT: LAYER + "/query"}


def add_substations(portals, local):
    data = json.loads((RAW / SNAPSHOT).read_bytes())
    source_count = json.loads((RAW / "drpep/counts/ICA_Layer-18.json").read_bytes())[
        "count"
    ]
    areas = {f"{p['col']},{p['row']}": p["count"] for p in data["areas"]}
    if not 0 < sum(areas.values()) == data["included"] <= source_count:
        raise ValueError("Invalid substation reporting-area counts")
    table = local["tables"]["energyArea"]
    local["fields"]["substations"] = {
        "layer": "energyArea",
        "index": len(table["columns"]),
    }
    table["columns"].append("substations")
    for row in table["rows"]:
        row.append(areas.get(row[0], 0))
    portals["substations"] = dict(data, sourceCount=source_count)
