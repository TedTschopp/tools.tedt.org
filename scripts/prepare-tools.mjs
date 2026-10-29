import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { marked } from 'marked';
import { Liquid } from 'liquidjs';
import * as sass from 'sass';

const root = process.cwd(), source = path.join(root, 'tool-src'), out = path.join(root, 'public');
export const site = 'https://tools.tedt.org';
const inventory = JSON.parse(await fs.readFile('reports/source-inventory.json', 'utf8'));
const read = p => fs.readFile(path.join(source, p), 'utf8');
const json = (p, v) => fs.writeFile(p, JSON.stringify(v, null, 2) + '\n');
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain = s => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|amp|mdash|ndash|rarr|larr);/g, ' ').replace(/\s+/g, ' ').trim();
const canonicalPath = p => p.replace(/\/index\.html$/, '/');
function relocate(value) {
  if (!value) return '';
  const u = new URL(value, 'https://tedt.org');
  if (!['tedt.org', 'www.tedt.org'].includes(u.hostname) || u.pathname.startsWith('/RPG/Traveller/')) return u.href;
  u.hostname = 'tools.tedt.org';
  u.pathname = u.pathname.replace(/^\/tools\//, '/');
  return u.href;
}
function category(tags, slug) {
  const text = [...tags, slug].join(' ');
  if (/rpg|osr-|traveller|hexcrawl|terrain|constellation|world-map|tile-map|islands/.test(text)) return 'Maps and RPG';
  if (/image|color|gradient|svg|vector|painter|art|design/.test(text)) return 'Images and design';
  if (/mastodon|bluesky|social|outage/.test(text)) return 'Social';
  if (/learning|transformer|game-theory|math|inside-ai/.test(text)) return 'AI and learning';
  if (/timer|productivity|focus|start-page/.test(text)) return 'Productivity';
  if (/text|markdown|code|sloc|qr|password|prompt|ipfs|onboard/.test(text)) return 'Text and code';
  return 'Experiments';
}
await fs.rm(out, {recursive: true, force: true});
await fs.mkdir(out, {recursive: true});
await fs.mkdir('src/data', {recursive: true});
const engine = new Liquid({root: path.join(source, '_includes'), extname: '.html', jekyllInclude: true, dynamicPartials: false, strictFilters: true});
engine.registerFilter('relative_url', value => String(value ?? ''));
engine.registerFilter('absolute_url', value => new URL(String(value ?? ''), site).href);
engine.registerFilter('jsonify', JSON.stringify);
const gameData = yaml.load(await read('_data/game_theory.yml'));
const publicProfile = JSON.parse(await fs.readFile('src/data/legacy-profile.json','utf8'));
async function render(content, data = {}) {
  content = content.replace(/{%\s*link\s+([^%]+)\s*%}/g, (_, p) => relocate('/' + p.trim()));
  // The image include becomes a plain responsive <img>; preserve the artwork,
  // text, dimensions, and loading priority without the parent site's manifest.
  content = content.replace(/{%\s*include game-theory\/hero-image\.html\s+([^%]+)%}/g, (_, args) => {
    const get = name => args.match(new RegExp('(?:^|\\s)' + name + '=("[^"]*"|[^\\s]+)'))?.[1];
    const src = get('src') ?? 'page.image', alt = get('alt') ?? 'page.image-alt';
    const variant = get('variant') ?? '"page"';
    return `<figure class="gt-hero-image gt-hero-image--{{ ${variant} | escape }}"><img class="gt-artwork" src="{{ ${src} | relative_url }}" alt="{{ ${alt} | escape }}" width="1672" height="941" loading="${get('lcp') === 'true' ? 'eager' : 'lazy'}" decoding="async"></figure>`;
  });
  return engine.parseAndRender(content, {site: {url: site, data: {game_theory: gameData}, ...publicProfile}, ...data});
}
const catalog = [];
const docRedirects = [];
for (const file of (await fs.readdir(path.join(source, '_tools'))).sort()) {
  if (!file.endsWith('.md')) continue;
  const {data, content} = matter(await read('_tools/' + file));
  if (data.published === false) continue;
  const slug = file.replace(/\.md$/, ''), launch = relocate(data.links?.live);
  const migrated = launch.startsWith(site + '/');
  const body = content.replace(/{{\s*site.url\s*}}{%\s*link\s+([^%]+)\s*%}/g, (_, p) => relocate('/' + p.trim()));
  const record = {slug, title: data.title, summary: data.summary || data.subtitle || '', status: data.status || 'prototype', category: category(data.tags || [], slug), tags: data.tags || [], type: data.tool_type || 'webapp', updated: String(data.last_modified instanceof Date ? data.last_modified.toISOString().slice(0,10) : data.last_modified || ''), featured: Boolean(data.featured), launch, migrated, image: data.image || data.hero_image || '', imageAlt: data['image-alt'] || data.title, screenshots: data.screenshots || [], features: data.features || [], repo: migrated ? 'https://github.com/TedTschopp/tools.tedt.org' : data.links?.repo || '', upstream: data.links?.repo || '', sourcePath: 'tool-src/_tools/' + file, html: marked.parse(await render(body, {page: data}))};
  if (migrated) {
    const originalPath = new URL(data.links.live, 'https://tedt.org').pathname;
    const appSource = 'tool-src' + originalPath + (originalPath.endsWith('/') ? 'index.html' : '');
    try { await fs.access(appSource); record.sourcePath = appSource; } catch {}
    record.upstream = record.upstream.replace('https://github.com/TedTschopp/tedt.org/tree/main/_apps/inside-ai', 'https://github.com/TedTschopp/tools.tedt.org/tree/main/tool-src/_apps/inside-ai');
  }
  // Relative live links in imported prose must point to the intended site.
  record.html = record.html.replace(/(href|src)="(\/[^"#]*)/g, (_, a, p) => `${a}="${p.startsWith('/img/') ? p : relocate(p)}`);
  catalog.push(record);
  if (!launch.startsWith('https://tedt.org/RPG/Traveller/')) docRedirects.push({from: '/tools/' + slug + '/', to: '/about/' + slug + '/'});
}
const existing = new Set(catalog.map(t => canonicalPath(new URL(t.launch).pathname)));
const htmlFiles = inventory.importedFiles.filter(f => f.source.startsWith('tools/') && f.source.endsWith('.html'));
const excludedPages = [];
for (const f of htmlFiles) {
  const old = '/' + f.source, next = canonicalPath(old.replace(/^\/tools\//, '/'));
  if (f.source === 'tools/index.html' || existing.has(next)) continue;
  const html = await read(f.source);
  if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) {excludedPages.push({path: old, reason: 'HTML support fragment or directory guard, preserved with its parent tool'}); continue;}
  const title = plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || path.basename(f.source, '.html')).replace(/\s*\|\s*Wizardawn Converted$/, '');
  const slug = next.replace(/^\/|\/$/g, '').replace(/\.html$/, '').replaceAll('/', '-').toLowerCase();
  const isOsr = f.source.startsWith('tools/osr-tools/');
  let summary = plain(html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] || html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || `${title}. A browser-based experiment from the tools collection.`).slice(0,260);
  const tags = isOsr ? ['rpg', 'osr', 'generator'] : /mastodon/i.test(f.source) ? ['mastodon', 'social', 'embed'] : f.source.includes('start-page') ? ['productivity', 'dashboard'] : f.source.includes('vector') ? ['image', 'svg', 'vector'] : ['experiment'];
  catalog.push({slug, title, summary, status: 'prototype', category: category(tags, slug), tags, type: 'webapp', updated: '', featured: false, launch: site + next, migrated: true, image: '', screenshots: [], features: [], repo: 'https://github.com/TedTschopp/tools.tedt.org', sourcePath: f.destination, html: `<p>${escape(summary)}</p><p>This previously unlisted tool is preserved as a prototype. Its existing features and limitations are retained.</p>`});
  existing.add(next);
}
catalog.sort((a,b) => Number(b.featured)-Number(a.featured) || b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title));
const researchPath='tools/Under-Development-Name-Generator/Name-Generator.html';
const research=await read(researchPath);
const references=[...new Set(research.split(/\r?\n/).map(s=>s.trim()).filter(s=>/^https:\/\/www\.fantasynamegenerators\.com\/[^\s<>]+$/.test(s)))];
await json('src/data/name-generator-references.json',references);
catalog.push({slug:'name-generator-research',title:'Name Generator Research',summary:'An unfinished name-generator project: a preserved reference list and extraction notes. The referenced generators remain on their original websites.',status:'prototype',category:'Maps and RPG',tags:['names','reference','rpg'],type:'reference',updated:'',featured:false,launch:site+'/name-generator-research/',migrated:true,image:'',screenshots:[],features:[],repo:'https://github.com/TedTschopp/tools.tedt.org',sourcePath:'tool-src/'+researchPath,html:'<p>This unfinished project contains a reference list and extraction notes. It does not provide a local name generator.</p><p><a href="/name-generator-research/">Browse the references</a>, <a href="/Under-Development-Name-Generator/name-generator-js-report.md">read the extraction notes</a>, or <a href="/Under-Development-Name-Generator/Name-Generator.html">open the preserved source list</a>.</p>'});
await json('src/data/catalog.json', catalog);

