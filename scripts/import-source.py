#!/usr/bin/env python3
"""Import an explicit tedt.org commit. Run only for the initial migration."""
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
REPO = Path(sys.argv[1])
SHA = subprocess.check_output(['git', '-C', str(REPO), 'rev-parse', sys.argv[2]], text=True).strip()
tracked = set(subprocess.check_output(['git', '-C', str(REPO), 'ls-tree', '-r', '--name-only', SHA], text=True).splitlines())
prefixes = ['tools/', '_tools/', '_apps/inside-ai/', 'inside-ai/', 'game-theory/', 'math-guide/', 'js/', 'css/', '_sass/', 'fonts/', 'RPG/js/', '_includes/game-theory/', 'tests/game-theory/', 'tests/social-bot-check/', 'tests/quick-study-painter/', '_code/cloudflare/social-bot-check-preview/']
exact = {'_data/game_theory.yml', '_layouts/game-theory.html', '_layouts/inside-ai.html', '_includes/assets/mathjax.html', 'RPG/world-map.html', 'RPG/tile-map-viewer.html', 'favicon.ico', 'favicon-32.png', 'favicon-196.png', 'apple-touch-icon.png', 'LICENSE', 'LICENSE.md', 'LICENSE.txt'}
selected = {p for p in tracked if p in exact or any(p.startswith(x) for x in prefixes)}
selected |= {p for p in tracked if p.startswith(('img/game-theory/', 'img/inside-ai/'))}
selected = {p for p in selected if not any(x in p.split('/') for x in ['.DS_Store', 'node_modules', '.wrangler'])}
target = ROOT / 'tool-src'
if target.exists():
    raise SystemExit('tool-src already exists; initial import will not overwrite maintained tools.')
target.mkdir()
archive = subprocess.check_output(['git', '-C', str(REPO), 'archive', SHA, *sorted(selected)])
with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
    tar.extractall(target, filter='data')

# Copy images referenced by catalog records, scripts, or shared CSS. These files
# must be owned by this repository rather than hotlinked to the old tools tree.
image_refs = set()
for f in list(target.rglob('*')):
    if f.is_file() and f.suffix in {'.md', '.html', '.css', '.scss', '.js', '.mjs', '.yml', '.json'}:
        text = f.read_text(errors='replace')
        image_refs.update(unquote(m).split('?')[0] for m in re.findall(r'/img/[^\s\"\'<>\)\}\{]+', text))
for ref in sorted(image_refs):
    rel = ref.lstrip('/')
    if rel in tracked and rel not in selected:
        data = subprocess.check_output(['git', '-C', str(REPO), 'show', SHA + ':' + rel])
        dest = target / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        selected.add(rel)

worker_path = '_code/cloudflare/social-bot-check-preview'
shutil.move(str(target / worker_path), str(ROOT / 'worker'))
rollback = ROOT / 'reports/rollback'
rollback.mkdir(parents=True, exist_ok=True)
shutil.copyfile(ROOT / 'worker/wrangler.jsonc', rollback / 'previous-preview-wrangler.jsonc')
records = []
for rel in sorted(selected):
    dest = ('worker/' + rel[len(worker_path)+1:]) if rel.startswith(worker_path+'/') else 'tool-src/' + rel
    f = ROOT / dest
    if not f.is_file():
        continue
    kind = 'supporting-file'
    if rel.startswith('_tools/'):
        kind = 'catalog-record' if rel != '_tools/procedural-text-gen.md' else 'excluded-template'
    elif rel.endswith('.html') and rel.startswith(('tools/', 'game-theory/', 'math-guide/', 'inside-ai/', 'RPG/')):
        kind = 'migrated-page' if rel != 'tools/index.html' else 'replaced-catalog'
    records.append({'source': rel, 'destination': dest, 'disposition': kind, 'sha256': hashlib.sha256(f.read_bytes()).hexdigest(), 'bytes': f.stat().st_size})
manifest = {'repository': 'https://github.com/TedTschopp/tedt.org', 'commit': SHA, 'importedFiles': records,
    'retained': ['/RPG/Traveller/'], 'excluded': [{'path': 'tools/.DS_Store', 'reason': 'OS metadata'}, {'path': '_tools/procedural-text-gen.md', 'reason': 'unpublished catalog template'}]}
(ROOT/'reports/source-inventory.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps({'commit': SHA, 'files': len(records), 'MiB': round(sum(r['bytes'] for r in records)/1048576,2)}))
