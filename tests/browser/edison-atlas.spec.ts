import {test, expect} from '@playwright/test';
import {routeHeaderAssets} from '../shared-header.mjs';

test.beforeEach(async ({page}) => { await routeHeaderAssets(page); });

test('returning visitors load content-versioned app and map modules even with stale stable URLs', async ({page}) => {
  const staleRequests: string[] = [];
  await page.route(/\/edison-atlas\/js\/(app|map)\.js$/, async route => {
    staleRequests.push(route.request().url());
    await route.fulfill({contentType:'application/javascript',body:'throw new Error("stale stable module");'});
  });
  await page.goto('/edison-atlas/#lens=terrain&x=120.131&y=265.228&z=23.008');
  await expect(page.locator('#loading')).toBeHidden();
  const modules = await page.evaluate(async () => {
    const imports = JSON.parse(document.querySelector('script[type="importmap"]')!.textContent!).imports;
    const paths = [imports['./js/app.js'], imports['./js/map.js']];
    return Promise.all(paths.map(async (url: string) => {
      const bytes = await (await fetch(url)).arrayBuffer();
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      return {url,digest:Array.from(hash, byte => byte.toString(16).padStart(2,'0')).join('').slice(0,16)};
    }));
  });
  expect(staleRequests).toEqual([]);
  expect(modules[0].url).toBe(`./js/app.${modules[0].digest}.js`);
  expect(modules[1].url).toBe(`./js/map.${modules[1].digest}.js`);
});

test('panning detailed terrain avoids one display-canvas fill per hex', async ({page}) => {
  await page.goto('/edison-atlas/#lens=terrain&x=120.131&y=265.228&z=23.008&layers=water,art');
  await expect(page.locator('#loading')).toBeHidden();
  const fills = await page.evaluate(async () => {
    const nextFrame = () => new Promise(requestAnimationFrame);
    await nextFrame();
    const canvas = document.querySelector<HTMLCanvasElement>('#base')!;
    const context = canvas.getContext('2d')!;
    const fill = context.fill;
    let count = 0;
    // Safari's expensive work happens after these commands return. Count hex
    // fills on the visible canvas so this also catches the regression in Chromium CI.
    context.fill = new Proxy(fill, {
      apply(target, receiver, args) {
        if (!args.length) count++;
        return Reflect.apply(target, receiver, args);
      },
    });
    try {
      document.querySelector('#map')!.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight'}));
      await nextFrame();
      await nextFrame();
      return count;
    } finally {
      context.fill = fill;
    }
  });
  await expect(page).not.toHaveURL(/x=120\.131(?:&|$)/);
  expect(fills).toBeLessThan(32);
});

test('a fractional pan reuses terrain and crossing the cache edge paints only exposed strips', async ({page}) => {
  await page.goto('/edison-atlas/#lens=terrain&x=120.131&y=265.228&z=23.008&layers=utility,places,roads,water,art&tile=117,306&place=0619990');
  await expect(page.locator('#loading')).toBeHidden();
  const result = await page.evaluate(async () => {
    const {HexMap} = await import(new URL('js/map.js', document.baseURI).href);
    const proto = HexMap.prototype;
    const original = proto.paintLandscape;
    const areas: number[] = [];
    const reliefFractions: number[] = [];
    let fullSize = 0;
    const afterFrame = () => new Promise(requestAnimationFrame);
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
    // Capture the real map on the next normal keyboard repaint.
    const draw = proto.draw;
    const received = new Promise<any>(resolve => {
      proto.draw = function(...args: any[]) { draw.apply(this,args); resolve(this); };
    });
    let map;
    try {
      document.querySelector('#map')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}));
      map = await received;
    } finally { proto.draw = draw; }
    await afterFrame();
    map.draw();
    fullSize = map.landscapeInk.canvas.width * map.landscapeInk.canvas.height;
    proto.paintLandscape = function(ctx: CanvasRenderingContext2D, ...args: any[]) {
      areas.push(ctx.canvas.width * ctx.canvas.height);
      const drawImage = ctx.drawImage;
      ctx.drawImage = new Proxy(drawImage, {apply(target, receiver, argList) {
        if (argList[0] === map.m.image) {
          const [image,,,sw,sh] = argList;
          reliefFractions.push(argList.length===9 ? sw*sh/(image.width*image.height) : 1);
        }
        return Reflect.apply(target,receiver,argList);
      }});
      try { return original.call(this,ctx,...args); } finally { ctx.drawImage = drawImage; }
    };
    try {
      const [x,y,z,s] = [map.x,map.y,map.z,map.scale];
      map.go(x+.375/s,y+.25/s,z);
      await afterFrame(); await wait(350);
      const fractional = areas.splice(0);
      map.go(x+200/s,y+70/s,z);
      await afterFrame(); await wait(350);
      const exposed = areas.splice(0);
      // An export must be able to request precise native pixels immediately.
      map.zoom(1.13); await afterFrame();
      map.draw();
      return {fractional,exposed,fullSize,reliefFractions,exportScale:map.landscape.s,cameraScale:map.scale};
    } finally { proto.paintLandscape = original; }
  });
  expect(result.fractional).toEqual([]);
  expect(result.exposed.length).toBeGreaterThan(0);
  expect(result.exposed.reduce((a,b)=>a+b,0)).toBeLessThan(result.fullSize/2);
  expect(result.reliefFractions.length).toBeGreaterThan(0);
  expect(Math.max(...result.reliefFractions)).toBeLessThan(.05);
  expect(result.exportScale).toBe(result.cameraScale);
});

