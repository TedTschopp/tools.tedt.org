"""One-mile grid, geographic joins, raster sampling, and cartographic context."""

import csv
import io
import json
import math
import re
import xml.etree.ElementTree as ET
import zipfile

import contourpy
import numpy as np
import rasterio
import shapefile
import shapely as sh
from fetch import ACS_TABLES, BACK, DEM_Z, MILE, OUT, PRISM, RAW, dem_range
from PIL import Image
from pyproj import Transformer
from shapely.geometry import Polygon, shape

FORWARD = Transformer.from_crs(4326, 3310, always_xy=True)
INVERSE = Transformer.from_crs(3310, 4326, always_xy=True)
NEAR = INVERSE.transform_bounds(*BACK, densify_pts=50)
HEX_AREA = math.sqrt(3) / 2 * MILE**2
ROW = math.sqrt(3) / 2
RADIUS = 1 / math.sqrt(3)
CORNERS = np.array(
    [
        (0, -RADIUS),
        (0.5, -RADIUS / 2),
        (0.5, RADIUS / 2),
        (0, RADIUS),
        (-0.5, RADIUS / 2),
        (-0.5, -RADIUS / 2),
    ]
)
NODATA = -2147483648


def write_json(name, data):
    (OUT / name).write_text(
        json.dumps(data, separators=(",", ":"), allow_nan=False) + "\n"
    )


def project(geo):
    return sh.transform(geo, FORWARD.transform, interleaved=False)


def parts(geo, kind):
    if geo.geom_type == kind:
        if not geo.is_empty:
            yield geo
    elif hasattr(geo, "geoms"):
        for item in geo.geoms:
            yield from parts(item, kind)


def path_points(line, precision=3):
    xy = np.asarray(line.coords)[:, :2] * [1 / MILE, -1 / MILE]
    return np.round(xy, precision).tolist()


def rings(geom, tolerance=0):
    if tolerance:
        geom = geom.simplify(tolerance)
    return [
        path_points(ring, 5 if not tolerance else 3)
        for p in parts(geom, "Polygon")
        for ring in [p.exterior, *p.interiors]
    ]


def lines(geom, tolerance=120):
    return [path_points(line) for line in parts(geom.simplify(tolerance), "LineString")]


def shape_records(key, bbox=NEAR):
    with zipfile.ZipFile(RAW / (key + ".zip")) as z:

        def stream(ext):
            return io.BytesIO(
                z.read(next(n for n in z.namelist() if n.endswith("." + ext)))
            )

        reader = shapefile.Reader(
            shp=stream("shp"),
            shx=stream("shx"),
            dbf=stream("dbf"),
            encoding="utf-8",
            encodingErrors="replace",
        )
        for item in reader.iterShapeRecords(bbox=bbox):
            yield item.record.as_dict(), shape(item.shape.__geo_interface__)


def territory():
    data = json.loads((RAW / "territory.json").read_bytes())
    assert data["crs"]["properties"]["name"].endswith("3310") and data["features"]
    assert not data.get("exceededTransferLimit") and not data.get("properties", {}).get(
        "exceededTransferLimit"
    )
    return sh.union_all([sh.make_valid(shape(f["geometry"])) for f in data["features"]])


def grid(boundary):
    xmin, ymin, xmax, ymax = np.asarray(boundary.bounds) / MILE
    row, col = np.mgrid[
        math.floor(-ymax / ROW) - 1 : math.ceil(-ymin / ROW) + 2,
        math.floor(xmin) - 2 : math.ceil(xmax) + 2,
    ]
    row, col = row.ravel(), col.ravel()
    centers = np.stack([col + 0.5 * (row % 2), row * ROW], axis=1)
    polygons = sh.polygons((centers[:, None, :] + CORNERS) * [MILE, -MILE])
    sh.prepare(boundary)
    hit = sh.intersects(boundary, polygons)
    row, col, centers, polygons = row[hit], col[hit], centers[hit], polygons[hit]
    interior = sh.covers(boundary, polygons)
    polygons[~interior] = sh.intersection(polygons[~interior], boundary)
    areas = sh.area(polygons)
    keep = areas > 0
    row, col, centers, polygons, areas = (
        row[keep],
        col[keep],
        centers[keep],
        polygons[keep],
        areas[keep],
    )
    assert abs(areas.sum() - boundary.area) < boundary.area * 1e-9
    xy = centers * [MILE, -MILE]
    outside = ~sh.contains_xy(boundary, xy[:, 0], xy[:, 1])
    xy[outside] = sh.get_coordinates(sh.point_on_surface(polygons[outside]))
    assert sh.covers(boundary, sh.points(xy)).all()
    return row, col, xy, areas, polygons


