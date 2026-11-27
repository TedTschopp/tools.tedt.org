"""Download the atlas inputs. The browser only reads the shipped, regional extracts."""

from __future__ import annotations

import concurrent.futures
import hashlib
import json
import math
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[2]
RAW = Path(__file__).resolve().parent / ".cache" / "raw"
OUT = ROOT / "tool-src" / "tools" / "edison-atlas" / "data"
MILE = 1609.344
SCE = "https://drpep.sce.com/arcgis_server/rest/services/Hosted/ICA_Layer/FeatureServer/17"
CES = "https://services1.arcgis.com/PCHfdHz4GlDNAhBb/arcgis/rest/services/CalEnviroScreen_4_0_Results_/FeatureServer/0"
BACK = (
    -800000,
    -1280000,
    1300000,
    760000,
)  # EPSG:3310 backdrop, including portrait map margins
DEM_Z = 8
ACS_TABLES = ("B01003", "B25040", "B25003", "B19013", "B25024")
LOCAL_ACS_TABLES = (
    "B25077",
    "B01002",
    "C17002",
    "B05012",
    "B15003",
    "B28002",
    "B08013",
    "B08303",
    "B27010",
    "B21001",
    "B23025",
)
PRISM = {
    "july": ("tmax", "4km", "25m", "202007"),
    "january": ("tmin", "4km", "25m", "202001"),
    "rain": ("ppt", "4km", "25m", "2020"),
    "solar": ("soltotal", "800m", "30s", "2020"),
}


def query(url, **params):
    return url + "?" + urllib.parse.urlencode(params, doseq=True)


def tile(lon, lat):
    n = 2**DEM_Z
    return (
        math.floor((lon + 180) / 360 * n),
        math.floor((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) * n / 2),
    )


def dem_range():
    tr = Transformer.from_crs(3310, 4326, always_xy=True)
    west, south, east, north = tr.transform_bounds(*BACK, densify_pts=60)
    return (*tile(west, north), *tile(east, south))


def sources():
    census = "https://www2.census.gov/geo"
    cec = "https://www.energy.ca.gov/filebrowser/download/"
    natural = "https://naturalearth.s3.amazonaws.com"
    base = {
        "usaciv-source.zip": "https://karpathy.ai/usaciv/usaciv-source.zip",
        "territory.json": query(
            SCE + "/query",
            where="1=1",
            outFields="objectid",
            returnGeometry="true",
            outSR=3310,
            f="geojson",
        ),
        "tracts.zip": f"{census}/tiger/GENZ2024/shp/cb_2024_06_tract_500k.zip",
        "block-groups.zip": f"{census}/tiger/GENZ2024/shp/cb_2024_06_bg_500k.zip",
        "block-groups-2020.zip": f"{census}/tiger/GENZ2020/shp/cb_2020_06_bg_500k.zip",
        "ca-wac-2024.csv.gz": "https://lehd.ces.census.gov/data/lodes/LODES8/ca/wac/ca_wac_S000_JT00_2024.csv.gz",
        "tracts-2023.zip": f"{census}/tiger/GENZ2023/shp/cb_2023_06_tract_500k.zip",
        "zctas.zip": f"{census}/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip",
        "zbp23detail.zip": "https://www2.census.gov/programs-surveys/cbp/datasets/2023/zbp23detail.zip",
        "cdc-tract-loneliness.json": query(
            "https://data.cdc.gov/resource/yjkw-uj5s.json",
            **{
                "$select": "tractfips,loneliness_crudeprev",
                "stateabbr": "CA",
                "$order": "tractfips",
                "$limit": 50000,
            },
        ),
        "sce-zip-q3-2026.xlsx": "https://www.sce.com/sites/default/files/custom-files/PDF_Files/SCE_2026_Q3_ElectricUsagebyZip.xlsx",
        "cdc-places-tract-ca.json": query(
            "https://data.cdc.gov/resource/yjkw-uj5s.json",
            **{
                "$select": "tractfips,mhlth_crudeprev,depression_crudeprev,ghlth_crudeprev,lpa_crudeprev",
                "stateabbr": "CA",
                "$order": "tractfips",
                "$limit": 50000,
            },
        ),
        "counties.zip": f"{census}/tiger/GENZ2024/shp/cb_2024_us_county_500k.zip",
        "places.zip": f"{census}/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip",
        "roads.zip": f"{census}/tiger/TIGER2024/PRISECROADS/tl_2024_06_prisecroads.zip",
        "rail.zip": f"{natural}/10m_cultural/ne_10m_railroads.zip",
        "rivers.zip": f"{natural}/10m_physical/ne_10m_rivers_lake_centerlines.zip",
        "lakes.zip": f"{natural}/10m_physical/ne_10m_lakes.zip",
        "land.zip": f"{natural}/10m_physical/ne_10m_land.zip",
        "fire.zip": "https://files.cpuc.ca.gov/safety/fire-threat_map/2021/GIS_Files/CPUC_Fire_Threat_Map_v3r_08_19_2021(Tier2Tier3).zip",
        "county-energy.xlsx": cec + "8144?fid=8144",
        "utility-energy.xlsx": cec + "8168?fid=8168",
        "chargers.xlsx": cec + "10037?fid=10037",
        "vehicles.xlsx": cec + "9606?fid=9606",
        "generators.xlsx": "https://www.eia.gov/electricity/data/eia860m/xls/october_generator2026.xlsx",
        "afdc-electric-ca.json": query(
            "https://developer.nlr.gov/api/alt-fuel-stations/v1.json",
            api_key="DEMO_KEY",
            fuel_type="ELEC",
            state="CA",
            country="US",
            status="E",
            access="public",
            limit="all",
        ),
        "eia861.zip": "https://www.eia.gov/electricity/data/eia861/zip/f8612025.zip",
        "parks.json": query(
            "https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer/2/query",
            where="STATE='CA'",
            outFields="UNIT_CODE,UNIT_NAME,UNIT_TYPE",
            outSR=4326,
            maxAllowableOffset=0.0008,
            geometryPrecision=5,
            returnGeometry="true",
            f="geojson",
        ),
        "landmarks.json": query(
            "https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0/query",
            where="Is_NHL='X' AND State IN ('CA','California','CALIFORNIA')",
            outFields="NRIS_Refnum,RESNAME,City,County,State",
            outSR=4326,
            f="geojson",
        ),
        "nlcd.tif": query(
            "https://www.mrlc.gov/geoserver/ows",
            service="WCS",
            version="2.0.1",
            request="GetCoverage",
            coverageId="mrlc_download__NLCD_2021_Land_Cover_L48",
            subset=["X(-2304000,-1526000)", "Y(1224000,2013000)"],
            format="image/tiff",
            scalesize="i(3112),j(3156)",
            interpolation="http://www.opengis.net/def/interpolation/OGC/1/nearest-neighbor",
        ),
    }
    for key, (var, res, name, period) in PRISM.items():
        base[key + ".zip"] = (
            f"https://data.prism.oregonstate.edu/normals/us/{res}/{var}/monthly/prism_{var}_us_{name}_{period}_avg_30y.zip"
        )
    for key in (*ACS_TABLES, *LOCAL_ACS_TABLES):
        base[key + ".dat"] = (
            f"https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-{key.lower()}.dat"
        )
    x0, y0, x1, y1 = dem_range()
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            base[f"dem/{x}-{y}.png"] = (
                f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{DEM_Z}/{x}/{y}.png"
            )
    return base