test('a settled zoom finishes at native detail and a layer change cancels old zoom work', async ({page}) => {
  await page.goto('/edison-atlas/#lens=terrain&x=120.131&y=265.228&z=23.008&layers=roads,water,art');
  await expect(page.locator('#loading')).toBeHidden();
  const {native,correctLayer,patches} = await page.evaluate(async () => {
    const {HexMap} = await import(new URL('js/map.js', document.baseURI).href);
    const proto = HexMap.prototype, draw = proto.draw, paint = proto.paintLandscape;
    const nextFrame = () => new Promise(requestAnimationFrame);
    const received = new Promise<any>(resolve => {
      proto.draw = function(...args: any[]) { draw.apply(this,args); resolve(this); };
    });
    let m;
    try {
      document.querySelector('#map')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}));
      m = await received;
    } finally { proto.draw = draw; }
    m.draw();
    let patches = 0;
    proto.paintLandscape = function(ctx: CanvasRenderingContext2D,...args: any[]) {
      if (ctx.canvas.height < m.canvas.height) patches++;
      return paint.call(this,ctx,...args);
    };
    try {
      m.zoom(1.1);
      for (let i=0; i<150 && m.landscape.s!==m.scale; i++) await nextFrame();
      const native = m.landscape.s===m.scale;
      m.zoom(1.1);
      const previous = patches;
      for (let i=0; i<150 && patches===previous; i++) await nextFrame();
      document.querySelector<HTMLButtonElement>('[data-overlay="roads"]')!.click();
      await nextFrame();
      const current = m.landscape;
      await new Promise(r => setTimeout(r,400));
      return {native,patches,correctLayer:!m.opts.roads && m.landscape===current};
    } finally { proto.paintLandscape = paint; }
  });
  expect(native).toBe(true);
  expect(patches).toBeGreaterThan(1);
  expect(correctLayer).toBe(true);
});

test('both zoom buttons present a preview before rendering the exact scale', async ({page}) => {
  await page.goto('/edison-atlas/#lens=terrain&x=120.131&y=265.228&z=23.008&layers=places,roads,water,art');
  await expect(page.locator('#loading')).toBeHidden();
  const sizes = await page.evaluate(async () => {
    const {HexMap} = await import(new URL('js/map.js', document.baseURI).href);
    const proto = HexMap.prototype, draw = proto.draw;
    const got = new Promise<any>(resolve => {
      proto.draw = function(...args: any[]) { draw.apply(this,args); resolve(this); };
    });
    let map;
    try {
      document.querySelector('#map')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}));
      map = await got;
    } finally { proto.draw = draw; }
    map.draw();
    const results = [];
    for (const selector of ['#zoom-in','#zoom-out']) {
      const oldScale = map.scale;
      document.querySelector<HTMLButtonElement>(selector)!.click();
      await new Promise(requestAnimationFrame);
      const preview = map.landscape.s === oldScale && map.scale !== oldScale;
      const underlay = selector==='#zoom-in' || map.zoomPreview?.s < map.scale;
      for (let n=0; n<240 && map.landscape.s!==map.scale; n++) await new Promise(requestAnimationFrame);
      results.push([preview, underlay, map.landscape.s===map.scale]);
    }
    return results;
  });
  expect(sizes).toEqual([[true,true,true],[true,true,true]]);
});

test('cooling center directory opens and shares the actual one-mile hex', async ({page}) => {
  await page.goto('/edison-atlas/#report=cooling');
  await expect(page.getByRole('heading', {name:'Cooling centers in SCE territory'})).toBeVisible();
  const search = page.getByRole('searchbox', {name:'Facility, city, street or ZIP'});
  await search.fill('Palomares Park');
  await expect(page.locator('#cooling-table tbody tr:visible')).toHaveCount(1);
  await page.getByRole('button', {name:'Palomares Park Community Center'}).click();
  await expect(page.locator('#side-body')).toContainText('499 E Arrow Highway');
  await expect(page.locator('#side-body')).toContainText('Cooling centers in this hex');
  await page.getByRole('button', {name:'Share view'}).click();
  const link = new URL(await page.locator('#share-url').inputValue());
  const view = new URLSearchParams(link.hash.slice(1));
  expect(link.pathname).toBe('/edison-atlas/');
  expect(view.get('lens')).toBe('sceCooling');
  expect(view.get('tile')).toBe('129,311');
});

