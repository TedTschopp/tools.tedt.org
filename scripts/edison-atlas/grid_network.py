"""Render SCE's published circuit layers onto the atlas's one-mile Albers grid."""

import base64
import hashlib
import io
import json
import math
import time
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import numpy as np
import shapely as sh
from affine import Affine
from fetch import MILE, RAW
from geography import territory
from PIL import Image
from rasterio.features import rasterize

BASE = "https://drpep.sce.com/arcgis_server/rest/services/Hosted/"
LAYERS = {
    "transmission": BASE + "ICA_Layer/FeatureServer/19",
    "distribution": BASE + "Distribution_circuits/FeatureServer/0",
}
PRINT = "https://utility.arcgisonline.com/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task/execute"
SR = {"wkid": 3310}
SUBPIXELS = 3
ROUTE_COLOR = [155, 32, 191, 255]
CONTROL_COLOR = [12, 185, 65, 255]
COLORS = {
    "transmission": (128, 55, 88),
    "distribution": (18, 100, 100),
    "shared": (45, 54, 112),
}


def request(url, fields=None, binary=False):
    data = urlencode(fields).encode() if fields is not None else None
    for attempt in range(4):
        try:
            with urlopen(
                Request(
                    url, data=data, headers={"User-Agent": "Edison Atlas cartography"}
                ),
                timeout=90,
            ) as response:
                raw = response.read()
            if binary:
                return raw
            obj = json.loads(raw)
            if "error" in obj:
                raise ValueError(str(obj["error"])[:300])
            return obj
        except (OSError, ValueError):
            if attempt == 3:
                raise
            time.sleep(2**attempt)


def filename(kind):
    return f"drpep/grid-{kind}-route-image.json"


def map_bounds(land):
    west, south, east, north = land.bounds
    return [
        math.floor(west / MILE) - 4,
        math.floor(-north / MILE) - 4,
        math.ceil(east / MILE) + 4,
        math.ceil(-south / MILE) + 4,
    ]


def controls(bounds):
    x0, y0, x1, y1 = bounds
    return [
        (x0 + 1.5, y0 + 1.5),
        (x1 - 1.5, y0 + 1.5),
        (x0 + 1.5, y1 - 1.5),
        (x1 - 1.5, y1 - 1.5),
    ]


