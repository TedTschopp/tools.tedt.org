"""Intersect SCE's published planning polygons with the clipped one-mile atlas grid."""

import json
from collections import defaultdict

import numpy as np
import shapely as sh
from fetch import MILE, RAW
from geography import FORWARD
from sce_feeds import raw
from shapely.geometry import shape


def features(key):
    folder = RAW / "drpep" / "hex" / key
    expected = set(json.loads((folder / "ids.json").read_bytes())["objectIds"])
    seen = set()
    polygons, ranks = [], []
    for file in sorted(folder.glob("features-*.json")):
        data = json.loads(file.read_bytes())
        if data.get("exceededTransferLimit") or data.get("properties", {}).get(
            "exceededTransferLimit"
        ):
            raise ValueError(f"Truncated {key} polygon response")
        if data["features"] and not data["crs"]["properties"]["name"].endswith("3310"):
            raise ValueError(f"Unexpected projection for {key}")
        for row in data["features"]:
            obj = row["properties"]
            oid = obj["objectid"]
            if oid in seen:
                raise ValueError(f"Duplicate source polygon in {key}")
            seen.add(oid)
            if row["geometry"]:
                geom = shape(row["geometry"])
                if not geom.is_valid:
                    geom = sh.make_valid(geom)
                if geom.area:
                    polygons.append(geom)
                    ranks.append(obj.get("rank"))
    if seen != expected:
        raise ValueError(f"Incomplete {key} feature set")
    return np.asarray(polygons, dtype=object), np.asarray(ranks)


def register(local, key, divisor=1):
    local["fields"][key] = {"layer": "hex", "column": key, "divisor": divisor}


class HexCoverage:
    def __init__(self, cells, xy):
        self.cells = cells
        self.area = sh.area(cells)
        # Each envelope encloses its entire group of clipped cells. Work locally so a
        # long, detailed statewide polygon is clipped once per neighborhood of hexes.
        neighborhoods = defaultdict(list)
        for i, pair in enumerate(np.floor(xy / (16 * MILE)).astype(int)):
            neighborhoods[tuple(pair)].append(i)
        self.groups = [
            (np.asarray(ix), sh.total_bounds(cells[ix]))
            for ix in neighborhoods.values()
        ]

    def overlap(self, features, count=False):
        result = np.zeros(len(self.cells))
        tree = sh.STRtree(features)
        for idx, bounds in self.groups:
            hits = tree.query(sh.box(*bounds))
            if not len(hits):
                continue
            clipped = sh.clip_by_rect(features[hits], *bounds)
            clipped = clipped[sh.area(clipped) > 0]
            if not len(clipped):
                continue
            invalid = ~sh.is_valid(clipped)
            if invalid.any():
                clipped[invalid] = sh.make_valid(clipped[invalid])
            cells = self.cells[idx]
            if count:
                a, b = sh.STRtree(clipped).query(cells, predicate="intersects")
                # Shared edges and corner contacts do not put a study area in a hex.
                positive = sh.relate_pattern(cells[a], clipped[b], "T********")
                result[idx] = np.bincount(a[positive], minlength=len(idx))
                continue
            mask = sh.union_all(clipped)
            sh.prepare(mask)
            full = sh.covers(mask, cells)
            result[idx[full]] = self.area[idx[full]]
            edge = ~full & sh.intersects(mask, cells)
            result[idx[edge]] = sh.area(sh.intersection(cells[edge], mask))
        return result

    def percent(self, overlap):
        # Store clipped-hex percentages in hundredths. Round exactly once at export.
        return np.rint(np.clip(overlap / self.area, 0, 1) * 10000).astype(int)


def fire_tier_shares(hex_area, district_area, tier_three_area):
    """Classify the unrounded areas, then apportion 10,000 basis points per hex."""
    # district_area is the union of both tiers. Any overlap belongs to Tier 3.
    extreme = np.clip(tier_three_area, 0, hex_area)
    mapped = np.clip(district_area, extreme, hex_area)
    areas = np.column_stack((extreme, mapped - extreme, hex_area - mapped))
    # In an exact tie the first column wins: Tier 3, then Tier 2, then outside.
    dominant = np.array([3, 2, 0])[areas.argmax(axis=1)]
    exact = areas / hex_area[:, None] * 10000
    shares = np.floor(exact).astype(int)
    remaining = 10000 - shares.sum(axis=1)
    # Award leftover hundredths to the largest remainders so the visible split totals 100%.
    order = np.argsort(-(exact - shares), axis=1, kind="stable")
    rows = np.arange(len(shares))
    for place in range(3):
        shares[rows, order[:, place]] += remaining > place
    return {
        "fireDominant": dominant,
        "fireExtremeShare": shares[:, 0],
        "fireElevatedShare": shares[:, 1],
        "fireOutsideShare": shares[:, 2],
    }


