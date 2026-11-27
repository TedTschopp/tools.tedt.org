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