def print_mask(layer, where, bounds):
    x0, y0, x1, y1 = bounds
    width, height = x1 - x0, y1 - y0
    extent = {
        "xmin": x0 * MILE,
        "ymin": -y1 * MILE,
        "xmax": x1 * MILE,
        "ymax": -y0 * MILE,
        "spatialReference": SR,
    }
    # Independent registration marks occupy the padded margin outside the service boundary.
    reference = {
        "id": "registration",
        "featureCollection": {
            "layers": [
                {
                    "layerDefinition": {
                        "name": "Registration",
                        "geometryType": "esriGeometryPoint",
                        "objectIdField": "OBJECTID",
                        "fields": [
                            {
                                "name": "OBJECTID",
                                "type": "esriFieldTypeOID",
                                "alias": "ID",
                            }
                        ],
                        "drawingInfo": {
                            "renderer": {
                                "type": "simple",
                                "symbol": {
                                    "type": "esriSMS",
                                    "style": "esriSMSSquare",
                                    "size": 3,
                                    "color": CONTROL_COLOR,
                                    "outline": {
                                        "type": "esriSLS",
                                        "color": CONTROL_COLOR,
                                        "width": 0,
                                    },
                                },
                            }
                        },
                    },
                    "featureSet": {
                        "geometryType": "esriGeometryPoint",
                        "spatialReference": SR,
                        "features": [
                            {
                                "attributes": {"OBJECTID": i + 1},
                                "geometry": {
                                    "x": x * MILE,
                                    "y": -y * MILE,
                                    "spatialReference": SR,
                                },
                            }
                            for i, (x, y) in enumerate(controls(bounds))
                        ],
                    },
                }
            ]
        },
    }
    layer_definition = {
        "definitionExpression": where,
        "minScale": 0,
        "maxScale": 0,
        "drawingInfo": {
            "renderer": {
                "type": "simple",
                "symbol": {
                    "type": "esriSLS",
                    "style": "esriSLSSolid",
                    "color": ROUTE_COLOR,
                    "width": 1.15,
                },
            }
        },
    }
    webmap = {
        "mapOptions": {
            "extent": extent,
            "spatialReference": SR,
            "showAttribution": False,
        },
        "operationalLayers": [
            reference,
            {
                "id": "routes",
                "url": layer,
                "layerType": "ArcGISFeatureLayer",
                "opacity": 1,
                "visibility": True,
                "minScale": 0,
                "maxScale": 0,
                "layerDefinition": layer_definition,
            },
        ],
        "exportOptions": {
            "outputSize": [width * SUBPIXELS, height * SUBPIXELS],
            "dpi": 96,
        },
    }
    result = request(
        PRINT,
        {
            "f": "json",
            "Format": "PNG32",
            "Layout_Template": "MAP_ONLY",
            "Web_Map_as_JSON": json.dumps(webmap),
        },
    )
    if any(
        m.get("type") in {"esriJobMessageTypeError", "esriJobMessageTypeWarning"}
        for m in result.get("messages", [])
    ):
        raise ValueError(str(result["messages"])[:480])
    image = np.array(
        Image.open(
            io.BytesIO(request(result["results"][0]["value"]["url"], binary=True))
        ).convert("RGB")
    )
    if image.shape[:2] != (height * SUBPIXELS, width * SUBPIXELS):
        raise ValueError("Print dimensions do not match the requested Albers grid")
    reference_pixels = np.all(image == CONTROL_COLOR[:3], axis=2)
    errors = []
    for x, y in controls(bounds):
        px, py = (x - x0) * SUBPIXELS, (y - y0) * SUBPIXELS
        sx, sy = max(0, round(px) - 5), max(0, round(py) - 5)
        iy, ix = np.where(reference_pixels[sy : round(py) + 6, sx : round(px) + 6])
        if len(ix) < 4:
            raise ValueError("Missing cartographic registration mark")
        errors.append(
            math.hypot(ix.mean() + sx + 0.5 - px, iy.mean() + sy + 0.5 - py) / SUBPIXELS
        )
    if max(errors) > 0.5:
        raise ValueError(f"Registration differs by {max(errors):.3f} map miles")
    return np.all(image == ROUTE_COLOR[:3], axis=2), max(errors)


def spatial_controls(layer, mask, bounds, land):
    x0, y0, _, _ = bounds
    positive, negative = [], []
    for py in range(2, mask.shape[0] - 10, 8):
        for px in range(2, mask.shape[1] - 10, 8):
            region = sh.box(
                (x0 + px) * MILE,
                -(y0 + py + 8) * MILE,
                (x0 + px + 8) * MILE,
                -(y0 + py) * MILE,
            )
            if not land.covers(region):
                continue
            if mask[py + 2 : py + 6, px + 2 : px + 6].max() > 80:
                positive.append(region.bounds)
            elif not mask[py - 2 : py + 10, px - 2 : px + 10].any():
                negative.append(region.bounds)

    def samples(rows):
        if len(rows) < 12:
            raise ValueError("Insufficient geographic controls")
        return [rows[i] for i in np.linspace(0, len(rows) - 1, 12, dtype=int)]

    cases = [(r, True) for r in samples(positive)] + [
        (r, False) for r in samples(negative)
    ]

    def check(case):
        box, expected = case
        ans = request(
            layer + "/query",
            {
                "f": "json",
                "where": "1=1",
                "geometry": ",".join(map(str, box)),
                "inSR": 3310,
                "geometryType": "esriGeometryEnvelope",
                "spatialRel": "esriSpatialRelIntersects",
                "returnCountOnly": "true",
            },
        )
        if (ans["count"] > 0) != expected:
            raise ValueError(
                "A rendered area disagrees with SCE's independent spatial query"
            )

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(check, cases))
    return len(cases)