def attributes_at(geometries, points):
    # Unmatched offshore samples remain -1. Exact shared borders use a stable first match.
    result = np.full(len(points), -1, dtype="int32")
    if len(geometries):
        pos, feature = sh.STRtree(geometries).query(points, predicate="intersects")
        order = np.lexsort((-feature, pos))
        result[pos[order]] = feature[order]
    return result


def tables():
    tracts, place_pop = {}, {}
    for t in ACS_TABLES:
        with (RAW / (t + ".dat")).open(encoding="latin-1", newline="") as f:
            reader = csv.reader(f, delimiter="|")
            columns = {c: i for i, c in enumerate(next(reader)) if "_E" in c}
            for row in reader:
                geo = row[0]
                if geo.startswith("1600000US06") and t == "B01003" and row[1].isdigit():
                    place_pop[geo[9:]] = int(row[1])
                if not geo.startswith("1400000US06"):
                    continue
                dest = tracts.setdefault(geo[9:], {})
                for c, i in columns.items():
                    if row[i].isdigit():
                        dest[c] = int(row[i])
    return tracts, place_pop


def pct(numerator, denominator):
    return (
        round(100 * numerator / denominator, 2)
        if numerator is not None and denominator
        else None
    )


def demographics(boundary, points, acs):
    shapes, data = [], []
    for r, g in shape_records("tracts"):
        p = project(g)
        if not sh.intersects(boundary, p):
            continue
        gid = r["GEOID"]
        a = acs.get(gid, {})
        get = a.get
        multi = [get(f"B25024_E{i:03}") for i in range(4, 10)]
        density = get("B01003_E001")
        density = (
            round(density * MILE**2 / r["ALAND"], 1)
            if density is not None and r["ALAND"]
            else None
        )
        data.append(
            [
                gid,
                density,
                get("B19013_E001"),
                pct(get("B25040_E004"), get("B25040_E001")),
                pct(get("B25003_E003"), get("B25003_E001")),
                pct(sum(multi) if None not in multi else None, get("B25024_E001")),
            ]
        )
        shapes.append(p)
    return attributes_at(shapes, points), data


def enviro(boundary, points):
    shapes, data, ids = [], [], set()
    for file in sorted((RAW / "ces-range").glob("*.json")):
        obj = json.loads(file.read_bytes())
        assert not obj.get("exceededTransferLimit") and not obj.get(
            "properties", {}
        ).get("exceededTransferLimit")
        for feature in obj["features"]:
            r = feature["properties"]
            ids.add(r["OBJECTID"])
            p = shape(feature["geometry"])
            if sh.intersects(boundary, p):
                score = r["CIscoreP"]
                data.append(
                    [
                        str(r["TractTXT"]).zfill(11),
                        round(score, 2)
                        if score is not None and 0 <= score <= 100
                        else None,
                    ]
                )
                shapes.append(p)
    assert ids == set(json.loads((RAW / "ces-ids.json").read_bytes())["objectIds"])
    return attributes_at(shapes, points), data


def fire_at(points):
    with (
        zipfile.ZipFile(RAW / "fire.zip") as outer,
        zipfile.ZipFile(io.BytesIO(outer.read(outer.namelist()[0]))) as z,
    ):
        root = ET.fromstring(z.read("doc.kml"))
    levels = np.zeros(len(points), dtype=int)
    for pm in root.findall(".//{*}Placemark"):
        desc = re.sub("<[^>]+>", " ", pm.findtext("{*}description", ""))
        level = int(re.search(r"Tier\s+([23])", desc)[1])
        polygons = []
        for poly in pm.findall(".//{*}Polygon"):

            def read_ring(node):
                return [tuple(map(float, v.split(",")[:2])) for v in node.text.split()]

            shell = read_ring(poly.find(".//{*}outerBoundaryIs//{*}coordinates"))
            holes = [
                read_ring(n)
                for n in poly.findall(".//{*}innerBoundaryIs//{*}coordinates")
            ]
            polygons.append(project(Polygon(shell, holes)))
        inside = attributes_at(polygons, points) >= 0
        levels[inside] = np.maximum(levels[inside], level)
    assert set(levels) == {0, 2, 3}
    return levels


