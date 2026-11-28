const SCE =
  "https://drpep.sce.com/arcgis_server/rest/services/Hosted/ICA_Layer/FeatureServer/17";
export const direct = {
  drpepStations: [
    "DRPEP substation inventory", "Southern California Edison", "November 27, 2026",
    "https://drpep.sce.com/drpep/?page=Page",
    "The project counts distinct SCE inventory records inside each 12-mile reporting area. An independent query of the original service-territory polygons verifies the total. A symbol marks the reporting area’s anchor.",
  ],
  evPermits: [
    "EV Charging Station Permit Streamlining Map", "California Governor’s Office of Business and Economic Development",
    "DRPEP map snapshot · November 27, 2026", "https://business.ca.gov/industries/zero-emission-vehicles/plug-in-readiness/",
    "Each jurisdiction supplies a permitting status and can publish an ordinance, checklist, adoption date and scorecard criteria. The atlas intersects these boundaries with each hex and gives incorporated cities precedence over county polygons.",
  ],
  drpepPublicFire: [
    "Public fire polygons displayed in DRPEP", "Southern California Edison", "November 27, 2026",
    "https://drpep.sce.com/arcgis_portal/home/item.html?id=cd4865e42c154dfc9b52c024314c3263",
    "SCE’s web map uses the public tree mortality view and the elevated and extreme filters of its high-fire-risk area view. Percentages use the part of each hex inside SCE.",
  ],
  militaryLand: [
    "Military installation land boundaries", "U.S. Census Bureau", "TIGER/Line 2025",
    "https://www2.census.gov/geo/tiger/TIGER2025/MIL/",
    "Published military polygons intersected with SCE and its one-mile hexes. A military designation identifies the land use.",
  ],
  protectedAccess: [
    "California Protected Areas Database · Public access", "GreenInfo Network", "CPAD 2026a · Units",
    "https://calands.org/cpad/",
    "The overlay includes Restricted Access and No Public Access units within SCE. Map outlines are generalized. Hex shares use the source polygons, dissolved within each access class.",
  ],
  lodes: [
    "LEHD Origin-Destination Employment Statistics",
    "U.S. Census Bureau",
    "2024 jobs · 2020 workplace blocks",
    "https://lehd.ces.census.gov/data/lodes/LODES8/ca/wac/",
    "Workplace Area Characteristics all-job counts for 20 NAICS sectors, summed by source block group. Census disclosure protection applies. Boundary block groups retain their full published workplace totals.",
  ],
  drpepProjects: [
    "DRPEP approved transmission project study areas",
    "Southern California Edison",
    "November 27, 2026",
    "https://drpep.sce.com/drpep/?page=Page",
    "CAISO, utility and CPUC study-area polygons intersected with clipped one-mile hexes. The Almanac includes the public DRPEP service and layer inventory.",
  ],
  drpepFire: [
    "DRPEP tree mortality and fire districts",
    "Southern California Edison",
    "November 27, 2026",
    "https://drpep.sce.com/arcgis_server/rest/services/Hosted/Firemap/FeatureServer",
    "SCE publishes the CPUC district polygons and a separate tree-mortality layer. The wildfire map partitions each clipped hex into Tier 3, Tier 2 and outside both. Tier 3 takes priority in overlaps. The color follows the largest area before rounding.",
  ],
  drpepGrowth: [
    "Load Growth Penetration Heat Map",
    "Southern California Edison",
    "November 27, 2026",
    "https://drpep.sce.com/arcgis_server/rest/services/Hosted/LOAD_GROWTH_PEN_HTMAP/FeatureServer/0",
    "Public planning polygons classified by circuit total load growth. Each clipped hex reports its dominant published band and the percentage covered.",
  ],
  drpepCapacity: [
    "Available Load Capacity Heat Map",
    "Southern California Edison",
    "November 27, 2026",
    "https://drpep.sce.com/arcgis_server/rest/services/Hosted/AVL_LOAD_HEAT_MAP_TOGGLE/FeatureServer",
    "Area-based planning bands for full submittals and for full plus partial submittals. Each scenario is intersected independently with the one-mile map.",
  ],
  sceCooling: [
    "Cooling-center locations",
    "Southern California Edison",
    "November 27, 2026",
    "https://www.sce.com/outages-safety/outage-center/check-outage-status",
    "SCE’s public cooling-center directory provides names, addresses, hours and facility points. Each point inside the service boundary is counted once in its one-mile hex.",
  ],
  zbp: [
    "ZIP Business Patterns",
    "U.S. Census Bureau",
    "2023 reporting ZIPs",
    "https://www.census.gov/programs-surveys/cbp/data/datasets.html",
    "Total employer establishments and religious organizations with employees (NAICS 813110). Missing observations are displayed as no data.",
  ],
  femaZip: [
    "OpenFEMA housing assistance for owners and renters",
    "Federal Emergency Management Agency",
    "Accessed November 27, 2026",
    "https://www.fema.gov/about/openfema/data-sets",
    "Owner and renter housing assistance records joined to California major disaster declarations since 2000, excluding biological incidents. Count distinct qualifying disasters per ZIP with valid registrations. The Almanac retains the original county designation counts.",
  ],
  tractWellbeing: [
    "California tract health and wellbeing index",
    "Atlas calculation from CDC PLACES",
    "2025 release · California tract benchmark",
    "https://data.cdc.gov/500-Cities-Places/PLACES-Census-Tract-Data-GIS-Friendly-Format-2025-/yjkw-uj5s",
    "Uses unweighted California tract means and population-standard-deviation z-scores of four crude adult prevalence estimates. USACiv’s national, age-adjusted county score is preserved in the Almanac.",
  ],
  cdcLoneliness: [
    "PLACES adult loneliness",
    "Centers for Disease Control and Prevention",
    "2025 release · tract estimates",
    "https://www.cdc.gov/places/measure-definitions/health-related-social-needs.html",
    "Crude modeled prevalence among adults. Missing source estimates remain blank.",
  ],
  boundary: [
    "Edison service territory",
    "Southern California Edison",
    "Geometry retrieved November 27, 2026",
    SCE,
    "The complete published boundary, including separate pieces, islands and interior exclusions. The source is a planning geography.",
  ],
  terrain: [
    "Terrain Tiles and NLCD land cover",
    "Mapzen · USGS · MRLC",
    "Terrain retrieved November 27, 2026 · NLCD 2021",
    "https://registry.opendata.aws/terrain-tiles/",
    "Bare-earth elevation from zoom-8 Terrarium tiles, about 0.5 km locally. NLCD 30 m classes are nearest-neighbor resampled to 250 m, then read at each sample.",
  ],
  nlcdLocal: [
    "National Land Cover Database",
    "USGS / MRLC",
    "2021 · 30 m native",
    "https://doi.org/10.5066/P9JZ7AO3",
    "The tile land-cover class drives the terrain artwork. Forest, farmland and developed percentages use the valid centers of 250 m nearest-neighbor samples within each clipped hex. The Almanac retains the original county figures.",
  ],
  prism: [
    "PRISM climate normals",
    "PRISM Group, Oregon State University",
    "1991–2020 · accessed November 27, 2026",
    "https://prism.oregonstate.edu/",
    "July highs, January lows and annual precipitation use the 4 km dataset. Annual total shortwave radiation on a horizontal surface uses the 800 m dataset. Solar energy is converted from MJ to kWh by dividing by 3.6.",
  ],
  fire: [
    "CPUC Fire-Threat Map",
    "California Public Utilities Commission",
    "Version 3, revised August 19, 2021",
    "https://www.cpuc.ca.gov/industries-and-topics/wildfires/fire-threat-maps-and-fire-safety-rulemaking",
    "The CPUC defines the elevated and extreme utility wildfire districts. The GIS archive preserves the original CPUC point lookup alongside the area-based map classification. Tree-mortality Zone 1 has a separate lens.",
  ],
  acs: [
    "American Community Survey",
    "U.S. Census Bureau",
    "2020–2024 five-year estimates",
    "https://www.census.gov/programs-surveys/acs/data/summary-file.html",
    "Block-group and tract estimates from the five-year summary files. The map uses the smallest available geography supplying every term of a measure, with each tile assigned by its sample point. The inspector gives the source geography ID. Unavailable estimates remain blank.",
  ],
  acsHome: [
    "Median value of owner-occupied homes · B25077",
    "U.S. Census Bureau",
    "2020–2024 ACS · 2024 dollars · 90% margins of error",
    "https://data.census.gov/table/ACSDT5Y2024.B25077",
    "Unweighted publisher median for the source block group. Open-ended medians are displayed with their bounds. Block groups with an unpublished estimate are shown as no data.",
  ],
  sceZip: [
    "Quarterly customer electricity use by ZIP and class",
    "Southern California Edison",
    "July–September 2026 · Q3",
    "https://www.sce.com/regulatory/regulatory-information/energy-data-reports-compliances",
    "The map sums only numeric rows marked separately reported (Combined=N). A quarterly subtotal requires observations in all three months. A class metric requires three months for that class. USPS ZIPs are matched by code to Census ZCTAs for mapping.",
  ],
  zipCharging: [
    "Public ports and registered plug-ins by ZIP",
    "U.S. DOE AFDC and California Energy Commission / DMV",
    "November 2026 ports · December 2025 vehicles",
    "https://www.energy.ca.gov/files/zev-and-infrastructure-stats-data",
    "The CEC ZIP worksheet supplies the registered-vehicle denominator. AFDC public ports are counted by station mailing ZIP across California. Both totals use the complete ZIP. See the Alternative Fueling Station Locator entry for the port inventory.",
  ],
  cdcTract: [
    "PLACES census tract estimates · GIS-friendly release",
    "Centers for Disease Control and Prevention",
    "2025 release · 2023 BRFSS · 2023 tract boundaries",
    "https://data.cdc.gov/500-Cities-Places/PLACES-Census-Tract-Data-GIS-Friendly-Format-2025-/yjkw-uj5s",
    "Four adult health measures are crude model-based prevalence percentages for the source tract. CDC publishes the underlying measures at tract level. The original county wellbeing index has a different method.",
  ],
  zcta: [
    "ZIP Code Tabulation Areas",
    "U.S. Census Bureau",
    "2020 ZCTA geography · 1:500,000 cartography",
    "https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html",
    "Census polygons approximate postal ZIP service areas. Some mailing ZIPs have no corresponding polygon. Mapped values retain the reporting ZIP’s full totals, even where its polygon crosses SCE.",
  ],
  ces: [
    "CalEnviroScreen 4.0",
    "California OEHHA",
    "4.0 results · 2010 census geography",
    "https://oehha.ca.gov/calenviroscreen/report/calenviroscreen-40",
    "The statewide percentile of the tract that contains the sample. Screen scores use the original 2010 tract boundaries independently of the 2024 ACS joins.",
  ],
  cec: [
    "California Electricity Consumption",
    "California Energy Commission",
    "2024 reporting year · updated January 27, 2026",
    "https://www.energy.ca.gov/files/energy-consumption-data-files",
    "QFER county and agency workbooks. County values include all providers. The utility profile selects the Southern California Edison Company agency row across sectors and excludes the separate planning-area self-generation row. Retrieved November 27, 2026.",
  ],
  vehicles: [
    "Light-duty vehicle population",
    "California Energy Commission / DMV",
    "December 31, 2025",
    "https://www.energy.ca.gov/files/zev-and-infrastructure-stats-data",
    "The map uses the ZIP worksheet, December 2025. The county report uses the separate county worksheet. Plug-in totals include battery electric and plug-in hybrid registrations. The denominator is every light-duty vehicle in the same reporting geography.",
  ],
  chargers: [
    "California EV charger inventory",
    "California Energy Commission",
    "June 30, 2026 · workbook updated October 15",
    "https://www.energy.ca.gov/files/zev-and-infrastructure-stats-data",
    "The July 2026 sheet gives county counts by access and charging level. Public ports are summed across Level 1, Level 2 and DC fast.",
  ],
  afdc: [
    "Alternative Fueling Station Locator",
    "U.S. Department of Energy · Alternative Fuels Data Center",
    "Public EV charging inventory · November 27, 2026",
    "https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/all/",
    "The utility layer includes California stations listed as public and available in the AFDC inventory whose reported coordinates fall within the Edison boundary. Ports are the reported Level 1, Level 2 and DC fast equipment counts. Availability is the station’s inventory status. This snapshot has no live port occupancy.",
  ],
  eia860: [
    "Monthly generator inventory",
    "U.S. Energy Information Administration",
    "Form EIA-860M · October 2026",
    "https://www.eia.gov/electricity/data/eia860m/",
    "The utility overlay and five capacity lenses select operating (OP) units at EIA-reporting plants inside the SCE boundary across all owners. The capacity lenses use 12-mile reporting areas. County Almanac tables retain their original whole-county inventory.",
  ],
  eia861: [
    "Annual electric power industry report",
    "U.S. Energy Information Administration",
    "Form EIA-861 · 2025",
    "https://www.eia.gov/electricity/data/eia861/",
    "Utility 17609, California. Peaks from Operational Data, PV from Net Metering and IEEE reliability measures from Reliability. The customer count is the population in the reliability report.",
  ],
  census: [
    "Census geography and roads",
    "U.S. Census Bureau",
    "2024 Cartographic Boundaries, Gazetteer and TIGER/Line",
    "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
    "County and tract boundaries, city and CDP internal points, and California primary and secondary highways. Place population describes the entire place.",
  ],
  natural: [
    "Natural Earth physical and transport geography",
    "Natural Earth",
    "1:10 million public-domain cartography",
    "https://www.naturalearthdata.com/downloads/10m-physical-vectors/",
    "Land, major lakes and rivers, and generalized rail corridors provide context around the territory.",
  ],
  parks: [
    "National parks and historic landmarks",
    "National Park Service",
    "Public GIS extracts · November 27, 2026",
    "https://www.nps.gov/subjects/gisandmapping/index.htm",
    "California NPS units intersecting the boundary and National Historic Landmark point records inside it. Some register locations have polygon records only.",
  ],
  usaciv: [
    "USACiv regional reference data",
    "Andrej Karpathy and the cited publishers",
    "Reference snapshot · November 2026",
    "https://karpathy.ai/usaciv/",
    "County indicators, metropolitan profiles and regional or California summaries retain the geography, dates and definitions of the published USACiv tables.",
  ],
};
export const coverage = {
  acs_1yr: "Metro yields, jobs, demographic composition and housing.",
  acs_5yr:
    "Block groups for housing and most demographic lenses. Commute and foreign-born share use tracts. Original county context is retained in reports.",
  bea_gdp: "Metro GDP and industry breakdowns.",
  bls_qcew: "County and metro industry specializations.",
  cbsa_delineation: "County membership for metro reports.",
  cdc_places:
    "Four tract-level health measures and the reference county wellbeing index.",
  census_boundaries:
    "2024 block groups, tracts and counties, 2023 PLACES tracts and 2020 Census ZCTAs.",
  census_gazetteer: "Searchable Census places, including smaller communities.",
  dmdc_personnel: "California personnel aggregates in the state report.",
  eia_860m:
    "Operating capacity in 12-mile areas inside SCE. County reports retain their county inventory.",
  eia_coal:
    "California reference summary. The national selection contains no qualifying California coal mine.",
  eia_shale_plays:
    "State summary of plays represented in USACiv. Individual play geography is omitted.",
  etopo: "Replaced by finer Mapzen elevation tiles for this one-mile grid.",
  faa_airports: "Regional airport traffic and cargo in the transport report.",
  faf5: "Regional freight-zone totals and top trading partners.",
  fema_declarations:
    "County declaration counts, categories and most recent dates.",
  herd: "Research spending at the selected regional universities.",
  ipeds: "Enrollment for USACiv’s selected regional universities.",
  mirta:
    "California count of installations represented in the reference inventory.",
  msha_mines:
    "California aggregate of the reference map’s qualifying mineral resources.",
  natural_earth: "Rebuilt locally for rail, water and land geography.",
  natural_earth_roads: "Replaced by Census TIGER/Line California highways.",
  nhl_landmarks:
    "Public National Historic Landmark point records in the territory.",
  nlcd: "Land-cover shares from raster samples in clipped one-mile hexes.",
  noaa_billions:
    "California disaster counts and costs through the final 2024 release.",
  nps_boundaries: "NPS unit outlines intersecting the SCE boundary.",
  nps_visits: "Visits at regional parks selected by the original map.",
  oldcc_spending: "California defense spending in the state report.",
  pep_population: "Metro population time series and growth.",
  usace_ports: "Regional port tonnage, imports and exports.",
  usrc_2020:
    "Derived county adherence and tradition indicators, credited to ASARB and ARDA.",
};
export function sourceFor(id, reg) {
  if (direct[id]) return direct[id];
  const s = reg.referenceSources.find((s) => s.id === id);
  return s
    ? [s.title, s.publisher, s.vintage, s.homepage, coverage[id]]
    : direct.usaciv;
}
