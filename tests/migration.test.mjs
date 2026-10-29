import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const routes=JSON.parse(await fs.readFile(new URL('../reports/migration-routes.json',import.meta.url),'utf8'));
test('every inventoried source file is present in a clean checkout',async()=>{
 const inventory=JSON.parse(await fs.readFile(new URL('../reports/source-inventory.json',import.meta.url),'utf8'));
 await Promise.all(inventory.importedFiles.map(async file=>{await fs.access(new URL('../'+file.destination,import.meta.url));}));
});
test('Traveller and external launch addresses remain at their original hosts',()=>{
 assert.ok(routes.retainedLaunchUrls.includes('https://tedt.org/RPG/Traveller/Character-Sheet.html'));
 assert.ok(routes.retainedLaunchUrls.includes('https://tedt.org/RPG/Traveller/Ship-Sheet.html'));
 assert.ok(routes.retainedLaunchUrls.includes('https://islands.tedt.org/'));
 assert.ok(routes.retainedLaunchUrls.includes('https://randomtables.tedt.org/'));
 assert.equal(routes.catalog.filter(t=>t.migrated&&t.launch.includes('/RPG/Traveller/')).length,0);
});
test('short URLs, descriptions, and related applications have complete destinations',()=>{
 assert.equal(routes.catalog.find(t=>t.slug==='morph').launch,'https://tools.tedt.org/morph.html');
 for(const p of ['/inside-ai/','/game-theory/','/math-guide/','/RPG/world-map.html','/RPG/tile-map-viewer.html'])assert.ok(routes.migratedPages.includes(p),p);
 assert.ok(routes.catalogRedirects.some(r=>r.from==='/tools/morph/'&&r.to==='/about/morph/'));
 assert.ok(routes.catalog.filter(t=>t.slug.startsWith('osr-tools-')).length>=42);
});
test('published catalog excludes the unpublished example record and has unique launch URLs',()=>{
 assert.ok(!routes.catalog.some(t=>t.launch.startsWith('https://example.com')));
 assert.equal(new Set(routes.catalog.map(t=>t.slug)).size,routes.catalog.length);
 assert.equal(new Set(routes.catalog.map(t=>t.launch)).size,routes.catalog.length);
});
test('the preview Worker is restricted to the new tool origin and source',async()=>{
 const source=await fs.readFile(new URL('../worker/src/worker.mjs',import.meta.url),'utf8');
 assert.ok(source.includes("const PAGE = 'https://tools.tedt.org/social-bot-check.html'"));
 assert.ok(source.includes('url.origin !== new URL(PAGE).origin'));
});
