"""Public DRPEP reporting tables and the EV permit jurisdictions embedded in SCE's web map."""

import json

from fetch import RAW, download, query

HOST = "https://drpep.sce.com/arcgis_server/rest/services/Hosted"
WEB_MAP = "https://drpep.sce.com/arcgis_portal/sharing/rest/content/items/cd4865e42c154dfc9b52c024314c3263/data"
PERMITS = "https://services3.arcgis.com/uknczv4rpevve42E/arcgis/rest/services/AB_1236_Compliance_Status/FeatureServer/0"
SCE_VIEWS = "https://services5.arcgis.com/z6hI6KRjKHvhNO0r/arcgis/rest/services"
FIRE_VIEWS = {
    "portalTree": (SCE_VIEWS + "/SCE_HHZ_Tier1_PublicView/FeatureServer/0", "1=1"),
    "portalFire2": (
        SCE_VIEWS + "/SCE_HighFireRiskArea_PublicView/FeatureServer/0",
        "LABEL = 'Tier 2'",
    ),
    "portalFire3": (
        SCE_VIEWS + "/SCE_HighFireRiskArea_PublicView/FeatureServer/0",
        "LABEL = 'Tier 3'",
    ),
}
PERMIT_FIELDS = "FID,Name,Government_Level,Compliance_Status,Adoption_Month,Adoption_Year,Website,ChecklistURL,OrdinanceBool,ChecklistBool,AdminApprovalBool,HealthSafetyBool,eSignatureBool,NoAssociationBool,OneNoticeBool"
STUDIES = ("caiso", "utility", "cpuc")
DEMAND = ("base_demand", "ev", "pv", "es", "ee", "be")
DEMAND_LABELS = (
    "Base MW",
    "EV MW",
    "Solar MW",
    "Storage MW",
    "Efficiency MW",
    "Building electrification MW",
)
PROFILE = (
    ("avg", "min_load_mw", "Mean of minima (MW)"),
    ("avg", "max_load_mw", "Mean of maxima (MW)"),
)
# Geography-free statistics. Each table keeps its original population and record count.
TABLES = [
    (
        "Substation planning assumptions",
        "GNA_Layer",
        5,
        [("year_value", "Year")],
        list(zip(["sum"] * 6, DEMAND, DEMAND_LABELS)),
    ),
    *[
        (
            f"Distribution upgrades · {title}",
            "DUPR_Layer",
            i,
            [("grid_need", "Service required")],
            [],
        )
        for i, title in [(1, "substations"), (2, "subtransmission")]
    ],
    *[
        (
            f"Grid needs · {title}",
            "GNA_Layer",
            i,
            [("grid_need", "Service required")],
            [],
        )
        for i, title in enumerate(("circuits", "substations", "subtransmission"))
    ],
    *[
        (
            f"Historical shutoff records · {title}",
            "DRP_PSPS_Layer",
            i,
            [("year", "Year")],
            [("avg", "minutes_deenergized", "Mean minutes per record")],
        )
        for i, title in enumerate(("subtransmission", "distribution"))
    ],
    (
        "Interconnection Screen L",
        "DRP_ScreenL_08202021",
        0,
        [("screen_l_pass_fail", "Screen result")],
        [],
    ),
    (
        "Distribution circuit inventory",
        "Distribution_circuits",
        0,
        [("circuit_type", "Type")],
        [],
    ),
    ("ICA segment inventory", "ICA_Layer", 0, [("phase", "Phase")], []),
    (
        "Distributed energy growth scenarios",
        "LNBA_Layer",
        0,
        [
            ("planning_year", "Planning year"),
            ("der_forecast_year", "DER forecast year"),
        ],
        [],
    ),
    *[
        (
            f"Locational net benefits · {horizon}",
            "LNBA_Layer",
            i,
            [("lnba_results_1", "First project’s published benefit range")],
            [],
        )
        for i, horizon in enumerate(("short term", "mid term", "long term"), 1)
    ],
    (
        "Subtransmission interconnection study records",
        "SUBTRANS_HEATMAP",
        0,
        [("cluster_study", "Study")],
        [],
    ),
    *[
        (
            f"Available-load submissions · {scenario}",
            "AVL_LOAD_CAP_TOGGLE",
            i,
            [("plan_year", "Plan year")],
            [],
        )
        for i, scenario in enumerate(("full", "full and partial"))
    ],
    *[
        (title, "ICA_Tables", i, [("year", "Year"), ("month", "Month")], PROFILE)
        for i, title in [
            (1, "Historical circuit load profiles"),
            (2, "Historical substation load profiles"),
            (4, "Rolling circuit load profiles (forecast-view tab)"),
        ]
    ],
]


def read(name):
    return json.loads((RAW / "drpep" / "details" / name).read_bytes())


def layer_url(service, layer):
    return f"{HOST}/{service}/FeatureServer/{layer}"


def records(url, fields, **extra):
    return query(
        url + "/query",
        where="1=1",
        outFields=fields,
        returnGeometry="false",
        f="json",
        **extra,
    )