def png(array):
    buffer = io.BytesIO()
    Image.fromarray(array).save(buffer, format="PNG", optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def render_batch(layer, fid, bounds, batch):
    where = f"{fid} BETWEEN {batch[0]} AND {batch[-1]}"
    count = request(
        layer + "/query", {"f": "json", "where": where, "returnCountOnly": "true"}
    )["count"]
    if count != len(batch):
        raise ValueError("SCE inventory changed during render")
    return print_mask(layer, where, bounds)


def capture():
    sources = {filename(k): u + "/query" for k, u in LAYERS.items()}
    todo = {k: u for k, u in LAYERS.items() if not (RAW / filename(k)).exists()}
    if not todo:
        return sources
    land = territory()
    bounds = map_bounds(land)
    x0, y0, x1, y1 = bounds
    width, height = x1 - x0, y1 - y0
    footprint = rasterize(
        [(land, 1)],
        out_shape=(height, width),
        transform=Affine(MILE, 0, x0 * MILE, 0, -MILE, -y0 * MILE),
        all_touched=True,
        dtype="uint8",
    )
    for kind, layer in todo.items():
        info = request(
            layer + "/query", {"f": "json", "where": "1=1", "returnIdsOnly": "true"}
        )
        ids = sorted(info["objectIds"])
        fid = info["objectIdFieldName"]
        total = request(
            layer + "/query", {"f": "json", "where": "1=1", "returnCountOnly": "true"}
        )["count"]
        if not len(set(ids)) == len(ids) == total or not fid.isidentifier():
            raise ValueError("Incomplete inventory for " + kind)
        empty, zero_error = print_mask(layer, "1=0", bounds)
        if empty.any():
            raise ValueError("The printing service ignored the source layer filter")
        batches = [ids[n : n + 750] for n in range(0, len(ids), 750)]
        combined = np.zeros((height * SUBPIXELS, width * SUBPIXELS), dtype=bool)
        errors = [zero_error]
        counts = []
        digests = set()

        with ThreadPoolExecutor(max_workers=2) as pool:
            for mask, error in pool.map(
                partial(render_batch, layer, fid, bounds), batches
            ):
                digest = hashlib.sha256(mask.tobytes()).hexdigest()
                if digest in digests:
                    raise ValueError("The printing service repeated an inventory batch")
                digests.add(digest)
                counts.append(int(mask.sum()))
                combined |= mask
                errors.append(error)
        # The three samples per axis provide antialiasing for the single published mile pixel.
        shade = (
            np.rint(
                combined.reshape(height, SUBPIXELS, width, SUBPIXELS).mean(axis=(1, 3))
                * 255
            ).astype(np.uint8)
            * footprint
        )
        if not shade.any() or not all(counts):
            raise ValueError("An expected circuit print had no mapped linework")
        checks = spatial_controls(layer, shade, bounds, land)
        obj = {
            "emptyFilterVerified": True,
            "records": total,
            "batches": len(batches),
            "pixels": int(np.count_nonzero(shade)),
            "checks": checks,
            "maxRegistrationMiles": round(max(errors), 4),
            "bounds": bounds,
            "pixelMiles": 1,
            "alpha": png(shade),
        }
        dest = RAW / filename(kind)
        dest.parent.mkdir(parents=True, exist_ok=True)
        temp = dest.with_suffix(".part")
        temp.write_text(json.dumps(obj, separators=(",", ":")))
        temp.replace(dest)
        print(
            kind,
            {k: v for k, v in obj.items() if k not in {"alpha", "bounds"}},
            flush=True,
        )
    return sources


def route_images():
    records = {k: json.loads((RAW / filename(k)).read_bytes()) for k in LAYERS}
    data = {
        k: np.array(Image.open(io.BytesIO(base64.b64decode(r.pop("alpha")))))
        for k, r in records.items()
    }
    bounds = records["transmission"]["bounds"]
    if any(v["bounds"] != bounds or v["pixelMiles"] != 1 for v in records.values()):
        raise ValueError("Incompatible route image registration")

    def color_image(shade, colors):
        rgba = np.empty((*shade.shape, 4), dtype=np.uint8)
        rgba[:, :, :3] = colors
        rgba[:, :, 3] = np.rint(255 * np.sqrt(shade / 255)).astype(np.uint8)
        return png(rgba)

    t, d = data["transmission"], data["distribution"]
    palette = np.empty((*t.shape, 3), dtype=np.uint8)
    palette[:] = COLORS["distribution"]
    palette[t > 0] = COLORS["transmission"]
    palette[(t > 0) & (d > 0)] = COLORS["shared"]
    images = {k: color_image(a, COLORS[k]) for k, a in data.items()}
    images["both"] = color_image(np.maximum(t, d), palette)
    return {
        "projection": 3310,
        "pixelMiles": 1,
        "bounds": bounds,
        "layers": records,
        "images": images,
    }


if __name__ == "__main__":
    capture()
