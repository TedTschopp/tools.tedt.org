"""Check the grid, GIS exchange package, reporting geographies and primary-source totals."""

import json
import math
import zipfile
from collections import Counter, defaultdict

import numpy as np
import shapely as sh
from fetch import MILE, OUT, RAW
from geography import FORWARD, HEX_AREA, INVERSE, grid, territory
from regional import workbook
from shapely.geometry import shape
from utility import regular_cell


def check_utility(data, boundary, tile_ids):
    totals = data["totals"]
    expected = {
        "solar": (400, 504, 15458.9),
        "wind": (75, 86, 4359.8),
        "battery": (139, 157, 10070.6),
    }
    for kind, values in expected.items():
        assert tuple(totals[kind][k] for k in ("sites", "units", "mw")) == values
    assert (totals["battery"]["mwh"], totals["battery"]["energyUnits"]) == (
        35089.4,
        157,
    )
    stations = json.loads((RAW / "afdc-electric-ca.json").read_bytes())["fuel_stations"]
    east, north = FORWARD.transform(
        [v["longitude"] for v in stations], [v["latitude"] for v in stations]
    )
    mask = sh.intersects_xy(boundary, east, north)
    selected = [v for v, inside in zip(stations, mask) if inside]
    ev = totals["ev"]
    assert len({v["id"] for v in selected}) == len(selected) == ev["sites"] == 6198
    for field, name in [
        ("ev_level1_evse_num", "level1"),
        ("ev_level2_evse_num", "level2"),
        ("ev_dc_fast_num", "dc"),
    ]:
        assert sum(v[field] or 0 for v in selected) == ev[name]
    assert ev["ports"] == ev["level1"] + ev["level2"] + ev["dc"] == 20018
    assert set(data["levels"]) == {"1", "12", "48"}
    for width, areas in data["levels"].items():
        w = int(width)
        assert len({(a["col"], a["row"]) for a in areas}) == len(areas)
        inside = sh.intersects_xy(
            boundary, [a["x"] * MILE for a in areas], [-a["y"] * MILE for a in areas]
        )
        assert inside.all()
        aggregate = defaultdict(Counter)
        for a in areas:
            assert set(a) == {"col", "row", "x", "y", "near", "values"}
            cell = a["col"], a["row"]
            assert regular_cell(a["x"], a["y"], w) == cell
            if w == 1:
                assert cell in tile_ids and set(a["values"]) == {"ev"}
            for kind, values in a["values"].items():
                assert values["sites"] > 0 and values.keys() == totals[kind].keys()
                if kind == "ev":
                    assert (
                        values["ports"]
                        == values["level1"] + values["level2"] + values["dc"]
                    )
                aggregate[kind].update(values)
        assert set(aggregate) == ({"ev"} if w == 1 else set(totals))
        for kind, metrics in aggregate.items():
            for name, value in metrics.items():
                assert math.isclose(value, totals[kind][name], abs_tol=0.0001)
    print(
        "PASS · utility reporting areas reconcile at 48, 12 and 1 miles; source stations, port counts and map anchors verified"
    )


