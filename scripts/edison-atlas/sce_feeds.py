"""Public SCE planning inventory, planning heat maps, environmental polygons and cooling centers."""

import json
from concurrent.futures import ThreadPoolExecutor

from drpep_data import inputs as detail_inputs
from drpep_data import territory_reports
from fetch import RAW, download, query, sources
from shapely import total_bounds
from shapely.geometry import shape

DRP = "https://drpep.sce.com/arcgis_server/rest/services/Hosted"
COOLING = (
    "https://sce-outage-ags.esriemcs.com/arcgis/rest/services/43/reference/MapServer/0"
)
FEMA = "https://www.fema.gov/api/open/v2/"
# Numeric heat-map classes, environmental areas and approved project study areas.
SPATIAL_LAYERS = {
    "growth": ("LOAD_GROWTH_PEN_HTMAP", 0, "objectid,rank", 1000),
    "loadFull": ("AVL_LOAD_HEAT_MAP_TOGGLE", 0, "objectid,rank", 1000),
    "loadPartial": ("AVL_LOAD_HEAT_MAP_TOGGLE", 1, "objectid,rank", 1000),
    "tree": ("Firemap", 0, "objectid", 100),
    "fire2": ("Firemap", 1, "objectid", 12),
    "fire3": ("Firemap", 2, "objectid", 5),
    "caiso": ("DRP_Transmission_Projects", 0, "objectid", 30),
    "utility": ("DRP_Transmission_Projects", 1, "objectid", 30),
    "cpuc": ("DRP_Transmission_Projects", 2, "objectid", 30),
}


def raw(name):
    return json.loads((RAW / name).read_bytes())


def count_url(layer):
    return query(layer + "/query", where="1=1", returnCountOnly="true", f="json")


