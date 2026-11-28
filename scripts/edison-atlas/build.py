"""Build the shipped static atlas from its cached public inputs."""

import json
import math
import zipfile

import numpy as np
import shapely as sh
from civ_geography import GIS_NOTE, write_civ_geography
from community import add_community
from fetch import MILE, OUT, PRISM, RAW
from geography import (
    HEX_AREA,
    INVERSE,
    NODATA,
    Terrain,
    backdrop,
    contexts,
    demographics,
    enviro,
    fire_at,
    grid,
    linework,
    project,
    raster_sample,
    rings,
    tables,
    territory,
    write_json,
)
from grid_network import schematic as grid_schematic
from local_sources import build_local, write_source_layers
from planning import cooling_centers, planning_fields
from planning_geography import add_planning_geography
from pyproj import Geod
from regional import regional
from sce_feeds import reports as sce_reports
from shapely.geometry import shape
from substations import add_substations
from utility import build_utility, utility_geojson

PLANNING_NAMES = {
    "drpPlan": "planning_stage_records",
    "drpBuild": "construction_stage_records",
    "drpOperate": "operational_stage_records",
    "evPermitStatus": "ev_permit_status",
    "portalTree": "portal_tree_mortality_pct",
    "portalFire2": "portal_elevated_pct",
    "portalFire3": "portal_extreme_pct",
    "evPermitCoverage": "ev_permit_mapped_pct",
    "permitJurisdiction": "ev_permit_largest_jurisdiction_fid",
    "planningAreas": "study_area_records",
    "projectCoverage": "study_area_pct",
    "caisoAreas": "caiso_study_areas",
    "utilityAreas": "utility_study_areas",
    "cpucAreas": "cpuc_study_areas",
    "tierOne": "tree_tier1_pct",
    "fireTwoPct": "fire_tier2_pct",
    "fireThreePct": "fire_tier3_pct",
    "growth": "load_growth_rank",
    "growthCoverage": "load_growth_mapped_pct",
    "loadFull": "capacity_full_rank",
    "loadFullCoverage": "capacity_full_mapped_pct",
    "loadPartial": "capacity_full_partial_rank",
    "loadPartialCoverage": "capacity_full_partial_mapped_pct",
}
for column, slug in (
    ("growth", "load_growth"),
    ("loadFull", "capacity_full"),
    ("loadPartial", "capacity_full_partial"),
):
    for rank in (1, 2, 3):
        PLANNING_NAMES[f"{column}Band{rank}"] = f"{slug}_band{rank}_pct"


def parks_and_landmarks(boundary):
    parks, landmarks = [], []
    for f in json.loads((RAW / "parks.json").read_bytes())["features"]:
        g = project(shape(f["geometry"]))
        if not sh.intersects(boundary, g):
            continue
        r = f["properties"]
        in_territory = sh.make_valid(g).intersection(boundary)
        anchor = in_territory.representative_point()
        parks.append(
            {
                "name": r["UNIT_NAME"],
                "code": r["UNIT_CODE"],
                "rings": rings(g, 90),
                "x": round(anchor.x / MILE, 4),
                "y": round(-anchor.y / MILE, 4),
            }
        )
    for f in json.loads((RAW / "landmarks.json").read_bytes())["features"]:
        if not f.get("geometry"):
            continue
        g = project(shape(f["geometry"])).representative_point()
        if not sh.covers(boundary, g):
            continue
        r = f["properties"]
        landmarks.append(
            {
                "name": r["RESNAME"],
                "town": r["City"],
                "id": r["NRIS_Refnum"],
                "x": round(g.x / MILE, 4),
                "y": round(-g.y / MILE, 4),
            }
        )
    return parks, landmarks


