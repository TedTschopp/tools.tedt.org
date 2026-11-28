"""Build the downloadable, self-contained Edison Atlas from the same files as the hosted map."""

import base64
import json
import mimetypes
import posixpath
import re
import sys
import zipfile
from pathlib import Path

WEB = Path(sys.argv[1])


def encoded(data):
    return base64.b64encode(data).decode("ascii")


def uri(mime, data):
    return f"data:{mime};base64," + encoded(data)


def main():
    index = (WEB / "index.html").read_text()
    css = (
        (WEB / "style.css")
        .read_text()
        .replace(
            "assets/open-sans.ttf",
            uri("font/ttf", (WEB / "assets/open-sans.ttf").read_bytes()),
        )
    )
    index = re.sub(
        r'<link rel="stylesheet" href="style.css"\s*/?>',
        lambda _: "<style>" + css + "</style>",
        index,
    )
    index = index.replace(
        '"assets/mark.svg"',
        '"' + uri("image/svg+xml", (WEB / "assets/mark.svg").read_bytes()) + '"',
    )
    files = {}
    for folder in ("data", "licenses"):
        for f in sorted((WEB / folder).iterdir()):
            if f.is_file() and not f.name.startswith("."):
                files[f.relative_to(WEB).as_posix()] = [
                    mimetypes.guess_type(f.name)[0] or "application/octet-stream",
                    encoded(f.read_bytes()),
                ]
    for name in ("terrain-art.png", "terrain-patterns-1x.png", "terrain-patterns-2x.png"):
        art = WEB / "assets" / name
        files["assets/" + name] = ["image/png", encoded(art.read_bytes())]
    worker_name = "js/terrain-painter.js"
    files[worker_name] = ["text/javascript", encoded((WEB / worker_name).read_bytes())]
    # An import map lets the same real ES modules execute from disk, without a build dependency.
    imports = {}
    js_root = WEB / "js"
    for js in sorted(js_root.rglob("*.js")):
        if js == WEB / worker_name:
            continue  # The classic worker uses its own realm, including on file URLs.
        key = js.relative_to(js_root).as_posix()

        def module_ref(match, parent=key):
            sibling = posixpath.normpath(
                posixpath.join(posixpath.dirname(parent), match[1])
            )
            if not (js_root / sibling).is_file():
                raise ValueError(f"Missing module imported by {parent}: {sibling}")
            return 'from "edison/' + sibling.removesuffix(".js") + '"'

        source = re.sub(
            r"""\bfrom\s+["'](\.{1,2}/[^"']+\.js)["']""", module_ref, js.read_text()
        )
        imports["edison/" + key.removesuffix(".js")] = uri(
            "text/javascript", source.encode()
        )
    bundle = (
        '<script type="application/json" id="atlas-files">'
        + json.dumps(files, separators=(",", ":"))
        + '</script><script type="importmap">'
        + json.dumps({"imports": imports}, separators=(",", ":"))
        + '</script><script type="module">import "edison/app";</script>'
    )
    entry = '<script type="module" src="js/app.js"></script>'
    assert entry in index
    out = Path(sys.argv[2])
    # Fix archive metadata so repeated builds of a snapshot are comparable.
    item = zipfile.ZipInfo("Edison-Atlas.html", (2026, 11, 27, 0, 0, 0))
    item.external_attr = 0o100644 << 16
    with zipfile.ZipFile(out, "w") as archive:
        archive.writestr(item, index.replace(entry, bundle).encode(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)
    print(f"Prepared {out.name} ({out.stat().st_size / 1024**2:.1f} MiB)")


if __name__ == "__main__":
    main()
