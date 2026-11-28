# Edison Atlas data builder

These scripts generate the [browser data and GIS download](../../tool-src/tools/edison-atlas/data) from public source files. The [map application](../../tool-src/tools/edison-atlas) reads the generated files directly. The catalog build also produces the standalone offline edition.

## Build from the repository root

Use Python 3.11 or later. The first fetch downloads statewide source files into the builder’s local cache. The published input manifest records each URL and SHA-256. If a publisher has replaced a file since the release, the fetch reports the mismatch.

```sh
python3 -m venv scripts/edison-atlas/.venv
scripts/edison-atlas/.venv/bin/python -m pip install -r scripts/edison-atlas/requirements.txt
scripts/edison-atlas/.venv/bin/python scripts/edison-atlas/fetch.py
scripts/edison-atlas/.venv/bin/python scripts/edison-atlas/build.py
scripts/edison-atlas/.venv/bin/python scripts/edison-atlas/verify.py
npm run build
```

## Wildfire tier calculation

The builder clips each one-mile hex to SCE territory in the California Albers equal-area projection. It intersects that geometry with SCE’s published CPUC Tier 2 and Tier 3 polygons. Shared areas belong to Tier 3. The area outside both districts is a third class. The largest unrounded area determines the color of the hex. An exact tie goes to the higher tier. [Polygon intersections and classification](planning.py)

The inspector shows the three shares to hundredths of a percent. The builder assigns the last hundredths to the largest fractional remainders so each row totals 100%. The GIS fields are `cpuc_tier_dominant`, `cpuc_tier2_pct`, `cpuc_tier3_pct`, and `cpuc_outside_tiers_pct`. The earlier `cpuc_tier` field retains the point lookup. [GIS export](build.py) · [Independent checks](verify.py)

## Military land, protected-area access and place profiles

The access overlay combines Census TIGER/Line 2025 military land with the Restricted Access and No Public Access units in GreenInfo Network’s CPAD 2026a. The builder dissolves each class, intersects it with the service boundary in California Albers, and measures actual area inside each clipped hex. Different classes can overlap. The display uses a simplified union. In the GIS download, join the sparse table in `land-access.json` to the `tile` property of the one-mile GeoJSON. [Land-access and geography builder](civ_geography.py)

The same builder reads ACS 2020–2024 place estimates, including employment, household income, housing and electric heat. Place profiles use the Census place GEOID. Whole-metro profiles use the CBSA and USACiv’s national comparisons. [Census military boundaries](https://www2.census.gov/geo/tiger/TIGER2025/MIL/) · [California Protected Areas Database](https://calands.org/cpad/)