class Terrain:
    def __init__(self):
        self.x0, self.y0, x1, y1 = dem_range()
        self.image = np.empty(
            ((y1 - self.y0 + 1) * 256, (x1 - self.x0 + 1) * 256), dtype=np.float32
        )
        for x in range(self.x0, x1 + 1):
            for y in range(self.y0, y1 + 1):
                with Image.open(RAW / f"dem/{x}-{y}.png") as im:
                    rgb = np.asarray(im.convert("RGB"), dtype=np.float32)
                tx, ty = (x - self.x0) * 256, (y - self.y0) * 256
                self.image[ty : ty + 256, tx : tx + 256] = (
                    rgb[:, :, 0] * 256 + rgb[:, :, 1] + rgb[:, :, 2] / 256 - 32768
                )

    def sample(self, lon, lat):
        size = 256 * (2**DEM_Z)
        x = ((lon + 180) / 360 * size - self.x0 * 256).astype(int)
        y = (
            (1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * size - self.y0 * 256
        ).astype(int)
        return self.image[y, x]


def raster_sample(key, lon, lat):
    if key in PRISM:
        z = RAW / (key + ".zip")
        with zipfile.ZipFile(z) as archive:
            member = next(n for n in archive.namelist() if n.endswith(".tif"))
        uri = f"zip://{z}!{member}"
    else:
        uri = RAW / "nlcd.tif"
    with rasterio.open(uri) as dataset:
        x, y = Transformer.from_crs(4326, dataset.crs, always_xy=True).transform(
            lon, lat
        )
        t = dataset.transform
        c = np.floor((x - t.c) / t.a).astype(int)
        r = np.floor((y - t.f) / t.e).astype(int)
        valid = (r >= 0) & (c >= 0) & (r < dataset.height) & (c < dataset.width)
        result = np.full(np.shape(lon), np.nan)
        # Only read the regional window of the national PRISM rasters.
        if np.any(valid):
            left, right = c[valid].min(), c[valid].max() + 1
            top, bottom = r[valid].min(), r[valid].max() + 1
            values = (
                dataset.read(1, window=((top, bottom), (left, right)), masked=True)
                .astype(float)
                .filled(np.nan)
            )
            result[valid] = values[r[valid] - top, c[valid] - left]
        return result


def backdrop(dem):
    left, bottom, right, top = BACK
    width = 2600
    height = round(width * (top - bottom) / (right - left))
    y, x = np.mgrid[0:height, 0:width]
    lon, lat = INVERSE.transform(
        left + (x + 0.5) * (right - left) / width,
        top - (y + 0.5) * (top - bottom) / height,
    )
    h = dem.sample(lon, lat)
    dy, dx = np.gradient(h)
    shade = np.clip((dx + dy) * 0.27, -57, 53)
    land = (
        np.array([217.0, 211.0, 184.0])
        + np.clip(h / 55, -12, 24)[:, :, None]
        + shade[:, :, None]
    )
    # USACiv shelf, open-water and abyssal colors, interpolated against the DEM.
    depths = [0, 200, 1200, 4000]
    sea_colors = np.array([[57, 139, 168], [45, 109, 151], [27, 66, 102], [13, 42, 71]])
    sea = np.stack(
        [np.interp(-h, depths, channel) for channel in sea_colors.T], axis=-1
    )
    sea += 0.3 * shade[:, :, None]
    # Land mask also distinguishes below-sea-level desert basins from ocean.
    from rasterio.features import rasterize
    from rasterio.transform import from_bounds

    geom = []
    for _, g in shape_records("land"):
        geom.append(project(sh.clip_by_rect(g, *NEAR)))
    mask = rasterize(
        [(g, 1) for g in geom if not g.is_empty],
        (height, width),
        transform=from_bounds(*BACK, width, height),
        fill=0,
        dtype="uint8",
    )
    ocean = sh.box(*BACK).difference(sh.union_all([g for g in geom if not g.is_empty]))
    rgb = np.where(mask[:, :, None], land, sea)
    Image.fromarray(np.uint8(np.clip(rgb, 0, 255))).save(
        OUT / "relief.webp", quality=87
    )
    # Regional elevation isolines preserve legibility when the locator relief is magnified.
    xs = left + (np.arange(width) + 0.5) * (right - left) / width
    ys = top - (np.arange(height) + 0.5) * (top - bottom) / height
    xi = np.flatnonzero((xs > -180000) & (xs < 680000))
    yi = np.flatnonzero((ys > -650000) & (ys < 150000))
    contours = contourpy.contour_generator(x=xs[xi], y=ys[yi], z=h[np.ix_(yi, xi)])
    paths = []
    for elevation in range(400, 4401, 400):
        for coords in contours.lines(elevation):
            if len(coords) < 6:
                continue
            line = sh.LineString(coords).simplify(220)
            if line.length > 5000:
                paths.append(path_points(line))
    return (
        [left / MILE, -top / MILE, right / MILE, -bottom / MILE],
        paths,
        rings(ocean, 90),
    )


def contexts(boundary, points, populations):
    locs, county_geoms, ids, outlines = [], [], [], []
    for r, g in shape_records("counties"):
        p = project(g)
        if r["STATEFP"] in ("06", "32", "04"):
            outlines.append(rings(p, 170))
        if r["STATEFP"] == "06" and sh.intersects(boundary, p):
            idx = r["GEOID"]
            ids.append(idx)
            county_geoms.append(p)
    order = np.argsort(ids)
    ids = [ids[i] for i in order]
    county_geoms = [county_geoms[i] for i in order]
    idx = attributes_at(county_geoms, points)
    z = zipfile.ZipFile(RAW / "places.zip")
    rows = csv.DictReader(
        io.StringIO(z.read(z.namelist()[0]).decode("utf-8-sig")), delimiter="\t"
    )
    for raw in rows:
        r = {k.strip(): v.strip() for k, v in raw.items()}
        if r["USPS"] not in ("CA", "NV", "AZ"):
            continue
        lon, lat = float(r["INTPTLONG"]), float(r["INTPTLAT"])
        if not (-122 <= lon <= -113 and 32.2 <= lat <= 39.1):
            continue
        x, y = FORWARD.transform(lon, lat)
        inside = bool(sh.covers(boundary, sh.Point(x, y)))
        pop = populations.get(r["GEOID"])
        name = re.sub(r" (city|town|CDP)$", "", r["NAME"])
        if (
            not inside
            and (pop or 0) < 24000
            and name not in ("Las Vegas", "Yuma", "Kingman")
        ):
            continue
        locs.append(
            {
                "name": name,
                "id": r["GEOID"],
                "x": round(x / MILE, 4),
                "y": round(-y / MILE, 4),
                "pop": pop,
                "inside": inside,
            }
        )
    overlap = []
    for g in county_geoms:
        clipped = sh.intersection(boundary, sh.make_valid(g))
        anchor = max(
            parts(clipped, "Polygon"), key=lambda p: p.area
        ).representative_point()
        x0, y0, x1, y1 = clipped.bounds
        overlap.append(
            {
                "overlapSqMi": round(clipped.area / MILE**2, 4),
                "anchor": [anchor.x / MILE, -anchor.y / MILE],
                "mapBounds": [x0 / MILE, -y1 / MILE, x1 / MILE, -y0 / MILE],
            }
        )
    return ids, idx, outlines, locs, overlap


def linework():
    # Primary highways are visible at the regional scale. Secondary roads and rail appear on zoom.
    layers = {"roads": [], "rail": [], "rivers": [], "lakes": []}
    for key, paths in layers.items():
        for r, g in shape_records(key):
            clipped = sh.clip_by_rect(g, *NEAR)
            if clipped.is_empty:
                continue
            p = project(clipped)
            if key == "roads":
                name = r.get("FULLNAME") or ""
                if r["MTFCC"] == "S1100":
                    rank = 1
                elif re.search(r"^(State (?:Rte|Hwy)|US Hwy|U S Hwy|CA-)", name):
                    rank = 2
                else:
                    continue
            elif key == "lakes":
                paths.extend(rings(p, 130))
                continue
            else:
                rank = int(r.get("scalerank", r.get("SCALERANK", 6)) or 6)
            for line in lines(p, 155 if key == "roads" else 200):
                if len(line) >= 2:
                    paths.append([rank, line])
    return layers
