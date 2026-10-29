#!/usr/bin/env python3
"""Prepare the separately checked-out TedT.org repository; does not publish it."""
from pathlib import Path
import json
import re
import shutil
import subprocess
import sys

root = Path(sys.argv[1]).resolve()
if not (root/'.git').exists(): raise SystemExit('Expected an isolated Git worktree.')
status = subprocess.check_output(['git','-C',str(root),'status','--porcelain'],text=True)
if status: raise SystemExit('Cutover worktree must start clean.')
deleted = ['tools','_tools','_apps/inside-ai','inside-ai','game-theory','math-guide','js/game-theory','_includes/game-theory','_layouts/game-theory.html','_layouts/inside-ai.html','_layouts/tool.html','_data/game_theory.yml','RPG/world-map.html','RPG/tile-map-viewer.html','tests/game-theory','tests/social-bot-check','tests/quick-study-painter','tests/inside-ai','tests/check_tools_css_sync.rb','_code/cloudflare/social-bot-check-preview','.github/workflows/social-bot-check-preview.yml','scripts/check-inside-ai-build.mjs','scripts/prepare-inside-ai-model.mjs','playwright.inside-ai.config.ts']
for name in deleted:
 p=root/name
 if p.is_dir(): shutil.rmtree(p)
 elif p.exists(): p.unlink()

routes = json.loads((Path(__file__).resolve().parents[1]/'reports/migration-routes.json').read_text())
docs = {r['from']:r['to'] for r in routes['catalogRedirects']}
def moved(p):
 if p in docs: return 'https://tools.tedt.org'+docs[p]
 if p in ['/tools','/tools/','/tools/index.html']: return 'https://tools.tedt.org/'
 if p.startswith('/tools/'): return 'https://tools.tedt.org/'+p[7:]
 if p.startswith(('/inside-ai/','/game-theory/','/math-guide/')) or p in ['/RPG/world-map.html','/RPG/tile-map-viewer.html']: return 'https://tools.tedt.org'+p
 return p
changed=[]
for folder in ['_includes','_layouts','_posts','_pages','_projects']:
 p=root/folder
 if not p.exists(): continue
 for f in p.rglob('*'):
  if not f.is_file() or f.suffix not in ['.html','.md','.markdown']: continue
  s=f.read_text(); original=s
  s=re.sub(r"{{\s*(['\"])(/[^'\"]+)\1\s*\|\s*(?:relative_url|absolute_url)\s*}}",lambda m:moved(m[2]) if moved(m[2])!=m[2] else m[0],s)
  s=re.sub(r'{{\s*site.url\s*}}{%\s*link\s+(tools/[^%]+)\s*%}',lambda m:moved('/'+m[1].strip()),s)
  s=re.sub(r'{%\s*link\s+(tools/[^%]+)\s*%}',lambda m:moved('/'+m[1].strip()),s)
  s=re.sub(r'https://tedt\.org(/(?:tools|inside-ai|game-theory|math-guide)/[^\s\"\'<>\)\}]*|/RPG/(?:world-map|tile-map-viewer)\.html)',lambda m:moved(m[1]),s)
  s=re.sub(r'(?<=["\'(])(/(?:tools|inside-ai|game-theory|math-guide)/[^\s\"\'<>\)\}]*|/RPG/(?:world-map|tile-map-viewer)\.html)',lambda m:moved(m[1]),s)
  if s!=original: f.write_text(s); changed.append(str(f.relative_to(root)))

p=root/'_config.yml';s=p.read_text();s=re.sub(r'^  tools:\n(?:    .*\n)+','',s,flags=re.M);s=s.replace('# Inside AI source and dependencies are compiled into inside-ai/assets before Jekyll.\n','').replace('# Keep the Game Theory planning roadmap out of the generated website.\n- game-theory/NEXT-STEPS.md\n','');p.write_text(s)
p=root/'.github/workflows/deploy.yml';s=p.read_text();s=re.sub(r'      - name: Tools CSS sync guard\n        run: \|\n          make tools_css_sync_check\n\n','',s);p.write_text(s)
p=root/'Makefile';s=p.read_text().replace(' tools_css_sync_check','');s=s.replace('tools_css_sync_check:\n\truby tests/check_tools_css_sync.rb\n\n','');p.write_text(s)
p=root/'package.json';data=json.loads(p.read_text());data['scripts']={k:v for k,v in data['scripts'].items() if not any(x in k for x in ['inside-ai','test:painter','test:game-theory'])};p.write_text(json.dumps(data,indent=2)+'\n')
p=root/'README.md';s=p.read_text();notice='\n> **Tools have moved:** [tools.tedt.org](https://tools.tedt.org/) is the maintained home for the browser tools, catalog, and related learning applications. Source and build instructions are in [TedTschopp/tools.tedt.org](https://github.com/TedTschopp/tools.tedt.org). Traveller tools remain in this repository.\n';s=re.sub(r'(^# [^\n]+\n)',r'\1'+notice,s,count=1);p.write_text(s)
report={'deletedPaths':deleted,'updatedReferences':changed,'retained':['RPG/Traveller/','shared CSS, fonts, images, and RPG support dependencies'],'destination':'https://tools.tedt.org/'}
(Path(__file__).resolve().parents[1]/'reports/cutover-preparation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'removedRoots':len(deleted),'updatedReferenceFiles':changed}))
