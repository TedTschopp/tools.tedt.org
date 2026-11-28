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
    while (!map.zoomPreview) await afterFrame();
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
    while (!map.zoomPreview) await new Promise(requestAnimationFrame);
    const paint = map.paintLandscape;
    let paints = 0;
    map.paintLandscape = function(...args: any[]) { paints++; return paint.apply(this, args); };
    const results = [];
    for (const selector of ['#zoom-in','#zoom-out']) {
      const oldScale = map.scale;
      paints = 0;
      document.querySelector<HTMLButtonElement>(selector)!.click();
      await new Promise(requestAnimationFrame);
      const preview = map.landscape.s === oldScale && map.scale !== oldScale;
      const previewPaints = paints;
      const underlay = selector==='#zoom-in' || map.zoomPreview?.s < map.scale;
      for (let n=0; n<240 && map.landscape.s!==map.scale; n++) await new Promise(requestAnimationFrame);
      results.push([preview, underlay, previewPaints, map.landscape.s===map.scale]);
    }
    map.paintLandscape = paint;
    return results;
  });
  expect(sizes).toEqual([[true,true,0,true],[true,true,0,true]]);
});

for (const missing of [false, true]) {
  test(`terrain brushes ${missing ? 'fall back when the texture sheet is unavailable' : 'reuse the decoded artwork before a first zoom'}`, async ({page}) => {
    let blocked = 0;
    if (missing) await page.route(/\/assets\/terrain-patterns-[12]x\.png$/, r => { blocked++; return r.abort(); });
    await page.goto('/edison-atlas/#lens=terrain&x=120.131&y=265.228&z=23.008');
    await expect(page.locator('#loading')).toBeHidden();
    const result = await page.evaluate(async () => {
      const {makePattern} = await import(new URL('js/usaciv/render/art/sprites.js', document.baseURI).href);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 200;
      const ctx = canvas.getContext('2d')!;
      let repaints = 0;
      // This low-detail snow brush has never been drawn in the Duarte view.
      const pattern = makePattern(ctx, 'terrain-tex:snow@0.55', 200, Math.min(devicePixelRatio, 2),
        (ink: CanvasRenderingContext2D) => { repaints++; ink.fillRect(0, 0, 200, 200); });
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, 200, 200);
      return {repaints, ink: ctx.getImageData(0, 0, 200, 200).data.some((v, i) => i % 4 === 3 && v > 0)};
    });
    if (missing) expect(blocked).toBeGreaterThan(0);
    expect(result).toEqual({repaints: missing ? 1 : 0, ink: true});
    await page.locator('#zoom-in').click();
    await expect(page).not.toHaveURL(/z=23\.008(?:&|$)/);
  });
}

for (const blocked of [false, true]) {
  test(`native zoom detail ${blocked ? 'recovers when the worker cannot load' : 'comes from bounded background patches'}`, async ({page}) => {
    if (blocked) await page.route(/\/js\/terrain-painter(?:\.[a-f0-9]+)?\.js$/, route => route.abort());
    await page.goto('/edison-atlas/#lens=terrain&x=120.131&y=265.228&z=23.008&layers=utility,places,roads,water,art');
    await expect(page.locator('#loading')).toBeHidden();
    const result = await page.evaluate(async () => {
      const {HexMap} = await import(new URL('js/map.js', document.baseURI).href);
      const proto = HexMap.prototype, draw = proto.draw;
      const got = new Promise<any>(resolve => {
        proto.draw = function(...args: any[]) { draw.apply(this, args); resolve(this); };
      });
      let map;
      try {
        document.querySelector('#map')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}));
        map = await got;
      } finally { proto.draw = draw; }
      map.draw();
      const service = map.terrainRaster, paint = service.paint.bind(service);
      const sizes: number[][] = [];
      let calls = 0;
      service.paint = async (...args: any[]) => {
        calls++;
        const image = await paint(...args);
        if (image) sizes.push([image.width, image.height]);
        return image;
      };
      const frame = () => new Promise(requestAnimationFrame);
      document.querySelector<HTMLButtonElement>('#zoom-in')!.click();
      await frame();
      for (let i=0; i<400 && map.landscape.s!==map.scale; i++) await frame();
      const ready = map.landscape.s===map.scale;
      // An exact PNG must stay authoritative even if an old worker reply is in flight.
      map.zoom(.9);
      await frame();
      const previous = calls;
      if (service.available) {
        for (let i=0; i<60 && calls===previous; i++) await frame();
      }
      map.draw();
      const exact = map.landscape;
      await new Promise(r => setTimeout(r,300));
      return {ready, authoritative: map.landscape===exact && exact.s===map.scale,
              available:service.available, sizes, ratio:map.dpr};
    });
    expect(result.ready).toBe(true);
    expect(result.authoritative).toBe(true);
    expect(result.available).toBe(!blocked);
    if (blocked) expect(result.sizes).toEqual([]);
    else {
      expect(result.sizes.length).toBeGreaterThan(1);
      for (const [w,h] of result.sizes) {
        expect(w).toBeLessThanOrEqual(384*result.ratio + 1);
        expect(h).toBeLessThanOrEqual(128*result.ratio + 1);
      }
    }
  });
}

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

