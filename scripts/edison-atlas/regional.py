"""Published county, metro, state and utility statistics at their native reporting scales."""

import io
import json
import zipfile
from collections import defaultdict

from fetch import RAW
from geography import pct
from openpyxl import load_workbook


def workbook(name, sheet=None):
    book = load_workbook(RAW / name, read_only=True, data_only=True)
    yield from (book[sheet] if sheet else book.active).values
    book.close()


def cec_data():
    county, history, sector = defaultdict(dict), defaultdict(float), defaultdict(float)
    for year, _, name, kind, _, gwh in workbook("county-energy.xlsx"):
        if year == 2024:
            sectors = county[name.title()].setdefault("sectors", {})
            sectors[kind] = sectors.get(kind, 0) + gwh
    for year, _, name, _, kind, _, gwh in workbook("utility-energy.xlsx"):
        if name == "Southern California Edison Company":
            history[year] += gwh
            if year == 2024:
                sector[kind] += gwh
    for name, row in county.items():
        row["gwh"] = round(sum(row["sectors"].values()))
        row["resGwh"] = round(row["sectors"].get("Residential", 0))
    for year, name, fuel, _, _, _, count in workbook("vehicles.xlsx", "County"):
        if year == 2025 and name in county:
            r = county[name]
            r["vehicles"] = r.get("vehicles", 0) + count
            if fuel in ("Battery Electric (BEV)", "Plug-in Hybrid (PHEV)"):
                r["plugIns"] = r.get("plugIns", 0) + count
    for row in workbook("chargers.xlsx", "July 2026"):
        if row[0] in county:
            c = county[row[0]]
            c["chargers"] = sum(row[i] for i in (2, 4, 6))
            c["dcFast"] = row[6]
            c["limited"] = sum(row[i] for i in (3, 5, 7))
    for c in county.values():
        c["plugShare"] = pct(c.get("plugIns", 0), c.get("vehicles"))
    return county, {"history": dict(sorted(history.items())), "sectors": dict(sector)}


def eia(counties):
    by_name = {
        c["name"].removesuffix(" County").casefold(): c for c in counties.values()
    }
    rows = iter(workbook("generators.xlsx", "Operating"))
    next(rows)
    next(rows)
    fields = list(next(rows))
    idx = [
        fields.index(f)
        for f in ("Plant State", "County", "Technology", "Nameplate Capacity (MW)")
    ]
    for row in rows:
        state, county, tech, mw = [row[i] for i in idx]
        if (
            state != "CA"
            or str(county).casefold() not in by_name
            or not isinstance(mw, (float, int))
        ):
            continue
        c = by_name[county.casefold()]
        mix = c.setdefault("capacity", {})
        mix[tech] = round(mix.get(tech, 0) + mw, 2)
    for c in counties.values():
        c["solarMW"] = round(
            sum(v for k, v in c.get("capacity", {}).items() if "Solar" in k)
        )
        c["storageMW"] = round(
            sum(v for k, v in c.get("capacity", {}).items() if "Batteries" in k)
        )
        c["windMW"] = round(
            sum(v for k, v in c.get("capacity", {}).items() if "Wind" in k)
        )
        c["geoMW"] = round(
            sum(v for k, v in c.get("capacity", {}).items() if "Geothermal" in k)
        )
        c["hydroMW"] = round(c.get("capacity", {}).get("Conventional Hydroelectric", 0))
        c["agShare"] = pct(
            c["sectors"].get("Agriculture and Water Pumping", 0),
            sum(c["sectors"].values()),
        )
        c["chargeRate"] = (
            round(c["chargers"] * 1000 / c["plugIns"], 2) if c.get("plugIns") else None
        )

    def sce_row(z, name, util_col):
        w = load_workbook(
            io.BytesIO(z.read(name + "_2025.xlsx")), read_only=True, data_only=True
        )
        rows = [r for r in w.worksheets[0].values if r[util_col] == 17609]
        assert len(rows) == 1
        return rows[0]

    with zipfile.ZipFile(RAW / "eia861.zip") as z:
        op = sce_row(z, "Operational_Data", 1)
        rel = sce_row(z, "Reliability", 1)
        net = sce_row(z, "Net_Metering", 2)
    return {
        "summerPeak": op[6],
        "winterPeak": op[7],
        "accounts": rel[14],
        "saidi": rel[5],
        "saifi": rel[6],
        "saidiEx": rel[8],
        "saifiEx": rel[9],
        "netSolarMW": net[10],
        "netSolarSystems": net[15],
        "netSolarBasis": net[5],
    }


