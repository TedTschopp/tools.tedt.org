"""Regional grid schematic from SCE's two published circuit line layers."""

import json
import math
import time
from concurrent.futures import ThreadPoolExecutor
from itertools import repeat
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import shapely as sh
from fetch import MILE, RAW
from geography import ROW, parts, territory
from utility import anchor, reporting_polygon

WIDTH = 24
BASE = "https://drpep.sce.com/arcgis_server/rest/services/Hosted/"
LAYERS = {
    "transmission": BASE + "ICA_Layer/FeatureServer/19",
    "distribution": BASE + "Distribution_circuits/FeatureServer/0",
}


def borders():
    land = territory()
    xmin, ymin, xmax, ymax = [v / (MILE * WIDTH) for v in land.bounds]
    cells = {}
    for r in range(math.floor(-ymax / ROW) - 1, math.ceil(-ymin / ROW) + 2):
        for c in range(math.floor(xmin) - 1, math.ceil(xmax) + 2):
            cell = sh.set_precision(reporting_polygon(c, r, WIDTH), 0.01)
            if land.intersects(cell):
                cells[c, r] = cell
    for (c, r), cell in sorted(cells.items()):
        for other in [(c + 1, r), (c + r % 2 - 1, r + 1), (c + r % 2, r + 1)]:
            if other not in cells:
                continue
            shared = cell.boundary.intersection(cells[other].boundary)
            # Query only the portion of the shared border inside the service territory.
            paths = [
                list(line.coords)
                for line in parts(land.intersection(shared), "LineString")
                if line.length > 1
            ]
            if paths:
                yield (c, r, *other), paths


def has_line(layer, paths):
    query = urlencode(
        {
            "f": "json",
            "where": "1=1",
            "returnCountOnly": "true",
            "geometryType": "esriGeometryPolyline",
            "geometry": json.dumps({"paths": paths}, separators=(",", ":")),
            "inSR": 3310,
            "spatialRel": "esriSpatialRelIntersects",
        }
    ).encode()
    request = Request(
        layer + "/query",
        data=query,
        headers={"User-Agent": "Edison Atlas regional cartography"},
    )
    for attempt in range(4):
        try:
            with urlopen(request, timeout=60) as response:
                result = json.load(response)
            if type(result.get("count")) is not int or result["count"] < 0:
                raise ValueError(
                    f"Invalid regional crossing response: {str(result)[:180]}"
                )
            return result["count"] > 0
        except (OSError, ValueError):
            if attempt == 3:
                raise
            time.sleep(2**attempt)


def filename(kind):
    return f"drpep/grid-{kind}-crossings.json"


def capture():
    sources = {filename(k): url + "/query" for k, url in LAYERS.items()}
    remaining = {k: u for k, u in LAYERS.items() if not (RAW / filename(k)).exists()}
    if not remaining:
        return sources
    edges = list(borders())
    with ThreadPoolExecutor(max_workers=5) as pool:
        for kind, url in remaining.items():
            answers = pool.map(has_line, repeat(url), (paths for _, paths in edges))
            links = [indices for (indices, _), found in zip(edges, answers) if found]
            if not 0 < len(links) < len(edges):
                raise ValueError(f"Unexpected {kind} crossing coverage")
            dest = RAW / filename(kind)
            dest.parent.mkdir(exist_ok=True, parents=True)
            temp = dest.with_suffix(".part")
            temp.write_text(
                json.dumps(
                    {"width": WIDTH, "tested": len(edges), "links": links},
                    separators=(",", ":"),
                )
            )
            temp.replace(dest)
            print(f"{kind}: {len(links)} of {len(edges)} regional borders", flush=True)
    return sources


def schematic(land):
    layers = {k: json.loads((RAW / filename(k)).read_bytes()) for k in LAYERS}
    if len({(v["tested"], v["width"]) for v in layers.values()}) != 1:
        raise ValueError("Grid layers have different reporting geographies")
    areas = sorted(
        {
            tuple(edge[i : i + 2])
            for v in layers.values()
            for edge in v["links"]
            for i in (0, 2)
        }
    )
    index = {area: i for i, area in enumerate(areas)}
    nodes = [[round(v, 3) for v in anchor(land, *area, WIDTH)] for area in areas]
    return {
        "width": WIDTH,
        "tested": layers["transmission"]["tested"],
        "nodes": nodes,
        "layers": {
            k: [[index[tuple(e[:2])], index[tuple(e[2:])]] for e in v["links"]]
            for k, v in layers.items()
        },
    }


if __name__ == "__main__":
    capture()