def inputs(bbox):
    urls = {}

    def add(name, url):
        urls["drpep/details/" + name] = url

    add("webmap.json", WEB_MAP + "?f=json")
    for key, (url, where) in FIRE_VIEWS.items():
        add(
            key + "-ids.json",
            query(url + "/query", where=where, returnIdsOnly="true", f="json"),
        )
        add(
            key + "-features.json",
            query(
                url + "/query",
                where=where,
                outFields="OBJECTID",
                returnGeometry="true",
                outSR=3310,
                geometryPrecision=2,
                f="geojson",
            ),
        )
    for layer in (1, 2, 4):
        add(
            f"months-{layer}.json",
            query(
                layer_url("ICA_Tables", layer) + "/query",
                where="1=1",
                returnDistinctValues="true",
                outFields="month,monthlabel",
                returnGeometry="false",
                f="json",
            ),
        )
    for title, service, layer, groups, measures in TABLES:
        stats = [
            {
                "statisticType": "count",
                "onStatisticField": "objectid",
                "outStatisticFieldName": "records",
            }
        ]
        for op, field, _ in measures:
            stats.append(
                {
                    "statisticType": op,
                    "onStatisticField": field,
                    "outStatisticFieldName": f"{op}_{field}",
                }
            )
        by = ",".join(field for field, _ in groups)
        add(
            f"{service}-{layer}-stats.json",
            query(
                layer_url(service, layer) + "/query",
                where="1=1",
                groupByFieldsForStatistics=by,
                orderByFields=by,
                outStatistics=json.dumps(stats),
                returnGeometry="false",
                f="json",
            ),
        )
    add(
        "territory.json",
        records(
            layer_url("ICA_Layer", 17),
            "existing_gen,queued_gen,total_gen,projected_load,penetration_level",
        ),
    )
    for service, layer in (
        ("ICA_Tables", 0),
        ("LNBA_Layer", 4),
        ("GNA_Layer", 4),
        ("DUPR_Layer", 3),
    ):
        add(
            f"{service}-date.json",
            records(layer_url(service, layer), "extract_name,fgdb_date"),
        )
    for layer, name in enumerate(STUDIES):
        add(
            name + "-projects.json",
            records(
                layer_url("DRP_Transmission_Projects", layer),
                "objectid,project_name,project_status,planned_in_service_year,type",
                orderByFields="objectid",
            ),
        )
    add("permits-schema.json", PERMITS + "?f=json")
    scope = {
        "geometry": ",".join(str(v) for v in bbox),
        "geometryType": "esriGeometryEnvelope",
        "inSR": 3310,
        "spatialRel": "esriSpatialRelIntersects",
    }
    add(
        "permits-ids.json",
        query(PERMITS + "/query", where="1=1", returnIdsOnly="true", f="json", **scope),
    )
    name = "drpep/details/permits-ids.json"
    download((name, urls[name]))
    ids = sorted(read("permits-ids.json")["objectIds"])
    for n in range(0, len(ids), 12):
        add(
            f"permits-{n:04d}.json",
            query(
                PERMITS + "/query",
                objectIds=",".join(map(str, ids[n : n + 12])),
                outFields=PERMIT_FIELDS,
                outSR=3310,
                geometryPrecision=2,
                returnGeometry="true",
                f="geojson",
            ),
        )
    return urls


def attributes(filename):
    obj = read(filename)
    if obj.get("exceededTransferLimit") or "error" in obj:
        raise ValueError("Incomplete DRPEP table " + filename)
    return [f["attributes"] for f in obj["features"]]


def territory_reports():
    tables = []
    for title, service, layer, groups, measures in TABLES:
        rows = attributes(f"{service}-{layer}-stats.json")
        expected = json.loads(
            (RAW / f"drpep/counts/{service}-{layer}.json").read_bytes()
        )["count"]
        if sum(row["records"] for row in rows) != expected:
            raise ValueError(f"Partial {service}/{layer} grouped result")
        keys = (
            [k for k, _ in groups]
            + [f"{op}_{k}" for op, k, _ in measures]
            + ["records"]
        )
        if service == "ICA_Tables":
            labels = {
                r["month"]: r["monthlabel"].split(",")[0].strip().title()
                for r in attributes(f"months-{layer}.json")
            }
            for row in rows:
                row["month"] = labels.get(row["month"]) or str(row["month"])
        tables.append(
            {
                "title": title,
                "service": service,
                "layer": layer,
                "columns": [label for _, label in groups]
                + [label for _, _, label in measures]
                + ["Source records"],
                "rows": [[row[k] for k in keys] for row in rows],
            }
        )
    dates = {
        service: attributes(service + "-date.json")[0]["fgdb_date"]
        for service in ("ICA_Tables", "GNA_Layer", "DUPR_Layer", "LNBA_Layer")
    }
    (territory,) = attributes("territory.json")
    return {"territory": territory, "tables": tables, "releaseDates": dates}
