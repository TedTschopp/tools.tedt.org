import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import {
  appUrl, defaultView, previewHeight, previewPath, previewWidth, sharePath, shareViewUrl,
} from '../../tool-src/tools/perplexity-projections/model.mjs';

const source = readFileSync(new URL('../../tool-src/tools/perplexity-projections.html', import.meta.url), 'utf8');
const version = 'fixture-version';
const shared = {
  ...defaultView, future: 60, base: .5, minimum: .64, maximum: .75,
  lowerIq: .71, higherIq: .67, marks: { annual: false, quarterly: true, monthly: true },
};
let worker;
let originRequests = 0;

before(() => {
  worker = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    modulesRoot: fileURLToPath(new URL('../../', import.meta.url)),
    scriptPath: fileURLToPath(new URL('../.wrangler/perplexity/worker.js', import.meta.url)),
    compatibilityDate: '2026-10-01',
    bindings: { CF_VERSION_METADATA: { id: version } },
    outboundService(request) {
      assert.equal(request.url, appUrl);
      assert.equal(request.headers.get('cookie'), null);
      assert.equal(request.headers.get('authorization'), null);
      originRequests++;
      return new Response(source, { headers: { 'Content-Type': 'text/html; charset=utf-8', ETag: '"origin"' } });
    },
  }));
});
after(() => worker?.dispose());

test('a crawler gets the shared chart metadata in the initial HTML', async () => {
  const url = shareViewUrl(shared);
  const image = shareViewUrl(shared, previewPath);
  const response = await worker.dispatchFetch(url, {
    headers: { 'User-Agent': 'Twitterbot/1.0', Cookie: 'fixture=1', Authorization: 'Bearer fixture' },
  });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-perplexity-preview-version'), version);
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  assert.equal(response.headers.get('etag'), null);
  assert.match(html, /rel="canonical" href="https:\/\/tools\.tedt\.org\/perplexity-projections\.html"/);
  assert.match(html, /"@type": "WebApplication"/);
  assert.match(html, /Through Nov 2031/);
  assert.match(html, /zoom 0\.640–0\.750 and illustrative IQ anchors 0\.710 and 0\.670/);
  for (const [attribute, name, value] of [
    ['property', 'og:url', url], ['property', 'og:image', image], ['property', 'og:image:secure_url', image],
    ['name', 'twitter:image', image], ['name', 'twitter:card', 'summary_large_image'],
  ]) assert.ok(html.includes(attribute + '="' + name + '" content="' + value + '"'), name);
  assert.match(html, /id="share-view"/);
  assert.equal(originRequests, 1);
});

test('different chart views return distinct, full-size PNG previews', async () => {
  const first = await worker.dispatchFetch(shareViewUrl(shared, previewPath));
  const second = await worker.dispatchFetch(shareViewUrl(defaultView, previewPath));
  for (const response of [first, second]) {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.match(response.headers.get('cache-control'), /max-age/);
  }
  const firstPng = Buffer.from(await first.arrayBuffer());
  const secondPng = Buffer.from(await second.arrayBuffer());
  assert.equal(firstPng.toString('hex', 0, 8), '89504e470d0a1a0a');
  assert.equal(firstPng.readUInt32BE(16), previewWidth);
  assert.equal(firstPng.readUInt32BE(20), previewHeight);
  assert.notDeepEqual(firstPng, secondPng);
  const repeat = await worker.dispatchFetch(shareViewUrl(shared, previewPath));
  assert.deepEqual(Buffer.from(await repeat.arrayBuffer()), firstPng);
});

test('malformed or missing view settings use the default entry points', async () => {
  for (const [path, target] of [
    [sharePath, appUrl],
    [previewPath, 'https://tools.tedt.org/img/perplexity-projections-preview.png'],
  ]) {
    const response = await worker.dispatchFetch(new URL(path + '?view=bad', appUrl), { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), target);
  }
});
