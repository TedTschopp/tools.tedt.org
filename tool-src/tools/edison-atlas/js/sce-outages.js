export const outageLabels = {
  current: "Reported outages",
  scheduled: "Scheduled outages",
  cooling: "Cooling centers",
  centers: "Community resource centers",
  vehicles: "Community crew vehicles",
  food: "Food banks",
  hotels: "Hotel assistance",
  charging: "Outage Center EV stations",
};

export function publisherTime(timestamp) {
  const value = new Date(timestamp.replace(" ", "T") + "Z");
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(value);
}

const incidents =
  "https://services.arcgis.com/BLN4oKB0N1YSgvY8/arcgis/rest/services/Power_Outages_(View)/FeatureServer/0/query";

// Rebuild the Census polygon for an ArcGIS spatial statistics query. The server returns totals only.
function zipRings(encoded) {
  return encoded[4].map((ring) => {
    let x = ring[0],
      y = ring[1];
    const coordinates = [[x * 1.609344, -y * 1.609344]];
    for (let i = 2; i < ring.length; i += 2) {
      x += ring[i];
      y += ring[i + 1];
      coordinates.push([x * 1.609344, -y * 1.609344]);
    }
    coordinates.push(coordinates[0]);
    return coordinates;
  });
}

export async function currentImpact(m, postal) {
  const stats = [
    {
      statisticType: "count",
      onStatisticField: "OBJECTID",
      outStatisticFieldName: "incidents",
    },
    {
      statisticType: "sum",
      onStatisticField: "ImpactedCustomers",
      outStatisticFieldName: "customers",
    },
  ];
  const params = new URLSearchParams({
    where: "UtilityCompany = 'SCE' AND OutageStatus = 'Active'",
    outStatistics: JSON.stringify(stats),
    returnGeometry: "false",
    f: "json",
  });
  if (postal) {
    const i = m.local.tables.zcta.rows.findIndex((r) => r[0] === postal);
    if (i < 0) throw new Error("Choose a ZIP listed in the atlas.");
    params.set("geometryType", "esriGeometryPolygon");
    params.set("spatialRel", "esriSpatialRelIntersects");
    params.set("inSR", "3310");
    params.set(
      "geometry",
      JSON.stringify({
        rings: zipRings(m.outlines.zcta[i]),
        spatialReference: { wkid: 3310 },
      }),
    );
  }
  const response = await fetch(incidents, {
    method: "POST",
    body: params,
    credentials: "omit",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("Cal OES returned HTTP " + response.status);
  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  const record = result.features?.[0]?.attributes;
  if (
    !Number.isInteger(record?.incidents) ||
    record.incidents < 0 ||
    (record.incidents && !Number.isFinite(record.customers))
  )
    throw new Error("Cal OES returned an incomplete total.");
  return { count: record.incidents, customers: record.customers ?? 0 };
}
