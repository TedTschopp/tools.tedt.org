---
title: "Edison Atlas"
summary: "Explore Southern California Edison’s service territory one mile at a time. Map electricity use, neighborhood data, energy resources, outages, and grid planning."
status: active
tool_type: webapp
date: 2026-11-27
last_modified: 2026-11-27
featured: false
legacy_redirect: false
tags: [maps, energy, California, SCE, terrain, utilities, GIS, solar, wind, storage, EV charging]
links:
  live: "/tools/edison-atlas/"
hero_image: "/img/2026-11/edison-atlas-coast.webp"
image-alt: "Ventura and Oxnard along the Pacific coast, with farms, city banners, and mountain tiles on the illustrated hex map."
screenshots:
  - "/img/2026-11/edison-atlas-mojave.webp"
---

The map covers all 20 pieces of Southern California Edison’s published service territory, including Catalina Island. Each of its 61,985 hexes measures one mile between opposite sides. Search for a community or select a hex to inspect its data and sources.

## Explore the map

- Inspect a neighborhood’s estimated home value and its margin of error. Select **Block groups** in the legend to see the Census boundary. [Open the Orange County coast](/edison-atlas/#lens=home_value&x=109.5&y=293.583&z=28&layers=places,roads,water,grid,art&geography=source&geoid=060590995041)
- Compare solar farms, wind farms, battery storage, and public EV charging. Symbols cover all owners in the reporting area. [Explore the Mojave utility layer](/edison-atlas/#lens=terrain&x=108&y=207.846&z=12&layers=utility,places,roads,rail,water,grid,art&resource=solar@12:9,20)
- Browse SCE’s dated outage and community resource lists by city or ZIP. Check current customer impact through the California Governor’s Office of Emergency Services. [Open Outages](/edison-atlas/#report=outages)
- Explore approved project study areas, fire districts, and SCE’s annual distribution planning forecasts. [Open Grid planning](/edison-atlas/#report=planning)

The atlas includes 93 map lenses. ZIP, tract, and block-group estimates retain their source geography. The Almanac preserves the original county reports and explains the coverage of local religious surveys. [Explore religion sources](/edison-atlas/#report=religion)

## Downloads

[Download the offline atlas (ZIP)](/edison-atlas/Edison-Atlas-offline.zip). Extract the archive and open **Edison-Atlas.html** in a browser. The illustrated map, Almanac, source references, and GIS export travel together.

[Download the GIS data (ZIP)](/edison-atlas/data/SCE-one-mile-hexes.zip). Open the GeoJSON files in QGIS or ArcGIS. The archive includes clipped one-mile hexes, native reporting areas, and source tables from the November 27, 2026 snapshot.

Terrain, city artwork, banners, and map symbols use Andrej Karpathy’s USACiv graphics. The atlas credits each data publisher under **Sources**. [Original USACiv map](https://karpathy.ai/usaciv/) · [Artwork license](/edison-atlas/licenses/USACiv-MIT.txt)
