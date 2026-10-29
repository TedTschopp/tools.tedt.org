import { routeHeaderAssets } from '../shared-header.mjs';
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const routes=JSON.parse(fs.readFileSync('reports/migration-routes.json','utf8'));
const origin=new URL(process.env.TOOLS_BASE_URL || 'http://127.0.0.1:4322').origin;
test('catalog search, filters, sorting, reset, and empty results',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Ted’s Tools',exact:true})).toBeVisible();
 const visible=page.locator('[data-tool-card]:not([hidden])');await expect(visible).toHaveCount(routes.catalog.length);
 await page.screenshot({path:'reports/catalog-desktop.png',fullPage:false});
 await page.locator('#search').fill('Morph — Text Transformer');await expect(visible).toHaveCount(1);await expect(visible).toContainText('Morph');
 await page.getByRole('button',{name:'Clear',exact:true}).click();await page.locator('#status').selectOption('prototype');await expect(visible.first()).toBeVisible();expect(await visible.count()).toBeGreaterThan(42);
 await page.getByRole('button',{name:'Reset filters'}).click();await expect(visible).toHaveCount(routes.catalog.length);
 await page.locator('#sort').selectOption('title');const titles=await visible.locator('h3').allTextContents();expect(titles).toEqual([...titles].sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase())));
 await page.locator('#search').fill('zqx-not-a-tool-9157');await expect(visible).toHaveCount(0);await expect(page.locator('[data-empty]')).toBeVisible();
});
test('themes, keyboard focus, external links, and mobile catalog',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Dark',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'Light',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.goto('/about/traveller-character-sheet/');await expect(page.locator('a.primary')).toHaveAttribute('href','https://tedt.org/RPG/Traveller/Character-Sheet.html');
 await page.setViewportSize({width:390,height:844});await page.goto('/');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.keyboard.press('Tab');await expect(page.locator('.skip-link')).toBeFocused();await page.getByRole('button',{name:'Toggle navigation'}).click();await expect(page.getByRole('button',{name:'System',exact:true})).toBeVisible();
 await page.screenshot({path:'reports/catalog-mobile.png',fullPage:false});
});
for(const url of [...new Set([...routes.migratedPages,...routes.catalog.filter(t=>t.migrated).map(t=>new URL(t.launch).pathname)])]){
 test(`tool loads ${url}`,async({page},info)=>{
  const failures:string[]=[];const errors:string[]=[];
  page.on('response',r=>{if(r.url().startsWith(origin+'/')&&r.status()>=400&&/\.(js|mjs|css|wasm|json|png|webp|svg)(\?|$)/.test(r.url()))failures.push(`${r.status()} ${r.url()}`);});
  page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(url,{waitUntil:'domcontentloaded'});expect(response?.status()).toBe(200);
  await page.waitForTimeout(250);expect((await page.title()).trim().length).toBeGreaterThan(0);
  await info.attach('runtime-observations',{body:JSON.stringify({url,errors,missingResources:failures},null,2),contentType:'application/json'});
  expect(failures,'local tool resources').toEqual([]);
 });
}
test('QR generation and download',async({page})=>{
 await page.goto('/qr-builder.html');await page.locator('#contentInput').fill('https://tools.tedt.org/');await page.locator('#renderBtn').click();await expect(page.locator('#qrTarget canvas:visible, #qrTarget img:visible')).toBeVisible();
});
test('Markdown editing and rich import export',async({page})=>{
 await page.goto('/markdown-frontmatter-preview.html');await page.locator('#sourceInput').fill('---\ntitle: Migration check\n---\n# Working preview\n\nLocal document.');await expect(page.locator('#markdownPreviewBody')).toContainText('Working preview');
 await page.locator('#richImportTab').click();await page.locator('#richImportInput').fill('<h1>Export check</h1><p>Local content.</p>');await expect(page.locator('#convertedMarkdownOutput')).toHaveValue(/Export check/);
 const download=page.waitForEvent('download');await page.locator('#downloadConvertedBtn').click();expect((await download).suggestedFilename()).toMatch(/\.md$/);
});
test('timer starts and pauses',async({page})=>{
 await page.goto('/focus-timer.html');await page.locator('#startPauseBtn').click();await expect(page.locator('#startPauseBtn')).toContainText('Pause');await page.locator('#startPauseBtn').click();await expect(page.locator('#startPauseBtn')).toContainText(/Resume|Start/);
});
test('game theory scenario initializes, changes, and shares',async({page})=>{
 await page.goto('/game-theory/trust-machine/');await expect(page.locator('#gt-loading')).toBeHidden();await expect(page.locator('#gt-reset')).toBeEnabled();await page.locator('#gt-share').click();await expect(page.locator('#gt-share-url')).toHaveValue(/trust-machine/);
});
test('Inside AI prepared explorer initializes without downloading a model',async({page})=>{
 await page.goto('/inside-ai/');await expect(page.locator('#inside-ai-load-error')).toBeHidden();await expect(page.locator('#inside-ai-explorer')).toBeVisible();
});
test('OCR recognizes and exports a local image',async({page})=>{
 test.setTimeout(120000);
 await page.setContent('<html><body style="margin:0;background:white"><div style="width:1000px;height:180px;padding:35px;font:60px Arial;color:black">TOOLS MIGRATION CHECK</div></body></html>');
 const image=await page.locator('div').screenshot();
 await page.goto('/ocr.html');await page.locator('#ocrFileInput').setInputFiles({name:'migration-check.png',mimeType:'image/png',buffer:image});
 await expect(page.locator('#ocrStatus')).toContainText('Completed OCR',{timeout:90000});await expect(page.locator('#ocrFullDocument')).toHaveValue(/TOOLS MIGRATION CHECK/);
 const download=page.waitForEvent('download');await page.locator('#ocrDownloadFullBtn').click();expect((await download).suggestedFilename()).toMatch(/\.txt$/);
});

test.beforeEach(async ({ page }) => { await routeHeaderAssets(page); });