def select(d, keys):
    return {k: d[k] for k in keys if k in d}


def regional(ids):
    z = zipfile.ZipFile(RAW / "usaciv-source.zip")

    def ref(key):
        return json.loads(z.read("usaciv/web/data/" + key + ".json"))

    raw = ref("counties")
    county = {r[0]: dict(zip(raw["columns"], r)) for r in raw["rows"] if r[0] in ids}
    assert set(county) == set(ids)
    energy, utility = cec_data()
    for c in county.values():
        name = c["name"].removesuffix(" County")
        c.update(energy[name])
        assert c["gwh"] > 0 and c["vehicles"] > 0
        c.pop("cell", None)
    utility.update(eia(county))
    districts, people = ref("districts"), ref("citizens")
    d = ref("disasters")
    fema = d["fema"]["counties"]
    for r in fema["rows"]:
        if r[0] in county:
            county[r[0]]["fema"] = dict(zip(fema["columns"], r))
    for gid, c in county.items():
        c["districts"] = districts["counties"].get(gid)
    metro = {}
    for m in ref("cities"):
        if not set(m["counties"]).intersection(ids):
            continue
        record = select(
            m,
            (
                "id",
                "name",
                "full",
                "population",
                "yields",
                "jobs",
                "employed",
                "median_income",
                "median_rent",
                "home_value",
                "unemployment",
                "rent_burden",
                "gdp",
                "gdp_year",
                "gdp_by_industry",
                "gdp_undisclosed",
                "gdp_estimated",
                "growth",
                "growth_years",
                "counties",
                "pop_series",
            ),
        )
        record["people"] = people["cities"].get(m["id"])
        record["districts"] = districts["cities"].get(m["id"])
        metro[m["id"]] = record
    tr = ref("trade")
    zname = {v["id"]: v["short"] for v in tr["zones"]}
    zones = []
    for v in tr["zones"]:
        if "CA" in v["states"] and (
            set(v["cities"]).intersection(metro) or v["name"] == "Rest of California"
        ):
            zones.append(
                {
                    "name": v["name"],
                    "totals": v["totals_musd"],
                    "partners": [
                        [zname.get(code, code), val, mode]
                        for code, val, mode in v["partners"]
                    ],
                }
            )
    trans = ref("infrastructure")
    airports = [
        select(a, ("name", "city", "county", "enplanements", "cargo_lbs", "year", "id"))
        for a in trans["airports"]
        if a["county"] in county
    ]
    ports = [
        select(a, ("name", "county", "tons", "imports", "exports", "year"))
        for a in trans["ports"]
        if a["county"] in county
    ]
    wonders = [
        select(w, ("name", "kind", "metrics", "county", "rank"))
        for w in ref("wonders")["wonders"]
        if w["county"] in county
    ]
    military = ref("military")
    mil = military["states"]["CA"]
    res = ref("resources")
    state = {
        "disasters": d["noaa"]["states"]["CA"],
        "defense": {
            "active": mil["personnel"]["active"]["total"],
            "civilian": mil["personnel"]["civilian"]["total"],
            "spending": mil["spending"]["total"],
            "installationCount": sum(
                v["state"] == "CA" for v in military["installations"]
            ),
        },
        "resources": res["summary"]["states"]["CA"],
        "resourceNames": {v["id"]: v["name"] for v in res["types"]},
    }
    sources = [
        select(s, ("id", "publisher", "title", "vintage", "homepage", "license"))
        for s in ref("sources")
    ]
    return {
        "counties": [county[i] for i in ids],
        "fields": raw["fields"],
        "metros": metro,
        "trade": zones,
        "airports": airports,
        "ports": ports,
        "wonders": wonders,
        "utility": utility,
        "state": state,
        "districtNames": {v["id"]: v["name"] for v in districts["catalog"]},
        "peopleGroups": {
            k: {v["key"]: v["label"] for v in groups}
            for k, groups in people["groups"].items()
        },
        "industries": {k: v["title"] for k, v in districts["industries"].items()},
        "referenceSources": sources,
    }