def download(item):
    name, url = item
    dest = RAW / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        temp = dest.with_suffix(dest.suffix + ".part")
        for attempt in range(4):
            try:
                req = urllib.request.Request(
                    url, headers={"User-Agent": "Civ-SCE regional atlas data builder"}
                )
                with (
                    urllib.request.urlopen(req, timeout=120) as src,
                    temp.open("wb") as out,
                ):
                    while chunk := src.read(1024 * 1024):
                        out.write(chunk)
                with temp.open("rb") as fh:
                    head = fh.read(128).lstrip()
                if head.startswith((b"<!DOCTYPE", b"<html", b"<?xml", b"<ows:")):
                    raise ValueError(f"{name} received a web or exception page")
                if name.endswith((".xlsx", ".zip")) and head[:2] != b"PK":
                    raise ValueError(f"{name} is not a ZIP container")
                if name.endswith(".json"):
                    obj = json.loads(temp.read_bytes())
                    if "error" in obj:
                        raise ValueError(obj["error"])
                os.replace(temp, dest)
                break
            except Exception as exc:
                if attempt == 3:
                    raise RuntimeError(f"Could not download {name}: {exc}") from exc
                time.sleep(2**attempt)
    with dest.open("rb") as f:
        digest = hashlib.file_digest(f, "sha256").hexdigest()
    return {"file": name, "url": url, "bytes": dest.stat().st_size, "sha256": digest}


def main():
    from sce_feeds import inputs as sce_inputs

    all_inputs = sources()
    all_inputs.update(sce_inputs())
    manifest = OUT / "inputs.json"
    expected = (
        {v["file"]: v for v in json.loads(manifest.read_bytes())}
        if manifest.exists()
        else {}
    )
    ids_url = query(CES + "/query", where="1=1", returnIdsOnly="true", f="json")
    download(("ces-ids.json", ids_url))
    ids = sorted(json.loads((RAW / "ces-ids.json").read_bytes())["objectIds"])
    for i in range(0, len(ids), 300):
        batch = ids[i : i + 300]
        all_inputs[f"ces-range/{i:05}.json"] = query(
            CES + "/query",
            where=f"OBJECTID BETWEEN {batch[0]} AND {batch[-1]}",
            outFields="OBJECTID,TractTXT,CIscoreP",
            outSR=3310,
            maxAllowableOffset=20,
            geometryPrecision=2,
            returnGeometry="true",
            f="geojson",
        )
    all_inputs["ces-ids.json"] = ids_url
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(download, v): v[0] for v in all_inputs.items()}
        records, failures = [], []
        for task in concurrent.futures.as_completed(futures):
            try:
                row = task.result()
                locked = expected.get(row["file"])
                if locked and (
                    locked["url"] != row["url"] or locked["sha256"] != row["sha256"]
                ):
                    raise ValueError(
                        f"{row['file']} differs from the shipped snapshot. Preserve the original manifest and review the changed source before creating a new edition."
                    )
                records.append(row)
                if "/" not in row["file"]:
                    print(f"{row['file']}  {row['bytes']:,} bytes", flush=True)
            except (ValueError, OSError, RuntimeError) as exc:
                failures.append(str(exc))
                print(exc, flush=True)
    if failures:
        raise SystemExit("\n".join(failures))
    OUT.mkdir(parents=True, exist_ok=True)
    pending = manifest.with_suffix(".json.part")
    pending.write_text(
        json.dumps(sorted(records, key=lambda row: row["file"]), indent=1) + "\n"
    )
    os.replace(pending, manifest)
    print(f"Verified {len(records)} source files.")


if __name__ == "__main__":
    main()
