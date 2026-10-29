import fs from 'node:fs/promises';
import path from 'node:path';
const routes=JSON.parse(await fs.readFile('reports/migration-routes.json','utf8'));
const files=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else files.push(p);}}
await walk('dist');
const output = new Set(files.map(f=>f.slice(4)));
const resolves = p => output.has(p) || output.has(p.replace(/\/$/,'')+'/index.html');
const failures=[];
for(const p of routes.migratedPages)if(!resolves(p))failures.push('Missing tool page: '+p);
for(const t of routes.catalog){if(!resolves('/about/'+t.slug+'/'))failures.push('Missing detail: '+t.slug);if(t.migrated&&!resolves(new URL(t.launch).pathname))failures.push('Missing launch: '+t.launch);}
for(const f of files.filter(f=>f.endsWith('.html'))){
 const html=await fs.readFile(f,'utf8'), url=new URL(f.slice(4).replace(/index\.html$/,''),'https://tools.tedt.org');
 if(/{%\s*(?:include|assign|if|for|link|capture)|{{\s*(?:site\.|page\.|['"])/.test(html))failures.push('Unresolved Liquid: '+f);
 for(const m of html.matchAll(/<(script|img|source|link)\b([^>]+)>/gi)){
   const tag=m[1].toLowerCase(), attrs=m[2];
   if(tag==='link'&&!/rel=["'](?:stylesheet|icon|apple-touch-icon)["']/i.test(attrs))continue;
   const value=attrs.match(/(?:src|href)=["']([^"']+)["']/i)?.[1];
   if(!value||/^(?:data:|blob:|#)/.test(value)||value.includes('${'))continue;
   let u;try{u=new URL(value,url);}catch{continue;}
   if(u.hostname==='tools.tedt.org'&&!resolves(decodeURIComponent(u.pathname)))failures.push(`${f}: missing ${tag} ${u.pathname}`);
 }
}
const result={sourceCommit:routes.sourceCommit,htmlPages:files.filter(f=>f.endsWith('.html')).length,files:files.length,tools:routes.catalog.length,migratedToolPages:routes.migratedPages.length,failures:[...new Set(failures)]};
await fs.writeFile('reports/build-verification.json',JSON.stringify(result,null,2)+'\n');
if(failures.length){console.error(result.failures.join('\n'));process.exit(1);}
console.log(`Verified ${result.tools} tools, ${result.htmlPages} HTML pages, and ${result.files} published files.`);