test('switching roads off and on repaints the cached landscape at the same camera', async ({page}) => {
  await page.goto('/edison-atlas/#lens=terrain&x=120.131&y=265.228&z=23.008&layers=roads');
  const roads = page.locator('[data-overlay="roads"]');
  await expect(roads).toHaveAttribute('aria-checked', 'true');
  const picture = () => page.locator('#base').evaluate(async (canvas: HTMLCanvasElement) => {
    await new Promise(requestAnimationFrame);
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    const hash = await crypto.subtle.digest('SHA-256', pixels.data);
    return Array.from(new Uint8Array(hash));
  });
  const withRoads = await picture();
  await roads.click();
  await expect.poll(picture).not.toEqual(withRoads);
  await roads.click();
  await expect.poll(picture).toEqual(withRoads);
});

test('one-mile planning data distinguishes partial polygons and overlapping source bands', async ({page}) => {
  await page.goto('/edison-atlas/#lens=projectCoverage&tile=83,53&x=83.5&y=45.9&z=25');
  await expect(page.locator('.lens-callout strong')).toHaveText('14.17%');
  const panel = page.locator('#side-body');
  await expect(panel).toContainText('SCE planning in this hex');
  await expect(panel).toContainText('3 records');
  await expect(panel).toContainText('32.56% mapped');
  await panel.locator('.band-coverage summary').first().click();
  await expect(panel.locator('.band-coverage[open]')).toContainText('Above 5 MW');
  await page.goto('/edison-atlas/#lens=fire&tile=163,146&x=163&y=126.44&z=25');
  await expect(page.locator('.lens-callout')).toContainText('Largest area in the hex');
  await expect(page.locator('.lens-callout strong')).toHaveText('Outside tiers 2–3');
});

test('fire colors the clicked hex by area and shows the complete percentage split', async ({page}) => {
  // The point lookup for this hex was Tier 2. Tier 3 covers 82.19% of the SCE area.
  await page.goto('/edison-atlas/#lens=fire&x=154.5&y=276.262&z=25&layers=');
  const base = page.locator('canvas#base');
  await expect.poll(() => base.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d')!;
    return Array.from(context.getImageData(Math.floor(element.width/2), Math.floor(element.height/2), 1, 1).data);
  })).toEqual([185, 86, 64, 255]);
  const canvas = page.locator('canvas#map');
  const bounds = (await canvas.boundingBox())!;
  await canvas.click({position:{x:bounds.width/2, y:bounds.height/2}});
  await expect(page.locator('.lens-callout strong')).toHaveText('Tier 3 · Extreme');
  const coverage = page.locator('section.detail-section').filter({has:page.getByRole('heading', {name:'Fire tier coverage'})});
  for (const [label, share] of [['Tier 3 · Extreme','82.19%'],['Tier 2 · Elevated','17.68%'],['Outside tiers 2–3','0.13%']]) {
    await expect(coverage.locator('.fact').filter({hasText:label}).locator('b')).toHaveText(share);
  }
});

test('reopening a scrolled phone inspector brings all fire percentages into view', async ({page}) => {
  await page.setViewportSize({width:390, height:844});
  await page.goto('/edison-atlas/#lens=fire&tile=154,319&x=154.5&y=276.262&z=25&layers=');
  const body = page.locator('#side-body');
  const coverage = body.locator('section.detail-section').filter({has:page.getByRole('heading', {name:'Fire tier coverage'})});
  await expect(coverage).toBeInViewport({ratio:1});
  await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(coverage).not.toBeInViewport();
  await page.locator('#mobile-close').click();
  const canvas = page.locator('canvas#map');
  const bounds = (await canvas.boundingBox())!;
  await canvas.click({position:{x:bounds.width/2, y:bounds.height/2}});
  await expect(coverage).toBeInViewport({ratio:1});
  await expect(coverage).toContainText('82.19%');
});

test('planning inventory, local religion sources, and both downloads are available', async ({page}) => {
  await page.goto('/edison-atlas/#report=planning');
  const body = page.locator('#dialog-body');
  await expect(body).toContainText('94 layers and tables');
  await expect(body).toContainText('2035');
  await body.getByRole('button', {name:'Religion',exact:true}).click();
  await expect(body).toContainText('West Valley');
  await expect(body.getByRole('link', {name:'Study variables and geography'})).toBeVisible();
  await page.getByRole('button', {name:'Close dialog'}).click();
  await page.getByRole('button', {name:'Sources',exact:true}).click();
  await expect(body.getByRole('link', {name:'Download offline atlas'})).toHaveAttribute('href','Edison-Atlas-offline.zip');
  await expect(body.getByRole('link', {name:'Download one-mile GIS data'})).toHaveAttribute('href','data/SCE-one-mile-hexes.zip');
});