test('Los Angeles banner separates city and metro populations and links related profiles', async ({page}) => {
  await page.goto('/edison-atlas/#metro=31080');
  const side = page.locator('#sidebar');
  await expect(side).toHaveAttribute('data-profile', 'metro');
  await expect(side).toContainText('12,844,441');
  await expect(side.locator('.yield-tile .val')).toHaveText(['23.7K','947K','$1.35T','854K','229K']);
  // The upper nameplate and the yield strip are adjacent hit targets on the real canvas.
  const hit = await page.evaluate(async () => {
    const {HexMap} = await import(new URL('js/map.js', document.baseURI).href);
    const original = HexMap.prototype.draw;
    const nextDraw = new Promise<any>(resolve => {
      HexMap.prototype.draw = function(...args: any[]) { original.apply(this, args); resolve(this); };
    });
    try {
      document.querySelector('#map')!.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight'}));
      const map = await nextDraw;
      const row = map.labels.find((label: any) => label.kind === 'metro' && label.id === '31080');
      return {x: (row.x0 + row.x1) / 2, y: (row.y0 + row.y1) / 2, nameY: row.y0 - 5};
    } finally { HexMap.prototype.draw = original; }
  });
  await page.locator('#map').click({position:{x:hit.x, y:hit.y}});
  await expect(side).toHaveAttribute('data-profile', 'metro');
  await page.locator('#map').click({position:{x:hit.x, y:hit.nameY}});
  await expect(side).toHaveAttribute('data-profile', 'place');
  await expect(side).toContainText('3,857,263');
  await expect(side).toContainText('$81,939');
  await side.locator('[data-profile-kind="county"][data-id="06037"]').click();
  await expect(side).toContainText('Electricity use');
  await expect(page).toHaveURL(/county=06037/);
  await page.reload();
  await expect(side).toHaveAttribute('data-profile','county');
  await side.locator('[data-profile-kind="state"]').click();
  await expect(side.locator('.yield-tile .rank')).toHaveCount(5);
  await side.locator('[data-profile-kind="metro"][data-id="31080"]').click();
  await expect(page).toHaveURL(/metro=31080/);
});

test('partial military and protected-land hexes expose native land-access shares', async ({page}) => {
  await page.goto('/edison-atlas/#lens=terrain&tile=137,140&x=137&y=121.24&z=10&layers=water,art');
  const side = page.locator('#sidebar');
  await expect(side).toHaveAttribute('data-profile','hex');
  await expect(side).toContainText('20.69%');
  await expect(page.locator('#legend')).toContainText('Military / restricted land');
  await side.getByRole('button',{name:'Map layers'}).click();
  await side.getByRole('switch',{name:'Military & restricted land'}).click();
  await expect(page.locator('#legend')).not.toContainText('Military / restricted land');
  await expect(page).toHaveURL(/access=off/);
  await page.reload();
  await expect(side.getByRole('switch',{name:'Military & restricted land'})).toHaveAttribute('aria-checked','false');
  await page.goto('/edison-atlas/#tile=50,-25');
  await expect(side).toContainText('no public access');
  await expect(side).toContainText('83.3%');
});

test('a narrow screen keeps the map visible above the regional sheet', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/edison-atlas/#state=06');
  const side = page.locator('#sidebar');
  await expect(side).toHaveAttribute('data-profile','state');
  const box = await side.boundingBox();
  expect(box!.y).toBeGreaterThan(100);
  expect(box!.width).toBeLessThanOrEqual(390);
  await side.locator('[data-profile-kind="metro"][data-id="31080"]').click();
  await expect(side).toContainText('12,844,441');
  await expect(page).toHaveURL(/metro=31080/);
});