const sharedHeader = "<link rel=\"stylesheet\" href=\"/css/tedt-header-embed.css\">\n<script src=\"/js/tedt-theme-init.js\"></script>\n<tedt-global-header site=\"tools\" section=\"tools\">\n<nav class=\"tedt-header-fallback\" aria-label=\"Primary\"><a href=\"https://tedt.org/\">Ted Tschopp</a><a href=\"https://tedt.org/essays/\">Essays</a><a href=\"https://tedt.org/stories/\">Stories &amp; Folklore</a><a href=\"https://tedt.org/games/\">Games &amp; Worlds</a><a href=\"https://tools.tedt.org/\">Tools</a><a href=\"https://tedt.org/learn/\">Learn</a><a href=\"https://tedt.org/about-ted/\">About</a></nav>\n</tedt-global-header>\n<script defer src=\"https://tedt.org/assets/global-header/v1/header.js\"></script>\n";
const returnLink = '<a class="tt-catalog-return" href="/" aria-label="Return to Ted’s Tools catalog">← Tools</a><style>.tt-catalog-return{position:fixed;bottom:.6rem;left:.6rem;z-index:2147480000;padding:.3rem .65rem;border:1px solid #c8c7c3;border-radius:6px;background:#f8f6f0;color:#00446f;font:600 13px/1.5 system-ui;text-decoration:none}.tt-catalog-return:focus-visible{outline:3px solid #00a9e0;outline-offset:3px}</style>';
function rebase(text) {
  return text.replaceAll('https://tedt.org/tools/', site + '/').replaceAll('http://tedt.org/tools/', site + '/').replaceAll('/tools/', '/');
}
async function writeStatic(original, dest) {
  const file = path.join(source, original), target = path.join(out, dest);
  await fs.mkdir(path.dirname(target), {recursive:true});
  if (/\.(?:html|js|mjs|css|json|md|txt|svg|webmanifest)$/.test(original)) {
    let text = await fs.readFile(file, 'utf8');
    if (original.endsWith('.html')) {
      if (original === 'tools/social-bot-check.html') {
        const parsed = matter(text), meta = parsed.data;
        const pageUrl = site + '/social-bot-check.html', imageUrl = site + '/img/Site-Logo.webp';
        text = parsed.content.replace(/{%\s*include utility\/calculate-variables\.html\s*%}/g, '').replace(/{%\s*include seo\/meta-data-seo\.html[^%]*%}/g,
          `<title>${escape(meta.title || 'Social Bot Check')}</title><meta name="description" content="${escape(meta.description)}"><link rel="canonical" href="${pageUrl}"><meta property="og:type" content="website"><meta property="og:site_name" content="Ted’s Tools"><meta property="og:title" content="${escape(meta.title || 'Social Bot Check')}"><meta property="og:description" content="${escape(meta.description)}"><meta property="og:url" content="${pageUrl}"><meta property="og:image" content="${imageUrl}"><meta property="og:image:secure_url" content="${imageUrl}"><meta property="og:image:alt" content="Ted’s Tools"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:url" content="${pageUrl}"><meta name="twitter:image" content="${imageUrl}"><meta name="twitter:image:src" content="${imageUrl}"><meta name="twitter:image:alt" content="Ted’s Tools">`);
        text = await render(text, {page: meta});
      }
      // Resolve loader paths relative to each standalone file, including file://.
      const loader = path.posix.relative(path.posix.dirname('/' + dest), '/lib/tedt-org-tools-loader.js');
      text = text.replace(/<script>\(function\(\)\{var s=document\.createElement\('script'\);[\s\S]*?<\/script>/g, `<script src="${loader}"></script>`);
      if (original === 'tools/mastodon/index.html') text = await render(matter(text).content);
      text = rebase(text);
      text = text.replaceAll("script-src 'self'", "script-src 'self' https://tedt.org/assets/global-header/v1/").replaceAll("style-src 'self'", "style-src 'self' https://tedt.org/assets/global-header/v1/");
      if (/<html[\s>]/i.test(text)) {
        text = text.replace('</head>', sharedHeader.slice(0, sharedHeader.indexOf('<tedt-global-header')) + '</head>');
        text = text.replace(/(<body\b[^>]*>)/i, '$1' + sharedHeader.slice(sharedHeader.indexOf('<tedt-global-header')) + returnLink);
        if (!/<link[^>]+rel=["']canonical/.test(text)) text = text.replace('</head>', `<link rel="canonical" href="${site}${canonicalPath('/' + dest)}"></head>`);
      }
    } else text = rebase(text);
    if (original === 'tools/image-tools/image-tools.js') text = text.replace('scope: "./"', 'scope: "./image-tools"').replace('Offline cache enabled for /.', 'Offline cache enabled for Image Tools.');
    await fs.writeFile(target, text);
  } else await fs.copyFile(file, target);
}
const staticFiles = [];
for (const f of inventory.importedFiles) {
  const p = f.source;
  let dest = null;
  if (p.startsWith('tools/') && p !== 'tools/index.html') dest = p.slice(6);
  else if (/^(?:js|css|fonts|img|RPG|media|assets|data)\//.test(p) || p.startsWith('inside-ai/assets/')) dest = p;
  else if (/^(favicon|apple-touch-icon)/.test(p)) dest = p;
  if (!dest || dest.endsWith('.scss')) continue;
  await writeStatic(p, dest);
  staticFiles.push('/' + dest);
}
await fs.writeFile(path.join(out, 'lib/tedt-org-tools-loader.js'), `(function(){if(document.querySelector('link[data-tedt-org-tools-css="true"]'))return;var link=document.createElement('link');link.rel='stylesheet';link.dataset.tedtOrgToolsCss='true';link.href=new URL(location.protocol==='file:'?'tedt-org-tools-local.css':'tedt-org-tools.css',document.currentScript.src).href;document.head.appendChild(link);}());\n`);
for (const entry of ['bootstrap-build', 'game-theory', 'inside-ai']) {
  const input = matter(await read('css/' + entry + '.scss')).content;
  const result = sass.compileString(input, {loadPaths:[path.join(source,'_sass'),path.join(source,'css')],style:'compressed',logger:sass.Logger.silent});
  await fs.writeFile(path.join(out, 'css/' + entry + '.css'), result.css);
  staticFiles.push('/css/' + entry + '.css');
}
const lessons = [];
for (const f of inventory.importedFiles.filter(f => /^(game-theory|math-guide|inside-ai)\/(?:[^/]+\/)?index\.html$/.test(f.source))) {
  const {data, content} = matter(await read(f.source));
  lessons.push({path:f.source.replace(/\/index\.html$/,''), ...data, content: await render(content, {page:data})});
}
await json('src/data/lessons.json', {lessons, gameData});
const excludedPaths = new Set(excludedPages.map(p=>p.path));
const pageUrls = htmlFiles.filter(f => f.source !== 'tools/index.html' && !excludedPaths.has('/'+f.source)).map(f => canonicalPath('/'+f.source.slice(6)));
pageUrls.push(...lessons.map(p=>'/'+p.path+'/'),'/RPG/world-map.html','/RPG/tile-map-viewer.html');
await json('reports/migration-routes.json', {site, sourceCommit:inventory.commit, catalog: catalog.map(t=>({slug:t.slug, launch:t.launch, migrated:t.migrated, status:t.status})), catalogRedirects:docRedirects, migratedPages:[...new Set(pageUrls)], staticFiles, excludedPages, retainedLaunchUrls: catalog.filter(t=>!t.migrated).map(t=>t.launch), retainedOriginalUrlPrefixes:['/RPG/Traveller/', '/tools/traveller-character-sheet', '/tools/traveller-ship-sheet']});
await json(path.join(out, 'catalog.json'), catalog.map(({html, ...t})=>t));
await fs.writeFile(path.join(out,'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
await fs.writeFile(path.join(out,'CNAME'), 'tools.tedt.org\n');
await fs.copyFile('README.md', path.join(out,'README.md'));
await fs.writeFile(path.join(out,'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['/', '/about/',...catalog.map(t=>'/about/'+t.slug+'/'),...new Set(pageUrls)].map(p=>`<url><loc>${escape(site+p)}</loc></url>`).join('')+'</urlset>');
const {execFileSync} = await import('node:child_process');
let commit='local';try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
await json(path.join(out,'version.json'),{commit,sourceCommit:inventory.commit,tools:catalog.length});
console.log(`Prepared ${catalog.length} catalog tools, ${new Set(pageUrls).size} tool pages, and ${staticFiles.length} supporting files.`);

await fs.mkdir(path.join(out,'css'), {recursive:true});
await fs.mkdir(path.join(out,'js'), {recursive:true});
await fs.copyFile('src/shared-header/embed.css',path.join(out,'css/tedt-header-embed.css'));
await fs.copyFile('src/shared-header/theme-init.js',path.join(out,'js/tedt-theme-init.js'));