def check():
    def load(key):
        return json.loads((OUT / key).read_bytes())

    a, reg, tract = load("atlas.json"), load("regional.json"), load("tracts.json")
    raw = np.fromfile(OUT / "hexes.bin", "<i4").reshape(a["cells"], len(a["columns"]))
    col = {key: raw[:, i] for i, key in enumerate(a["columns"])}
    b = territory()
    row, x, _, area, polygons = grid(b)
    assert np.array_equal(col["col"], x) and np.array_equal(col["row"], row)
    assert len(set(zip(x, row))) == a["cells"] and len(b.geoms) == a["pieces"]
    assert abs(area.sum() / MILE**2 - a["areaSqMi"]) < 0.000001
    assert (area > 0).all() and area.max() <= HEX_AREA + 1e-4
    assert np.allclose(np.maximum(1, np.rint(area / HEX_AREA * 1e6)), col["coverage"])
    # Cover even the boundary components too small to contain a regular hex center.
    tree = sh.STRtree(polygons)
    for part in b.geoms:
        indices = tree.query(part, predicate="intersects")
        assert len(indices) and abs(
            sh.area(sh.intersection(polygons[indices], part)).sum() - part.area
        ) < max(0.5, part.area * 1e-9)
    assert 0.997 < a["groundMiles"][0] < 1 < a["groundMiles"][1] < 1.003
    places = {p["name"]: p for p in a["places"]}
    for name in (
        "Avalon",
        "Bishop",
        "Blythe",
        "Long Beach",
        "Mammoth Lakes",
        "Visalia",
    ):
        assert places[name]["inside"], name
    for name in ("Los Angeles", "Anaheim", "Pasadena", "Riverside"):
        assert not places[name]["inside"], name
    assert set(col["fire"]) == {0, 2, 3}
    assert set(col["fireDominant"]) == {0, 2, 3}
    fire_codes = np.array([3, 2, 0])
    fire_shares = np.stack(
        [col[k] for k in ("fireExtremeShare", "fireElevatedShare", "fireOutsideShare")]
    )
    assert np.all((fire_shares >= 0) & (fire_shares <= 10000))
    assert np.all(fire_shares.sum(axis=0) == 10000)
    for rank, shares in zip(fire_codes, fire_shares):
        won = col["fireDominant"] == rank
        assert np.array_equal(shares[won], fire_shares[:, won].max(axis=0))
    assert set(col["cover"]).issubset(
        {11, 12, 21, 22, 23, 24, 31, 41, 42, 43, 52, 71, 81, 82, 90, 95}
    )
    assert np.all((col["solar"] > 200) & (col["solar"] < 800))
    assert np.all(col["july"] > col["january"])
    assert min(col["county"]) == -1 and max(col["county"]) < len(reg["counties"])
    for k, rows in [("tract", tract["rows"]), ("ces", tract["screen"])]:
        assert -1 <= min(col[k]) and max(col[k]) < len(rows)
    reported = defaultdict(float)
    for year, _, county, _, _, gwh in workbook("county-energy.xlsx"):
        if year == 2024:
            reported[county.title()] += gwh
    for c in reg["counties"]:
        assert round(reported[c["name"].removesuffix(" County")]) == c["gwh"], c["name"]
        assert abs(sum(c["sectors"].values()) - c["gwh"]) <= 0.501
    assert (
        reg["utility"]["summerPeak"] == 21112 and reg["utility"]["accounts"] == 5343161
    )
    assert len(reg["referenceSources"]) == 31
    local = load("local.json")
    original_home = {}
    with (RAW / "B25077.dat").open("rb") as source:
        for line in source:
            if line.startswith(b"1500000US06"):
                gid, value, moe = line.strip().split(b"|")
                original_home[gid[9:].decode()] = tuple(
                    int(s) if s.isdigit() else None for s in (value, moe)
                )
    shapes = load("local-boundaries.json")
    for layer, tab in local["tables"].items():
        assert len({r[0] for r in tab["rows"]}) == len(tab["rows"])
        assert all(len(r) == len(tab["columns"]) for r in tab["rows"])
        assert col[layer].min() >= -1 and col[layer].max() < len(tab["rows"])
        if layer in shapes:
            assert len(shapes[layer]) == len(tab["rows"])
            assert all(s[4] and s[0] <= s[2] and s[1] <= s[3] for s in shapes[layer])
    groups = local["tables"]["bg"]["rows"]
    home = local["fields"]["home_value"]["index"]
    error = local["fields"]["homeMoe"]["index"]
    assert all(
        (r[home], r[error]) == original_home.get(r[0], (None, None)) for r in groups
    )
    i = np.flatnonzero((x == 109) & (row == 339))[0]
    g = groups[col["bg"][i]]
    assert (g[0], g[home], g[error]) == ("060590995041", 1453100, 346577)
    assert {local["fields"][k]["layer"] for k in ("commute", "foreign_born")} == {
        "tract"
    }
    zips = local["tables"]["zcta"]
    obs = dict(zip(zips["columns"], next(r for r in zips["rows"] if r[0] == "91741")))
    assert (obs["gwh"], obs["resGwh"], obs["publishedClassMonths"]) == (
        37.888609,
        30.119871,
        6,
    )
    assert (
        obs["vehicles"] == 21210 and obs["plugIns"] == 1908 and obs["agShare"] is None
    )
    assert col["chargers"].sum() == 20018 and col["dcFast"].sum() == 6353
    assert np.all(col["dcFast"] <= col["chargers"])
    for k in ("forest", "farmland", "developed"):
        percent = col[k][col["landSamples"] > 0]
        assert (percent >= 0).all() and (percent <= 10000).all()
        assert (col[k][col["landSamples"] == 0] == a["noData"]).all()
    powers = local["tables"]["energyArea"]
    for field, expected in (
        ("solarMW", 15458.9),
        ("storageMW", 10070.6),
        ("windMW", 4359.8),
    ):
        assert math.isclose(
            sum(r[powers["columns"].index(field)] for r in powers["rows"]), expected
        )
    assert set(local["tables"]["health"]["columns"][1:]) == {
        "mentalDistress",
        "depression",
        "poorHealth",
        "inactivity",
        "tractWellbeing",
        "loneliness",
    }
    portals = load("sce-portals.json")
    assert (
        len(portals["planning"]) == 20
        and sum(len(s["layers"]) for s in portals["planning"]) == 94
    )
    assert len(portals["forecast"]) and len(portals["upgrades"])
    assert set(portals) == {
        "planning",
        "forecast",
        "upgrades",
        "cooling",
        "mappedHexes",
    }
    assert (
        "planningRegion" not in local["tables"] and "planningRegion" not in a["columns"]
    )
    assert {k for k in local["fields"] if k.startswith("sce")} == {"sceCooling"}
    retained = [r for r in load("inputs.json") if "sce-outage-ags" in r["url"]]
    assert retained and all(
        "/reference/MapServer/0/query?" in r["url"] and r["file"].startswith("cooling/")
        for r in retained
    )
    cooling = portals["cooling"]
    assert cooling["sourceCount"] == len(
        json.loads((RAW / "cooling/ids.json").read_bytes())["objectIds"]
    )
    tiles = {f"{c},{r}": i for i, (c, r) in enumerate(zip(x, row))}
    counts = Counter()
    for site in cooling["sites"]:
        i = tiles[site["tile"]]
        counts[i] += 1
        assert polygons[i].covers(
            sh.Point(*FORWARD.transform(site["lon"], site["lat"]))
        )
    assert np.array_equal(col["sceCooling"], [counts[i] for i in range(len(row))])
    assert len({s["id"] for s in cooling["sites"]}) == len(cooling["sites"])
    assert np.array_equal(
        col["planningAreas"], col["caisoAreas"] + col["utilityAreas"] + col["cpucAreas"]
    )
    assert not np.any((col["projectCoverage"] > 0) & (col["planningAreas"] == 0))
    for k in ("projectCoverage", "tierOne", "fireTwoPct", "fireThreePct"):
        assert np.all((col[k] >= 0) & (col[k] <= 10000)) and np.any(
            (col[k] > 0) & (col[k] < 10000)
        )
    for k in ("growth", "loadFull", "loadPartial"):
        assert set(np.unique(col[k])) <= {a["noData"], 1, 2, 3, 4}
        assert np.any(col[k] == a["noData"]) and np.any(col[k] > 0)
        coverage = col[k + "Coverage"]
        assert np.all((coverage >= 0) & (coverage <= 10000)) and np.all(
            coverage[col[k] == a["noData"]] == 0
        )
        for rank in (1, 2, 3):
            band = col[k + "Band" + str(rank)]
            assert np.all(band >= 0) and np.all(band <= coverage + 1)
    # Compare sampled coastal, interior and partially covered hexes directly to the
    # original features. Clip per feature before union, independently of the tiled builder.
    from planning import features as source_features
    from planning import fire_tier_shares

    # Three-way plurality, exact ties, the precision of tiny clipped hexes, and
    # a near tie which displays 50/50 but is decided by unrounded area.
    sizes = np.array([100, 100, 100, 100, 0.003, 100.0])
    cases = fire_tier_shares(
        sizes,
        np.array([69, 100, 50, 49.999999, 0.003, 0]),
        np.array([35, 50, 0, 0, 0.002, 0]),
    )
    assert cases["fireDominant"].tolist() == [3, 3, 2, 0, 3, 0]
    assert cases["fireElevatedShare"][3] == cases["fireOutsideShare"][3] == 5000

    sample = set(np.linspace(0, len(row) - 1, 21, dtype=int))
    for k in (
        "tierOne",
        "fireTwoPct",
        "fireThreePct",
        "projectCoverage",
        "growthCoverage",
        "loadFullCoverage",
    ):
        partial = np.flatnonzero((col[k] > 0) & (col[k] < 10000))
        sample.update(partial[:: max(1, len(partial) // 5)][:5])
    sample.update([tiles["163,146"], tiles["129,311"], tiles["83,53"]])
    # Verify each changed point classification plus coastal, split and rounded-tie cases.
    fire_sample = sorted(
        sample
        | set(np.flatnonzero(col["fireDominant"] != col["fire"]))
        | set(np.flatnonzero((fire_shares == fire_shares.max(axis=0)).sum(axis=0) > 1))
    )
    native_fire = [sh.STRtree(source_features(key)[0]) for key in ("fire3", "fire2")]
    for i in fire_sample:
        cell = polygons[i]
        parts = []
        for index in native_fire:
            hits = index.query(cell, predicate="intersects")
            parts.append(sh.union_all(sh.intersection(index.geometries[hits], cell)))
        extreme, elevated = parts
        exclusive = [
            extreme,
            elevated.difference(extreme),
            cell.difference(extreme.union(elevated)),
        ]
        areas = np.array([part.area for part in exclusive])
        assert col["fireDominant"][i] == fire_codes[areas.argmax()]
        assert np.max(np.abs(areas / cell.area * 10000 - fire_shares[:, i])) <= 1.00001
    print(
        f"PASS · {len(row):,} wildfire tier splits sum to 100%; {len(fire_sample)} classifications checked independently against district polygons"
    )
    masks = {i: [] for i in sample}
    for key, field in (
        ("tree", "tierOne"),
        ("fire2", "fireTwoPct"),
        ("fire3", "fireThreePct"),
        ("caiso", "caisoAreas"),
        ("utility", "utilityAreas"),
        ("cpuc", "cpucAreas"),
        ("growth", "growth"),
        ("loadFull", "loadFull"),
        ("loadPartial", "loadPartial"),
    ):
        shapes, ranks = source_features(key)
        index = sh.STRtree(shapes)
        for i in sample:
            cell = polygons[i]
            hits = index.query(cell, predicate="intersects")
            pieces = sh.intersection(shapes[hits], cell)

            def basis_points(geometry, cell_area=cell.area):
                return round(10000 * geometry.area / cell_area)

            if field.endswith("Areas"):
                assert col[field][i] == sum(sh.area(pieces) > 0)
                masks[i].extend(pieces)
            elif key in ("growth", "loadFull", "loadPartial"):
                bands = [
                    sh.union_all(pieces[ranks[hits] == rank]) for rank in (1, 2, 3)
                ]
                vals = np.array([g.area for g in bands])
                for rank, geometry in enumerate(bands, 1):
                    assert (
                        abs(basis_points(geometry) - col[field + "Band" + str(rank)][i])
                        <= 1
                    )
                assert (
                    abs(basis_points(sh.union_all(bands)) - col[field + "Coverage"][i])
                    <= 1
                )
                valid = (vals > 0) & np.isclose(vals, max(vals), atol=0.01, rtol=0)
                expected = (
                    a["noData"]
                    if not np.any(vals)
                    else (4 if sum(valid) > 1 else vals.argmax() + 1)
                )
                assert col[field][i] == expected, (
                    key,
                    i,
                    expected,
                    col[field][i],
                    vals,
                )
            else:
                assert abs(basis_points(sh.union_all(pieces)) - col[field][i]) <= 1
    for i, pieces in masks.items():
        assert (
            abs(
                round(sh.union_all(pieces).area / area[i] * 10000)
                - col["projectCoverage"][i]
            )
            <= 1
        )
    print(
        f"PASS · independent source polygons for {len(sample)} hexes across nine DRPEP layers, every cooling-center location and all planning columns"
    )
    assert all(r[1] == sum(r[2:]) for r in local["tables"]["work"]["rows"])
    print(
        "PASS · every block-group home estimate and margin against B25077; local joins, coverage, ZIP sales, ports, capacity and land percentages"
    )
    profiles = load("geography-profiles.json")
    access = load("land-access.json")
    assert set(profiles["places"]) == {p["id"] for p in a["places"]}
    assert profiles["places"]["0644000"]["population"] == 3857263
    assert profiles["places"]["0644000"]["county"] == "06037"
    assert reg["metros"]["31080"]["population"] == 12844441
    assert access["classes"] == ["military", "restricted", "closed"]
    assert set(access["byHex"]).issubset(tiles)
    for values in access["byHex"].values():
        assert len(values) == 3 and any(values) and all(-1 <= v <= 10000 for v in values)
    assert access["byHex"]["137,140"] == [2069, 0, 0]
    assert access["byHex"]["50,-25"] == [0, 0, 8330]
    utility = load("utility.json")
    check_utility(utility, b, set(zip(x, row)))
    # Reread the portable artifact as an independent WGS84 feature collection.
    with zipfile.ZipFile(OUT / "SCE-one-mile-hexes.zip") as z:
        assert z.testzip() is None
        features = json.loads(z.read("sce-one-mile.geojson"))["features"]
        assert len(features) == len(row)
        assert all(
            f["geometry"]["type"] in ("Polygon", "MultiPolygon") for f in features
        )
        areas = sum(f["properties"]["area_sqmi"] for f in features)
        assert math.isclose(areas, a["areaSqMi"], abs_tol=0.00001)
        for i in np.linspace(0, len(row) - 1, 250, dtype=int):
            f = features[i]
            p = f["properties"]
            assert f["id"] == f"{x[i]},{row[i]}"
            assert (
                shape(f["geometry"])
                .buffer(1e-6)
                .covers(sh.Point(p["sample_lon"], p["sample_lat"]))
            )
            assert p["county_fips"] == (
                reg["counties"][col["county"][i]]["geoid"]
                if col["county"][i] >= 0
                else None
            )
        assert json.loads(z.read("geography-profiles.json")) == profiles
        assert json.loads(z.read("land-access.json")) == access
        assert json.loads(z.read("inputs.json")) == load("inputs.json")
        assert json.loads(z.read("regional.json")) == reg
        assert json.loads(z.read("utility.json")) == utility
        assert json.loads(z.read("local.json")) == local
        assert json.loads(z.read("sce-portals.json")) == portals
        assert "sce-planning-48mi.geojson" not in z.namelist()
        sites = json.loads(z.read("sce-cooling-centers.geojson"))["features"]
        assert {f["id"] for f in sites} == {v["id"] for v in cooling["sites"]}
        from build import PLANNING_NAMES

        for i in sample:
            props = features[i]["properties"]
            assert props["cpuc_tier"] == col["fire"][i]
            assert props["cpuc_tier_dominant"] == col["fireDominant"][i]
            for key, value in zip(
                ("cpuc_tier3_pct", "cpuc_tier2_pct", "cpuc_outside_tiers_pct"),
                fire_shares[:, i],
            ):
                assert props[key] == value / 100
            assert props["sce_cooling_centers"] == col["sceCooling"][i]
            for key, slug in PLANNING_NAMES.items():
                val = col[key][i]
                assert props["drpep_" + slug] == (
                    None
                    if val == a["noData"]
                    else val / local["fields"][key]["divisor"]
                )
        for layer, name in (
            ("bg", "sce-acs-block-groups"),
            ("tract", "sce-acs-tracts"),
            ("health", "sce-health-tracts"),
            ("zcta", "sce-zip-areas"),
            ("work", "sce-employment-block-groups"),
        ):
            records = json.loads(z.read(name + ".geojson"))["features"]
            tab = local["tables"][layer]
            expected = {r[0]: dict(zip(tab["columns"], r)) for r in tab["rows"]}
            assert len(records) == len({f["id"] for f in records}) and len(
                records
            ) >= 0.99 * len(expected)
            for feature in records:
                assert feature["properties"] == expected[feature["id"]]
                assert feature["geometry"]["type"] in ("Polygon", "MultiPolygon")
            assert all(shape(record["geometry"]).area > 0 for record in records[::41])
        exported = next(f["properties"] for f in features if f["id"] == "109,339")
        assert (
            exported["acs_block_group"],
            exported["acs_home_value_usd"],
            exported["acs_home_moe90_usd"],
        ) == (g[0], 1453100, 346577)
        tile_geom = {f["id"]: f["geometry"] for f in features}
        for width, records in utility["levels"].items():
            gis = json.loads(z.read(f"sce-utility-{width}mi.geojson"))["features"]
            assert len(gis) == len(records)
            for record, f in zip(records, gis):
                cell = f"{record['col']},{record['row']}"
                assert f["id"] == width + ":" + cell
                metrics = {
                    f"{k}_{field}": v
                    for k, s in record["values"].items()
                    for field, v in s.items()
                }
                assert f["properties"] == {
                    "width_mi": int(width),
                    "col": record["col"],
                    "row": record["row"],
                    "near": record["near"],
                    **metrics,
                }
                g = shape(f["geometry"])
                assert (
                    g.geom_type in ("Polygon", "MultiPolygon")
                    and g.is_valid
                    and g.area > 0
                )
                pt = sh.Point(
                    *INVERSE.transform(record["x"] * MILE, -record["y"] * MILE)
                )
                assert g.buffer(1e-6).covers(pt)
                if width == "1":
                    assert g.equals(shape(tile_geom[cell]))
    print("PASS · utility GIS polygons, numeric properties and one-mile tile joins")
    print(
        f"PASS · {len(row):,} hexes · {a['pieces']} polygon parts · {areas:,.4f} mi² · {a['boundaryCells']:,} clipped cells"
    )
    print(
        "PASS · all geographic joins, Census place checks, CEC totals and WGS84 export"
    )
    print(
        "Ground spacing",
        a["groundMiles"],
        "miles. CPUC samples",
        dict(Counter(col["fire"].tolist())),
    )


if __name__ == "__main__":
    check()