def main():
    OUT.mkdir(exist_ok=True, parents=True)
    b = territory()
    row, col, xy, area, polygons = grid(b)
    points = sh.points(xy)
    lon, lat = INVERSE.transform(xy[:, 0], xy[:, 1])
    print(
        f"{len(row):,} intersecting tiles across {len(b.geoms)} territory polygons",
        flush=True,
    )
    acs, populations = tables()
    ids, counties, outlines, places, overlap = contexts(b, points, populations)
    write_civ_geography(places, b, row, col, area, polygons, ids)
    tract, tracts = demographics(b, points, acs)
    ces, scores = enviro(b, points)
    utility = build_utility(b, places)
    local, local_columns, outlines_local = build_local(
        b, xy, polygons, col, row, tracts, utility
    )
    portals = sce_reports()
    portals["network"] = grid_schematic(b)
    add_substations(portals, local)
    portals["cooling"], local_columns["sceCooling"] = cooling_centers(
        local, polygons, col, row
    )
    add_community(local)
    planning = planning_fields(local, polygons, xy)
    planning.update(add_planning_geography(portals, local["fields"], row, col, area, polygons))
    local_columns.update(planning)
    portals["mappedHexes"] = {
        key: int(np.count_nonzero(np.isfinite(values) & (values > 0)))
        for key, values in planning.items()
    }
    write_json("sce-portals.json", portals)
    write_json("local.json", local)
    write_json("local-boundaries.json", outlines_local)
    reg = regional(ids)
    for county, geometry in zip(reg["counties"], overlap):
        county.update(geometry)
    print(
        f"{len(places)} places, {len(ids)} intersecting counties, {len(tracts)} tracts",
        flush=True,
    )
    dem = Terrain()
    elev = dem.sample(lon, lat)
    dx = dem.sample(*INVERSE.transform(xy[:, 0] + 500, xy[:, 1])) - dem.sample(
        *INVERSE.transform(xy[:, 0] - 500, xy[:, 1])
    )
    dy = dem.sample(*INVERSE.transform(xy[:, 0], xy[:, 1] - 500)) - dem.sample(
        *INVERSE.transform(xy[:, 0], xy[:, 1] + 500)
    )
    shade = np.clip((dx + dy) * 0.12, -40, 38)
    climate = {k: raster_sample(k, lon, lat) for k in PRISM}
    values = {
        "col": col,
        "row": row,
        "coverage": np.maximum(1, np.rint(area / HEX_AREA * 1e6)),
        "county": counties,
        "tract": tract,
        "ces": ces,
        "elev": elev,
        "cover": raster_sample("nlcd", lon, lat),
        "fire": fire_at(points),
        "july": (climate["july"] * 1.8 + 32) * 10,
        "january": (climate["january"] * 1.8 + 32) * 10,
        "rain": climate["rain"] / 25.4 * 10,
        "solar": climate["solar"] / 3.6 * 100,
        "shade": shade,
        "lon": lon * 1e5,
        "lat": lat * 1e5,
        **local_columns,
    }
    data = np.column_stack(
        [np.where(np.isfinite(a), np.rint(a), NODATA) for a in values.values()]
    ).astype("<i4")
    data.tofile(OUT / "hexes.bin")
    write_json(
        "tracts.json",
        {
            "columns": [
                "geoid",
                "density",
                "income",
                "electricHeat",
                "renters",
                "multifamily",
            ],
            "rows": tracts,
            "screen": scores,
        },
    )
    write_json("regional.json", reg)
    parks, landmarks = parks_and_landmarks(b)
    backdrop_bounds, contours, ocean = backdrop(dem)
    write_json(
        "context.json",
        {
            "counties": outlines,
            **linework(),
            "parks": parks,
            "landmarks": landmarks,
            "contours": contours,
            "ocean": ocean,
        },
    )
    west, south, east, north = b.bounds
    # Audit actual eastward and diagonal center spacings across the territory on the ellipsoid.
    geod = Geod(ellps="GRS80")
    distances = []
    for dx, dy in (
        (MILE, 0),
        (0.5 * MILE, 0.5 * math.sqrt(3) * MILE),
        (-0.5 * MILE, 0.5 * math.sqrt(3) * MILE),
    ):
        dlon, dlat = INVERSE.transform(xy[:, 0] + dx, xy[:, 1] + dy)
        distances.append(geod.inv(lon, lat, dlon, dlat)[2] / MILE)
    manifest = {
        "columns": list(values),
        "noData": NODATA,
        "cells": len(row),
        "miles": MILE,
        "pieces": len(b.geoms),
        "areaSqMi": b.area / MILE**2,
        "fullAreaSqMi": HEX_AREA / MILE**2,
        "boundaryCells": int((area < 0.99999999 * HEX_AREA).sum()),
        "groundMiles": [
            round(float(np.min(distances)), 6),
            round(float(np.max(distances)), 6),
        ],
        "bounds": [west / MILE, -north / MILE, east / MILE, -south / MILE],
        "backdrop": backdrop_bounds,
        "territory": rings(b),
        "places": places,
        "countyIds": ids,
        "snapshot": "2026-11-27",
        "parkCount": len(parks),
        "landmarkCount": len(landmarks),
    }
    write_json("atlas.json", manifest)
    write_json("utility.json", utility)
    # WGS84 exchange geometry is clipped in the metric projection before reprojection.
    wgs = sh.transform(polygons, INVERSE.transform, interleaved=False)
    field_offsets = {key: index for index, key in enumerate(values)}
    with zipfile.ZipFile(
        OUT / "SCE-one-mile-hexes.zip", "w", zipfile.ZIP_DEFLATED, compresslevel=6
    ) as archive:
        with archive.open("sce-one-mile.geojson", "w") as dest:
            dest.write(b'{"type":"FeatureCollection","features":[')
            for i, p in enumerate(wgs):
                if i:
                    dest.write(b",")
                t = tracts[tract[i]] if tract[i] >= 0 else [None] * 6
                c = reg["counties"][counties[i]] if counties[i] >= 0 else {}
                env = scores[ces[i]] if ces[i] >= 0 else [None, None]

                def raw(key, divisor=1, record=data[i]):
                    n = int(record[field_offsets[key]])
                    return None if n == NODATA else n / divisor

                props = {
                    "tile": f"{col[i]},{row[i]}",
                    "col": int(col[i]),
                    "row": int(row[i]),
                    "area_sqmi": round(float(area[i]) / MILE**2, 9),
                    "sample_lon": round(float(lon[i]), 6),
                    "sample_lat": round(float(lat[i]), 6),
                    "elevation_m": raw("elev"),
                    "nlcd_2021": raw("cover"),
                    "cpuc_tier": raw("fire"),
                    "cpuc_tier_dominant": int(raw("fireDominant")),
                    "cpuc_tier2_pct": raw("fireElevatedShare", 100),
                    "cpuc_tier3_pct": raw("fireExtremeShare", 100),
                    "cpuc_outside_tiers_pct": raw("fireOutsideShare", 100),
                    "july_high_f": raw("july", 10),
                    "jan_low_f": raw("january", 10),
                    "precip_in": raw("rain", 10),
                    "solar_kwh_m2_day": raw("solar", 100),
                    "acs_tract": t[0],
                    "tract_people_sqmi": t[1],
                    "tract_income_usd": t[2],
                    "tract_elec_heat_pct": t[3],
                    "tract_renter_pct": t[4],
                    "tract_multifamily_pct": t[5],
                    "ces_tract": env[0],
                    "ces_percentile": env[1],
                    "county_fips": c.get("geoid"),
                    "whole_county_gwh": c.get("gwh"),
                    "county_plugin_pct": c.get("plugShare"),
                    "county_public_chargers": c.get("chargers"),
                    "county_solar_mw": c.get("solarMW"),
                    "county_battery_mw": c.get("storageMW"),
                }
                for key, field in (
                    ("bg", "acs_block_group"),
                    ("health", "cdc_tract_2023"),
                    ("zcta", "zip_zcta"),
                    ("energyArea", "energy_12mi"),
                    ("work", "work_block_group_2020"),
                ):
                    idx = int(local_columns[key][i])
                    props[field] = (
                        local["tables"][key]["rows"][idx][0] if idx >= 0 else None
                    )
                for key in (
                    "sceCooling",
                    "home_value",
                    "homeMoe",
                    "chargers",
                    "dcFast",
                    "forest",
                    "farmland",
                    "developed",
                    "gwh",
                    "resGwh",
                    "substations",
                ):
                    spec = local["fields"][key]
                    if spec["layer"] == "hex":
                        value = raw(spec["column"], spec["divisor"])
                    else:
                        idx = int(
                            tract[i]
                            if spec["layer"] == "tract"
                            else local_columns[spec["layer"]][i]
                        )
                        value = (
                            local["tables"][spec["layer"]]["rows"][idx][spec["index"]]
                            if idx >= 0
                            else None
                        )
                    field = {
                        "sceCooling": "sce_cooling_centers",
                        "home_value": "acs_home_value_usd",
                        "homeMoe": "acs_home_moe90_usd",
                        "chargers": "hex_ev_ports",
                        "dcFast": "hex_dc_fast_ports",
                        "forest": "hex_forest_pct",
                        "farmland": "hex_farmland_pct",
                        "developed": "hex_developed_pct",
                        "gwh": "zip_sce_published_gwh",
                        "resGwh": "zip_sce_residential_gwh",
                        "substations": "drpep_12mi_substation_records",
                    }[key]
                    props[field] = value
                for key, name in PLANNING_NAMES.items():
                    props["drpep_" + name] = raw(key, local["fields"][key]["divisor"])
                head = json.dumps(
                    {"type": "Feature", "id": props["tile"], "properties": props},
                    separators=(",", ":"),
                )[:-1]
                dest.write((head + ',"geometry":' + sh.to_geojson(p) + "}").encode())
            dest.write(b"]}")
        for name in (
            "regional.json",
            "tracts.json",
            "utility.json",
            "local.json",
            "inputs.json",
            "sce-portals.json",
            "land-access.json",
            "geography-profiles.json",
        ):
            archive.write(OUT / name, name)
        archive.writestr("geography-profiles-and-land.txt", GIS_NOTE)
        archive.writestr("drpep-planning-and-permits.txt",
            "Join sce-portals.json projects.byHex and permits.split to the tile key in sce-one-mile.geojson. "
            "projects.byHex indexes projects.records. Each approval has its published project name, stage and planned service year. "
            "A project may have approvals from multiple bodies. Counts are approval records. "
            "EV permit status codes are 1 streamlined, 2 in progress and 3 not streamlined. Each hex takes the status with the largest mapped area. "
            "The largest jurisdiction is identified by its source FID. Split rows list each FID and its share in hundredths of one percent. "
            "Incorporated areas take precedence over unincorporated county rules. A null code means no published jurisdiction. "
            "The three portal fire coverage fields use the external public fire views selected in SCE’s web map. "
            "Substation counts describe entire clipped 12-mile areas. Join the energy_12mi key to local.json energyArea rows or the col,row in sce-portals.json substations.areas. "
            "The substation icons mark reporting areas. Avoid summing the repeated area count across one-mile hexes.\n")
        write_source_layers(archive, b, local)
        site_features = [
            {
                "type": "Feature",
                "id": site["id"],
                "geometry": {
                    "type": "Point",
                    "coordinates": [site["lon"], site["lat"]],
                },
                "properties": {
                    key: site[key]
                    for key in ("name", "address", "city", "zip", "hours", "tile")
                },
            }
            for site in portals["cooling"]["sites"]
        ]
        archive.writestr(
            "sce-cooling-centers.geojson",
            json.dumps(
                {"type": "FeatureCollection", "features": site_features},
                separators=(",", ":"),
            ),
        )
        for width, areas in utility["levels"].items():
            archive.writestr(
                f"sce-utility-{width}mi.geojson", utility_geojson(b, int(width), areas)
            )
        archive.writestr(
            "README.txt",
            "Edison Atlas | 2026-11-27\nOne projected mile across flats in NAD83 / California Albers (EPSG:3310). Clipped polygons are exported in WGS84 longitude/latitude. area_sqmi is measured before reprojection. Sample points fall in the retained portion of each tile. County and tract fields repeat their original geographic values and must not be summed across hexes. cpuc_tier_dominant gives the fire map color. It selects the largest unrounded area among Tier 3, Tier 2, and outside both inside the clipped hex. A shared polygon area belongs to Tier 3. The higher tier wins an exact tie. The three fields cpuc_tier3_pct, cpuc_tier2_pct and cpuc_outside_tiers_pct sum to 100 percent. Code 0 means outside Tiers 2 and 3. The original cpuc_tier field records the tier at the sample point. Null means no data. PRISM Group, Oregon State University, https://prism.oregonstate.edu, accessed November 27, 2026. Mapzen Terrain Tiles accessed the same day. regional.json contains further county, metro, state and utility statistics and the upstream USACiv publisher credits. Source URLs and hashes are in inputs.json.\n"
            "sce-utility-48mi.geojson, sce-utility-12mi.geojson and sce-utility-1mi.geojson contain the clipped, occupied reporting areas as WGS84 polygons. Property names consist of the category and metric (e.g. solar_sites or ev_ports). Categories without inventory in an area are omitted. Use one scale when totaling any metric. The one-mile layer contains public charging only.\n"
            "sce-acs-block-groups.geojson, sce-acs-tracts.geojson, sce-health-tracts.geojson and sce-zip-areas.geojson contain native reporting polygons clipped to SCE and the estimates for their full source areas. local.json contains the corresponding source tables, plus twelve-mile capacity. The first column of each record is its source ID. Match those IDs to sce-one-mile.geojson. The ZIP energy figures are published noncombined customer-class subtotals from July to September 2026. Census and ZIP values repeat on sample tiles; group by source geography. Home-value margins of error use 90% confidence. Missing values remain null.\n"
            "utility.json contains the same reporting data in the map's format. Levels (48, 12 and 1) give the hex width across flats in projected miles. Join the one-mile level by col,row. Each area's x,y is an illustrative anchor in miles east and south of the EPSG:3310 origin. near is the nearest Census place to the anchor. Solar, wind and battery values include EIA-860M operating plant sites per technology, units and nameplate mw. Batteries also have reported mwh and the number of units reporting energyUnits. AFDC ev values include publicly accessible station sites, level1, level2 and dc ports, their sum ports, restrictedSites with reported access restrictions, and otherSites with other equipment descriptions. Different technologies can share a plant. All owners within the SCE boundary are included. Sources and dates appear in the atlas.\n",
        )
        archive.writestr(
            "SCE-portals-and-community.txt",
            "sce-one-mile.geojson includes DRPEP values computed from positive-area overlaps with each clipped hex. The three approval counts describe source records in the CAISO, utility and CPUC layers. The combined study-area percentage dissolves overlaps. Fire and tree percentages use the part of the hex in SCE as denominator. The drpep_fire_tier2_pct and drpep_fire_tier3_pct fields retain SCE’s separate polygon footprints, which may overlap. The cpuc percentage fields partition that area for the wildfire map. Heat-map ranks describe the class covering the greatest mapped area, and mapped_pct gives the fraction of the entire clipped hex as a percentage. In the load-growth map ranks 1, 2 and 3 mean circuit growth above 5 MW, above 3 through 5 MW, and 0 through 3 MW. The available-load maps use SCE classes above 3 MW, 1 to 3 MW and 0 to 1 MW. Rank 4 denotes tied leading classes. The band1_pct, band2_pct and band3_pct fields give each published band’s union area as a percentage of the clipped hex. Different bands can overlap and their percentages can sum above 100. Percentages are rounded to 0.01%. A null rank means no mapped class. The heat-map classes describe the source planning areas and must not be added across tiles. The two capacity scenarios use full applications and full plus partial applications. The annual MW forecasts and upgrade category counts are retained at their source reporting scope in sce-portals.json. The cooling-center GeoJSON and hex counts contain listed sites whose point is inside SCE. A listing does not establish that a location is open. The ZIP and tract source tables also include the Census employer, FEMA housing assistance and CDC health measures.\n",
        )
        archive.write(OUT.parent / "licenses" / "USACiv-MIT.txt", "USACiv-MIT.txt")
    print(
        "Built atlas",
        {
            k: manifest[k]
            for k in (
                "cells",
                "areaSqMi",
                "boundaryCells",
                "groundMiles",
                "parkCount",
                "landmarkCount",
            )
        },
    )
    print(
        "Raster/area coverage",
        {k: round(np.isfinite(v).mean(), 4) for k, v in climate.items()},
        "counties",
        (counties >= 0).sum(),
        "tracts",
        (tract >= 0).sum(),
        "CES",
        (ces >= 0).sum(),
    )


if __name__ == "__main__":
    main()