def inputs():
    urls = {}

    def inspect(name, url):
        urls[name] = url
        download((name, url))
        return raw(name)

    catalog = inspect("drpep/services.json", DRP + "?f=json")
    services = [
        s["name"].split("/")[-1]
        for s in catalog["services"]
        if s["type"] == "FeatureServer"
    ]

    def inventory(service):
        base = f"{DRP}/{service}/FeatureServer"
        filename = f"drpep/{service}.json"
        download((filename, base + "?f=json"))
        data = raw(filename)
        items = {filename: base + "?f=json"}
        for page in data.get("layers", []) + data.get("tables", []):
            items[f"drpep/counts/{service}-{page['id']}.json"] = count_url(
                f"{base}/{page['id']}"
            )
        return items

    with ThreadPoolExecutor(max_workers=4) as pool:
        for items in pool.map(inventory, services):
            urls.update(items)
    download(("territory.json", sources()["territory.json"]))
    bbox = total_bounds(
        [shape(f["geometry"]) for f in raw("territory.json")["features"]]
    )
    urls.update(detail_inputs(bbox))
    from substations import capture
    urls.update(capture())
    from grid_network import capture as grid_crossings
    urls.update(grid_crossings())
    for key, (service, layer_id, fields, batch_size) in SPATIAL_LAYERS.items():
        layer = f"{DRP}/{service}/FeatureServer/{layer_id}"
        urls[f"drpep/hex/{key}/schema.json"] = layer + "?f=json"
        # California-wide fire layers only need features intersecting the territory envelope.
        scope = {}
        if service == "Firemap":
            scope = {
                "geometry": ",".join(str(v) for v in bbox),
                "geometryType": "esriGeometryEnvelope",
                "inSR": 3310,
                "spatialRel": "esriSpatialRelIntersects",
            }
        ids = sorted(
            inspect(
                f"drpep/hex/{key}/ids.json",
                query(
                    layer + "/query",
                    where="1=1",
                    returnIdsOnly="true",
                    f="json",
                    **scope,
                ),
            )["objectIds"]
        )
        if len(ids) != len(set(ids)):
            raise ValueError(f"Duplicate source IDs in {key}")
        for offset in range(0, len(ids), batch_size):
            batch = ids[offset : offset + batch_size]
            urls[f"drpep/hex/{key}/features-{offset:06}.json"] = query(
                layer + "/query",
                where=f"objectid BETWEEN {batch[0]} AND {batch[-1]}",
                outFields=fields,
                outSR=3310,
                geometryPrecision=2,
                returnGeometry="true",
                f="geojson",
                **scope,
            )

    fields = ["base_demand", "ev", "pv", "es", "ee", "be"]
    stats = [
        {
            "statisticType": "sum",
            "onStatisticField": key,
            "outStatisticFieldName": "sum_" + key,
        }
        for key in fields
    ]
    stats.append(
        {
            "statisticType": "count",
            "onStatisticField": "objectid",
            "outStatisticFieldName": "records",
        }
    )
    urls["drpep/forecast-by-year.json"] = query(
        f"{DRP}/GNA_Layer/FeatureServer/3/query",
        where="1=1",
        groupByFieldsForStatistics="year_value",
        orderByFields="year_value",
        outStatistics=json.dumps(stats),
        returnGeometry="false",
        f="json",
    )
    urls["drpep/upgrades-by-service.json"] = query(
        f"{DRP}/DUPR_Layer/FeatureServer/0/query",
        where="1=1",
        groupByFieldsForStatistics="grid_need",
        outStatistics=json.dumps([stats[-1]]),
        returnGeometry="false",
        f="json",
    )
    cooling_ids = sorted(
        inspect(
            "cooling/ids.json",
            query(COOLING + "/query", where="1=1", returnIdsOnly="true", f="json"),
        )["objectIds"]
    )
    for offset in range(0, len(cooling_ids), 500):
        batch = cooling_ids[offset : offset + 500]
        urls[f"cooling/sites-{offset:05}.json"] = query(
            COOLING + "/query",
            where=f"OBJECTID BETWEEN {batch[0]} AND {batch[-1]}",
            outFields="OBJECTID,CoolCenterName,Street,City,ZipCode,HRSOPERATE",
            outSR=4326,
            returnGeometry="true",
            f="json",
        )
    for kind in ("Owners", "Renters"):
        dataset = "HousingAssistance" + kind
        options = {
            "$filter": "state eq 'CA'",
            "$select": "id,disasterNumber,zipCode,validRegistrations,approvedForFemaAssistance",
            "$orderby": "id",
        }
        info = inspect(
            f"fema/{kind}-count.json",
            query(FEMA + dataset, **options, **{"$count": "true", "$top": 1}),
        )
        for offset in range(0, int(info["metadata"]["count"]), 1000):
            urls[f"fema/{kind}/{offset:05}.json"] = query(
                FEMA + dataset, **options, **{"$top": 1000, "$skip": offset}
            )
    urls["fema/ca-major.json"] = query(
        FEMA + "DisasterDeclarationsSummaries",
        **{
            "$filter": "state eq 'CA' and declarationType eq 'DR' and incidentType ne 'Biological' and declarationDate ge '2000-01-01T00:00:00.000Z'",
            "$select": "disasterNumber,declarationDate",
            "$top": 10000,
            "$count": "true",
        },
    )
    return urls


def reports():
    planning = []
    for service in raw("drpep/services.json")["services"]:
        name = service["name"].split("/")[-1]
        data = raw(f"drpep/{name}.json")
        pages = data.get("layers", []) + data.get("tables", [])
        planning.append(
            {
                "name": name,
                "layers": [
                    {
                        "name": p["name"],
                        "id": p["id"],
                        "count": raw(f"drpep/counts/{name}-{p['id']}.json")["count"],
                    }
                    for p in pages
                ],
            }
        )
    forecast = [r["attributes"] for r in raw("drpep/forecast-by-year.json")["features"]]
    upgrades = [
        r["attributes"] for r in raw("drpep/upgrades-by-service.json")["features"]
    ]
    if (
        sum(r["records"] for r in forecast)
        != raw("drpep/counts/GNA_Layer-3.json")["count"]
        or sum(r["records"] for r in upgrades)
        != raw("drpep/counts/DUPR_Layer-0.json")["count"]
    ):
        raise ValueError("Incomplete planning summary")
    return {
        "planning": planning,
        "forecast": forecast,
        "upgrades": upgrades,
        "additional": territory_reports(),
    }
