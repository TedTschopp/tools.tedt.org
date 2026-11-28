"""Vendor the USACiv Canvas art and its imports from the cached MIT source release."""

import posixpath
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

BUILDER = Path(__file__).resolve().parent
ROOT = BUILDER.parents[1]
SOURCE = BUILDER / ".cache/raw/usaciv-source.zip"
TARGET = ROOT / "tool-src/tools/edison-atlas/js/usaciv"
ENTRIES = [
    "render/art/people.js",
    "ext/cityView/charts.js",
    "render/banners.js",
    "ui/infoPanel.js",
    "render/art/terrain.js",
    "render/art/improvements.js",
    "render/art/water.js",
    "render/art/sites.js",
]


def replace(source, before, after):
    if source.count(before) != 1:
        raise ValueError(f"USACiv artwork changed around {before!r}")
    return source.replace(before, after)


def adapt(name, source):
    # Keep the original painters. Their US-wide defaults need three local inputs:
    # geographic coordinates, settlement drawing scale and the regional banner filter.
    if name == "icons.js":
        # Add utility symbols to the original resource medallion palette.
        source = replace(
            source,
            "  // ---- resources (extraction)",
            """  'r-ev-charging': {
    bg: '#236f78',
    paths: [
      F(rrect(3, 3, 11.3, 17.1, 1.7) + rrect(5.2, 5.1, 6.9, 4.4, .7)),
      T(rrect(2, 20, 13.2, 1.7, .55)),
      S('M13.8 11h1.1c2 0 1.6 2 1.6 3.4v1.9c0 2 3.4 2.3 3.4-.3V9.8', 1.7),
      F('M17.5 6.8h4.3v2c0 2.7-4.3 2.7-4.3 0Z'), S('M18.4 6.6V4.8m2.5 1.8V4.8', 1.1),
      D('m9.6 11.1-2.8 3.6h2l-.9 3.2 3.1-4.7h-2.1Z', 1),
    ],
  },
  'r-substation': {
    bg: '#285868',
    paths: [
      F(rrect(4,10,16,9.5,1.6)), T(rrect(3,20.1,18,1.6,.5)),
      S('M7 10V3.6m5 6.4V2.6m5 7.4V3.6',1.5),
      S('M5.5 5.7h3m-3 2.1h3m2-3.2h3m-3 2.2h3m2-1.1h3m-3 2.1h3',1.15),
      D('M7 12.2v5.3m3.3-5.3v5.3m3.4-5.3v5.3m3.3-5.3v5.3',1),
    ],
  },
  // ---- resources (extraction)""",
        )
    if name == "render/art/terrain.js":
        source = replace(
            source,
            "function geo(w, i) {",
            "function geo(w, i) {\n  if (w.geography) return w.geography;",
        )
    if name == "render/art/city.js":
        source = replace(
            source,
            "export const cityIsDot = (city, Rpx) =>\n",
            "export const cityIsDot = (city, Rpx) =>\n"
            "  city.minTileRpx != null ? Rpx < city.minTileRpx :\n",
        )
        source = replace(
            source,
            "const cls = cityClass(city.population);",
            "const cls = city.artClass ?? cityClass(city.population);",
        )
        source = replace(
            source,
            "${cityClass(city.population).id}",
            "${(city.artClass ?? cityClass(city.population)).id}",
        )
    if name == "render/banners.js":
        source = replace(source, "let tiered = showYields &&", "const rich = showYields || (state.metroYields && city.metroId);\n    let tiered = rich &&")
        source = replace(source, "const badge0 = badges && showYields", "const badge0 = badges && rich")
        source = replace(source, "h: height + tab, city, specialty:", "h: height + tab, plateTop: y, yieldTop: tiered ? y + L.h - 2 : null, city, specialty:")
        source = replace(
            source,
            "const minPop = popFloor(Rpx);",
            "const minPop = state.minBannerPopulation ?? popFloor(Rpx);",
        )
        source = replace(
            source,
            "const pop = popShort(city.population);",
            "const pop = city.populationLabel ?? popShort(city.population);",
        )
        source = replace(
            source,
            "const m = measure(ctx, city, yields, nation, L);",
            "const m = measure(ctx, city, city.bannerFields ?? yields, nation, L);",
        )
        source = replace(
            source,
            "const t = compact(city.yields?.[yd.key]);",
            "const value = city.yields?.[yd.key];\n"
            "    const t = yd.format ? yd.format(value) : compact(value);",
        )
    return source


def main():
    done = set()
    pending = ENTRIES.copy()
    with tempfile.TemporaryDirectory() as directory, zipfile.ZipFile(SOURCE) as archive:
        staging = Path(directory)
        while pending:
            name = pending.pop()
            if name in done:
                continue
            source = adapt(name, archive.read("usaciv/web/js/" + name).decode())
            for ref in re.findall(
                r"""^import\s+[^;]+?\sfrom\s+["']([^"']+)["']""", source, re.MULTILINE
            ):
                pending.append(
                    posixpath.normpath(posixpath.join(posixpath.dirname(name), ref))
                )
            dest = staging / name
            dest.parent.mkdir(exist_ok=True, parents=True)
            dest.write_text(source)
            done.add(name)
        # Apply the atlas renderer changes before updating the vendored files.
        patch = BUILDER / "usaciv-terrain.patch"
        subprocess.run(["patch", "-s", "-p1", "-i", str(patch)], cwd=staging, check=True)
        for name in sorted(done):
            dest = TARGET / name
            dest.parent.mkdir(exist_ok=True, parents=True)
            dest.write_bytes((staging / name).read_bytes())
    print(f"{len(done)} licensed USACiv modules in {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
