"""Assign published project study areas and EV permitting jurisdictions to clipped hexes."""

import json
from collections import defaultdict

import numpy as np
import shapely as sh
from drpep_data import STUDIES, attributes, read
from fetch import RAW
from shapely.geometry import shape

PERMIT_STATES = ("Streamlined", "Streamlining in Progress", "Not Streamlined")
CHECKS = {
    "OrdinanceBool": "Streamlining ordinance",
    "ChecklistBool": "Permit checklist",
    "AdminApprovalBool": "Administrative approval",
    "HealthSafetyBool": "Health and safety review",
    "eSignatureBool": "Electronic signatures",
    "NoAssociationBool": "No association approval",
    "OneNoticeBool": "Single notice of corrections",
}
STAGES = {
    "Planning": "drpPlan",
    "Construction less than 50% completed": "drpBuild",
    "Construction more than 50% completed": "drpBuild",
    "Under Construction": "drpBuild",
    "In Operation": "drpOperate",
    "Operational": "drpOperate",
}


def geographic_rows(folder, pattern, id_key, expected):
    seen = set()
    for file in sorted(folder.glob(pattern)):
        batch = json.loads(file.read_bytes())
        if batch.get("exceededTransferLimit") or batch.get("properties", {}).get(
            "exceededTransferLimit"
        ):
            raise ValueError(f"Truncated geometry batch {file}")
        if batch["features"] and not batch["crs"]["properties"]["name"].endswith(
            "3310"
        ):
            raise ValueError(f"Incorrect projection in {file}")
        for feature in batch["features"]:
            props = feature["properties"]
            oid = props[id_key]
            if oid in seen:
                raise ValueError(f"Duplicate {oid} in {file}")
            seen.add(oid)
            if feature["geometry"]:
                geo = shape(feature["geometry"])
                if not geo.is_valid:
                    geo = sh.make_valid(geo)
                yield props, geo
    if seen != expected:
        raise ValueError(f"Missing or unexpected records in {folder}")


def intersections(geo, tiles, tree, area):
    idx = tree.query(geo, predicate="intersects")
    if not len(idx):
        return idx, np.empty(0)
    sh.prepare(geo)
    inside = sh.covers(geo, tiles[idx])
    share = np.ones(len(idx))
    edge = idx[~inside]
    share[~inside] = sh.area(sh.intersection(tiles[edge], geo)) / area[edge]
    return idx[share > 0], share[share > 0]


def project_index(row, col, tiles, tree, area):
    projects, matches = [], defaultdict(list)
    stages = {k: np.zeros(len(tiles), dtype=int) for k in set(STAGES.values())}
    for authority in STUDIES:
        attrs = {a["objectid"]: a for a in attributes(authority + "-projects.json")}
        folder = RAW / "drpep" / "hex" / authority
        expected = set(json.loads((folder / "ids.json").read_bytes())["objectIds"])
        if expected != set(attrs):
            raise ValueError(
                f"DRPEP project attributes and polygons disagree for {authority}"
            )
        for props, geo in geographic_rows(
            folder, "features-*.json", "objectid", expected
        ):
            obj = attrs[props["objectid"]]
            ids, fractions = intersections(geo, tiles, tree, area)
            idx = len(projects)
            status = obj["project_status"]
            projects.append(
                {
                    "authority": authority,
                    "id": obj["objectid"],
                    "name": obj["project_name"],
                    "status": status,
                    "year": obj["planned_in_service_year"],
                    "type": obj["type"],
                }
            )
            if len(ids):
                sample = ids[np.argmax(fractions * area[ids])]
                projects[-1]["hex"] = f"{col[sample]},{row[sample]}"
            for i in ids:
                matches[f"{col[i]},{row[i]}"].append(idx)
            stage = STAGES.get(status)
            if stage:
                stages[stage][ids] += 1
    return {"records": projects, "byHex": dict(matches)}, stages


def permits_index(row, col, tiles, tree, area):
    folder = RAW / "drpep" / "details"
    expected = set(read("permits-ids.json")["objectIds"])
    jurisdictions, shapes, hits = {}, {}, defaultdict(list)
    for props, geo in geographic_rows(folder, "permits-[0-9]*.json", "FID", expected):
        ids, fractions = intersections(geo, tiles, tree, area)
        if not len(ids):
            continue
        fid = props["FID"]
        jurisdiction = {
            k: props[k]
            for k in (
                "Name",
                "Government_Level",
                "Compliance_Status",
                "Adoption_Month",
                "Adoption_Year",
                "Website",
                "ChecklistURL",
                *CHECKS,
            )
        }
        if jurisdiction["Government_Level"] not in ("City", "County"):
            raise ValueError(f"Unknown permitting jurisdiction type for {fid}")
        if jurisdiction["Compliance_Status"] not in PERMIT_STATES:
            raise ValueError(f"Unknown permitting status for {fid}")
        jurisdictions[fid] = jurisdiction
        shapes[fid] = geo
        for i, frac in zip(ids, fractions):
            hits[i].append((fid, frac))
    dominant = np.full(len(tiles), np.nan)
    status = np.full(len(tiles), np.nan)
    mapped = np.zeros(len(tiles), dtype=int)
    split = {}
    examples = {}
    for i, values in hits.items():
        # City ordinances govern incorporated land. County status applies to the remainder.
        # Resolve any same-level geometric overlap by ascending source FID.
        values.sort(
            key=lambda item: (
                jurisdictions[item[0]]["Government_Level"] == "County",
                item[0],
            )
        )
        if len(values) > 1:
            remainder = tiles[i]
            partition = []
            for fid, _ in values:
                if remainder.is_empty:
                    break
                part = remainder.intersection(shapes[fid])
                if part.area > 0:
                    partition.append((fid, part.area / area[i]))
                    remainder = remainder.difference(part)
            values = partition
        if not values:
            continue
        values.sort(key=lambda item: (-item[1], item[0]))
        dominant[i] = values[0][0]
        by_status = defaultdict(float)
        for fid, frac in values:
            if fid not in examples or frac * area[i] > examples[fid][0]:
                examples[fid] = (frac * area[i], f"{col[i]},{row[i]}")
            by_status[
                PERMIT_STATES.index(jurisdictions[fid]["Compliance_Status"]) + 1
            ] += frac
        status[i] = min(by_status, key=lambda code: (-by_status[code], code))
        total = sum(by_status.values())
        if total > 1.000001:
            raise ValueError(
                f"Overlapping permitting jurisdictions at {col[i]},{row[i]}"
            )
        mapped[i] = round(min(total, 1) * 10000)
        if len(values) > 1:
            split[f"{col[i]},{row[i]}"] = [
                [fid, round(frac * 10000)] for fid, frac in values
            ]
    info = {
        "jurisdictions": {
            k: dict(jurisdictions[k], hex=examples[k][1]) for k in sorted(examples)
        },
        "split": split,
        "criteria": CHECKS,
    }
    return info, {
        "evPermitStatus": status,
        "evPermitCoverage": mapped,
        "permitJurisdiction": dominant,
    }


def add_planning_geography(portals, fields, row, col, area, tiles):
    tree = sh.STRtree(tiles)
    portals["projects"], stages = project_index(row, col, tiles, tree, area)
    portals["permits"], permits = permits_index(row, col, tiles, tree, area)
    columns = {**stages, **permits}
    for key in columns:
        fields[key] = {
            "layer": "hex",
            "column": key,
            "divisor": 100 if key == "evPermitCoverage" else 1,
        }
    return columns