def planning_fields(local, polygons, xy):
    coverage = HexCoverage(polygons, xy)
    result = {}
    from drpep_data import FIRE_VIEWS, read
    from planning_geography import geographic_rows
    for key in FIRE_VIEWS:
        expected = set(read(key + "-ids.json")["objectIds"])
        shapes = [g for _, g in geographic_rows(RAW / "drpep" / "details", key + "-features.json", "OBJECTID", expected)]
        result[key] = coverage.percent(coverage.overlap(np.asarray(shapes, dtype=object)))
        register(local, key, 100)
    trees, _ = features("tree")
    tier_two, _ = features("fire2")
    tier_three, _ = features("fire3")
    extreme_area = coverage.overlap(tier_three)
    district_area = coverage.overlap(np.concatenate((tier_two, tier_three)))
    result.update(fire_tier_shares(coverage.area, district_area, extreme_area))
    # Keep the original independent polygon footprints available for planning/GIS users.
    result["tierOne"] = coverage.percent(coverage.overlap(trees))
    result["fireTwoPct"] = coverage.percent(coverage.overlap(tier_two))
    result["fireThreePct"] = coverage.percent(extreme_area)
    for column in (
        "tierOne",
        "fireTwoPct",
        "fireThreePct",
        "fireExtremeShare",
        "fireElevatedShare",
        "fireOutsideShare",
    ):
        register(local, column, 100)
    register(local, "fireDominant")
    studies = []
    for source in ("caiso", "utility", "cpuc"):
        regions, _ = features(source)
        studies.extend(regions)
        column = source + "Areas"
        result[column] = coverage.overlap(regions, count=True).astype(int)
        register(local, column)
    result["planningAreas"] = (
        result["caisoAreas"] + result["utilityAreas"] + result["cpucAreas"]
    )
    result["projectCoverage"] = coverage.percent(coverage.overlap(np.asarray(studies)))
    register(local, "planningAreas")
    register(local, "projectCoverage", 100)
    for source in ("growth", "loadFull", "loadPartial"):
        regions, ranks = features(source)
        schema = raw(f"drpep/hex/{source}/schema.json")
        classes = [
            r["classMaxValue"]
            for r in schema["drawingInfo"]["renderer"]["classBreakInfos"]
        ]
        if classes != [1, 2, 3]:
            raise ValueError(f"Review updated SCE planning classes for {source}")
        shares = np.array(
            [coverage.overlap(regions[ranks == rank]) for rank in classes]
        )
        mapped = coverage.overlap(regions[np.isin(ranks, classes)])
        # Tied classes within 0.01 square metre are reported as mixed.
        maximum = shares.max(axis=0)
        dominant = shares.argmax(axis=0).astype(float) + 1
        tied = (shares > 0) & np.isclose(shares, maximum, atol=0.01, rtol=0)
        dominant[tied.sum(axis=0) > 1] = 4
        dominant[mapped <= 0] = np.nan
        for rank, overlap in zip(classes, shares):
            band = source + "Band" + str(rank)
            result[band] = coverage.percent(overlap)
            register(local, band, 100)
        result[source] = dominant
        result[source + "Coverage"] = coverage.percent(mapped)
        register(local, source)
        register(local, source + "Coverage", 100)
    return result


def cooling_centers(local, polygons, cols, rows):
    expected = set(raw("cooling/ids.json")["objectIds"])
    seen, sites = set(), []
    tree = sh.STRtree(polygons)
    counts = np.zeros(len(polygons), dtype=int)
    missing = 0
    for file in sorted((RAW / "cooling").glob("sites-*.json")):
        data = json.loads(file.read_bytes())
        if (
            data.get("exceededTransferLimit")
            or data["spatialReference"].get("wkid") != 4326
        ):
            raise ValueError("Incomplete cooling-center page or unexpected coordinates")
        for feature in data["features"]:
            a = feature["attributes"]
            oid = a["OBJECTID"]
            if oid in seen:
                raise ValueError("Duplicate cooling-center record")
            seen.add(oid)
            geo = feature.get("geometry")
            if not geo or geo.get("x") is None or geo.get("y") is None:
                missing += 1
                continue
            lon, lat = geo["x"], geo["y"]
            e, n = FORWARD.transform(lon, lat)
            hit = tree.query(sh.Point(e, n), predicate="intersects")
            if not len(hit):
                continue
            i = min(hit)
            counts[i] += 1
            sites.append(
                {
                    "id": oid,
                    "name": str(a["CoolCenterName"] or "").strip(),
                    "address": str(a["Street"] or "").strip(),
                    "city": str(a["City"] or "").strip(),
                    "zip": str(a["ZipCode"] or "").strip(),
                    "hours": str(a["HRSOPERATE"] or "").strip(),
                    "lon": round(lon, 7),
                    "lat": round(lat, 7),
                    "x": round(e / MILE, 6),
                    "y": round(-n / MILE, 6),
                    "tile": f"{cols[i]},{rows[i]}",
                }
            )
    if seen != expected:
        raise ValueError("Incomplete cooling-center inventory")
    register(local, "sceCooling")
    sites.sort(key=lambda s: (s["city"].casefold(), s["name"].casefold(), s["id"]))
    return {
        "sourceCount": len(seen),
        "missingCoordinates": missing,
        "sites": sites,
    }, counts
