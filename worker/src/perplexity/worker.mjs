import {
  appUrl, previewPath, projectionModel, readView, sharePath, shareViewUrl, viewData,
} from '../../../tool-src/tools/perplexity-projections/model.mjs';
import { lossLabels, renderPreview } from './preview.mjs';

const origin = new URL(appUrl).origin;
const defaultPreview = origin + '/img/perplexity-projections-preview.png';
const robots = 'noindex, follow, max-image-preview:large';

function metadata(view) {
  const data = viewData(view);
  const date = projectionModel.formatMonth(data.end);
  const [low, high] = lossLabels(data.range);
  const title = 'Perplexity Projections · Through ' + date;
  const description = 'A shared chart through ' + date + ' with log-perplexity zoom ' + low + '–' + high +
    ' and illustrative IQ anchors ' + view.lowerIq.toFixed(3) + ' and ' + view.higherIq.toFixed(3) + '.';
  const image = shareViewUrl(view, previewPath);
  const url = shareViewUrl(view);
  const alt = 'Log-perplexity chart through ' + date + ' at a vertical scale of ' + low + ' to ' + high +
    (view.series.iq ? ', with illustrative IQ reference bands.' : '.');
  return { title, description, image, url, alt };
}

async function sharedPage(view, request, version) {
  const response = await fetch(appUrl, { redirect: 'manual', headers: { Accept: 'text/html' } });
  if (response.status !== 200 || !/^text\/html\b/i.test(response.headers.get('content-type') ?? '')) return fetch(request);
  const { title, description, image, url, alt } = metadata(view);
  const fields = new Map([
    ['description', description], ['robots', robots],
    ['og:title', title], ['og:description', description], ['og:url', url],
    ['og:image', image], ['og:image:secure_url', image], ['og:image:alt', alt],
    ['twitter:title', title], ['twitter:description', description], ['twitter:url', url],
    ['twitter:image', image], ['twitter:image:alt', alt],
  ]);
  const rewriter = new HTMLRewriter()
    .on('head title', { element(element) { element.setInnerContent(title + ' · Ted’s Tools'); } })
    .on('head meta', {
      element(element) {
        const field = element.getAttribute('property') ?? element.getAttribute('name');
        if (fields.has(field)) element.setAttribute('content', fields.get(field));
      },
    });
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Robots-Tag', robots);
  if (version) headers.set('X-Perplexity-Preview-Version', version);
  for (const name of ['Content-Length', 'Content-Encoding', 'ETag', 'Last-Modified', 'Age', 'Expires']) headers.delete(name);
  if (request.method === 'HEAD') {
    await response.body?.cancel();
    return new Response(null, { headers });
  }
  const html = rewriter.transform(response);
  return new Response(html.body, { headers });
}

async function chartPreview(view, request, ctx) {
  const headers = {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  };
  if (request.method === 'HEAD') return new Response(null, { headers });
  const key = new Request(shareViewUrl(view, previewPath));
  const cached = await caches.default.match(key).catch(() => null);
  if (cached) return cached;
  const response = new Response(await renderPreview(view), { headers });
  ctx.waitUntil(caches.default.put(key, response.clone()).catch(() => {}));
  return response;
}

export default {
  async fetch(request, env, ctx) {
    ctx.passThroughOnException();
    const url = new URL(request.url);
    if (url.origin !== origin || ![sharePath, previewPath].includes(url.pathname)) return fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const view = readView(url.searchParams.get('view'));
    if (!view) return Response.redirect(url.pathname === previewPath ? defaultPreview : appUrl, 302);
    if (url.pathname === previewPath) return chartPreview(view, request, ctx);
    return sharedPage(view, request, env.CF_VERSION_METADATA?.id);
  },
};
