"""Small-area community data and spatial summaries of SCE's public planning maps."""

import csv
import io
import json
import zipfile
from collections import defaultdict

import numpy as np
from fetch import RAW
from sce_feeds import raw


def add_columns(local, layer, keys, values):
    table = local["tables"][layer]
    for key in keys:
        local["fields"][key] = {"layer": layer, "index": len(table["columns"])}
        table["columns"].append(key)
    for row in table["rows"]:
        found = values.get(row[0], {})
        row.extend(found.get(k) for k in keys)


def zip_indicators(postal):
    values = {z: {} for z in postal}
    with (
        zipfile.ZipFile(RAW / "zbp23detail.zip") as archive,
        archive.open("zbp23detail.txt") as file,
    ):
        for r in csv.DictReader(io.TextIOWrapper(file, encoding="latin-1")):
            key = {"------": "employers", "813110": "religiousEmployers"}.get(
                r["naics"]
            )
            if key and r["zip"] in values:
                values[r["zip"]][key] = int(r["est"])
    for v in values.values():
        if "religiousEmployers" in v and v.get("employers"):
            v["religiousEmployerShare"] = round(
                100 * v["religiousEmployers"] / v["employers"], 2
            )
    decl = raw("fema/ca-major.json")
    records = decl["DisasterDeclarationsSummaries"]
    if int(decl["metadata"]["count"]) != len(records):
        raise ValueError("Truncated FEMA declaration series")
    disasters = {r["disasterNumber"] for r in records}
    events = defaultdict(set)
    for v in values.values():
        v.update(femaEvents=0, femaRegistrations=0, femaApproved=0)
    for kind in ("Owners", "Renters"):
        ids = set()
        for file in sorted((RAW / "fema" / kind).glob("*.json")):
            for r in json.loads(file.read_bytes())["HousingAssistance" + kind]:
                if r["id"] in ids:
                    raise ValueError("Duplicate FEMA result")
                ids.add(r["id"])
                z, event = str(r["zipCode"]), r["disasterNumber"]
                n = r["validRegistrations"] or 0
                if z in values and event in disasters and n > 0:
                    events[z].add(event)
                    values[z]["femaRegistrations"] += n
                    values[z]["femaApproved"] += r["approvedForFemaAssistance"] or 0
        if len(ids) != int(raw(f"fema/{kind}-count.json")["metadata"]["count"]):
            raise ValueError("Incomplete FEMA " + kind + " records")
    for z, items in events.items():
        values[z]["femaEvents"] = len(items)
    return values


def add_community(local):
    postal = [r[0] for r in local["tables"]["zcta"]["rows"]]
    zips = zip_indicators(postal)
    keys = [
        "employers",
        "religiousEmployers",
        "religiousEmployerShare",
        "femaEvents",
        "femaRegistrations",
        "femaApproved",
    ]
    add_columns(local, "zcta", keys, zips)

    # Establish the benchmark using California's complete four-measure tract records.
    measures = (
        "mhlth_crudeprev",
        "depression_crudeprev",
        "ghlth_crudeprev",
        "lpa_crudeprev",
    )
    rows = {
        r["tractfips"]: [float(r[k]) for k in measures]
        for r in raw("cdc-places-tract-ca.json")
        if all(r.get(k) is not None for k in measures)
    }
    matrix = np.array(list(rows.values()))
    mean, std = matrix.mean(axis=0), matrix.std(axis=0)
    health = {
        k: {
            "tractWellbeing": round(
                float(100 - 10 * np.mean((np.asarray(row) - mean) / std)), 2
            )
        }
        for k, row in rows.items()
    }
    for r in raw("cdc-tract-loneliness.json"):
        if r.get("loneliness_crudeprev") is not None:
            health.setdefault(r["tractfips"], {})["loneliness"] = float(
                r["loneliness_crudeprev"]
            )
    add_columns(local, "health", ["tractWellbeing", "loneliness"], health)