test('metro ribbon hit targets stay clear of overlapping utility icons at regional and street zoom', async ({page}) => {
  await page.setViewportSize({width:1400,height:860});
  await page.goto('/edison-atlas/#metro=31080');
  await expect(page.locator('#sidebar')).toHaveAttribute('data-profile','metro');
  const checks = await page.evaluate(async () => {
    const {HexMap} = await import(new URL('js/map.js', document.baseURI).href);
    const original = HexMap.prototype.draw;
    const nextDraw = new Promise<any>(resolve => {
      HexMap.prototype.draw = function(...args: any[]) { original.apply(this, args); resolve(this); };
    });
    let map;
    try {
      document.querySelector('#map')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}));
      map = await nextDraw;
    } finally { HexMap.prototype.draw = original; }
    const rows = [];
    // Drive different reporting scales around the same namesake city and always
    // test exactly where each visible economic icon is painted.
    for (const scale of [1.6, 7.9995, 12, 22, 30]) {
      map.go(map.place.x, map.place.y, scale / map.base);
      map.draw();
      const latched = map.labels.find((l: any) => l.kind === 'metro' && l.id === '31080');
      const transitions = [0.1,0.3,0.5,0.7,0.9].map(f => {
        const x = latched.x0 + (latched.x1 - latched.x0) * f;
        const y = (latched.y0 + latched.y1) / 2;
        return map.hitLabel([x,y])?.kind;
      });
      rows.push(transitions);
    }
    return rows;
  });
  for (const row of checks) expect(row).toEqual(['metro','metro','metro','metro','metro']);
});

test('the territory map opens with separately switchable grid lines and clickable substation symbols', async ({page}) => {
  await page.goto('/edison-atlas/');
  const legend = page.locator('#legend');
  await expect(legend).toContainText('24-mile regional crossings');
  const panel = page.locator('#utility-panel');
  await page.locator('#utility-menu').click();
  for (const kind of ['transmission', 'distribution', 'substations']) {
    await expect(panel.locator('[data-grid-filter="' + kind + '"]')).toBeChecked();
  }
  const overview = () => page.locator('#mini').evaluate((c: HTMLCanvasElement) => c.toDataURL());
  const withBothNetworks = await overview();
  await panel.locator('[data-grid-filter="transmission"]').click();
  await expect.poll(overview).not.toEqual(withBothNetworks);
  await expect(legend).not.toContainText('Transmission');
  await expect(legend).toContainText('Distribution');
  await page.locator('#utility-menu').click();
  await expect(page).toHaveURL(/gridlayers=/);
  await page.reload();
  await expect(legend).not.toContainText('Transmission');
  await expect(legend).toContainText('Substations');

  const hit = await page.evaluate(async () => {
    const {HexMap} = await import(new URL('js/map.js', document.baseURI).href);
    const draw = HexMap.prototype.draw;
    const next = new Promise<any>(resolve => {
      HexMap.prototype.draw = function(...args: any[]) { draw.apply(this,args); resolve(this); };
    });
    const canvas = document.querySelector<HTMLCanvasElement>('#map')!;
    const bounds = canvas.getBoundingClientRect();
    try {
      canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}));
      const map = await next;
      for (const label of map.labels.filter((v: any) => v.kind === 'substation')) {
        const x = (label.x0 + label.x1) / 2, y = (label.y0 + label.y1) / 2;
        if (map.hitLabel([x,y]) === label && document.elementFromPoint(bounds.x+x,bounds.y+y) === canvas)
          return {x,y,count:label.p.count};
      }
      throw new Error('No visible substation marker at the territory zoom');
    } finally { HexMap.prototype.draw = draw; }
  });
  await page.locator('#map').click({position:{x:hit.x,y:hit.y}});
  const side = page.locator('#side-body');
  await expect(side.getByRole('heading', {name:'Substations',exact:true})).toBeVisible();
  await expect(side.locator('.lens-callout strong')).toContainText(hit.count + ' substation record');
  await expect(page).toHaveURL(/stationarea=/);
  await page.reload();
  await expect(side.locator('.lens-callout strong')).toContainText(hit.count + ' substation record');
  await page.goto('/edison-atlas/#lens=terrain&x=120.131&y=265.228&z=30');
  const zoomBack = legend.getByRole('button', {name:'Zoom to grid crossings'});
  await expect(zoomBack).toBeVisible();
  await zoomBack.click();
  await expect(zoomBack).toBeHidden();
  await expect(legend.locator('#grid-scale-note')).toHaveText('Grid lines · 24-mile regional crossings');
});
