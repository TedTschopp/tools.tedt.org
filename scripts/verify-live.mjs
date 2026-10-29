import fs from 'node:fs/promises';
const routes=JSON.parse(await fs.readFile('reports/migration-routes.json','utf8'));
const cases=[];
for(const path of ['/tools','/tools/','/tools/index.html'])cases.push({from:path,to:'/'});
for(const r of routes.catalogRedirects)for(const from of [r.from,r.from.slice(0,-1),r.from+'index.html'])cases.push({from,to:r.to});
for(const next of routes.migratedPages){const related=/^\/(?:game-theory|math-guide|inside-ai|RPG)\//.test(next);cases.push({from:related?next:'/tools'+next,to:next});}
for(const p of ['/css/game-theory.css','/css/inside-ai.css','/js/game-theory/playground.mjs'])cases.push({from:p,to:p});
for(const p of ['/tools/morph.html','/tools/social-bot-check.html','/tools/color-chart/'])cases.push({from:p+'?migration_check=1&value=two%20words',to:(p==='/tools/color-chart/'?'/about/color-chart/':p.slice(6))+'?migration_check=1&value=two%20words'});
const retained=['/RPG/Traveller/Character-Sheet.html','/RPG/Traveller/Ship-Sheet.html','/tools/traveller-character-sheet/','/tools/traveller-ship-sheet/','/'];
const results=[];let next=0;
async function worker(){while(next<cases.length){const c=cases[next++];try{const response=await fetch('https://tedt.org'+c.from,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(20000)});const target=response.headers.get('location');const expected='https://tools.tedt.org'+c.to;results.push({...c,status:response.status,location:target,ok:response.status===301&&target===expected});}catch(e){results.push({...c,ok:false,error:String(e)});}}}
await Promise.all(Array.from({length:8},worker));
for(const path of retained){try{const r=await fetch('https://tedt.org'+path,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(20000)});results.push({retained:path,status:r.status,location:r.headers.get('location'),ok:r.status===200&&!r.headers.get('location')});}catch(e){results.push({retained:path,ok:false,error:String(e)});}}
const resources=[['/ocr-tool/vendor/tesseract-core/tesseract-core-simd.wasm','application/wasm'],['/inside-ai/assets/runtime/ort-wasm-simd-threaded.wasm','application/wasm'],['/social-bot-check/app.js','javascript'],['/css/bootstrap-build.css','text/css'],['/catalog.json','application/json'],['/media/files/Three_computer-based_models_of_storytelling_BRUTUS.pdf','application/pdf']];
for(const [path,type] of resources){try{const r=await fetch('https://tools.tedt.org'+path,{method:'HEAD',signal:AbortSignal.timeout(20000)});const contentType=r.headers.get('content-type')||'';results.push({resource:path,status:r.status,contentType,ok:r.status===200&&contentType.includes(type)});}catch(e){results.push({resource:path,ok:false,error:String(e)});}}
const version=await(await fetch('https://tools.tedt.org/version.json?verify='+Date.now())).json();
const report={site:'https://tools.tedt.org/',version,redirectsChecked:cases.length,retainedUrlsChecked:retained.length,resourceTypesChecked:resources.length,results,failures:results.filter(r=>!r.ok)};
await fs.writeFile('reports/live-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({version,redirectsChecked:cases.length,retainedUrlsChecked:retained.length,resourceTypesChecked:resources.length,failures:report.failures},null,2));if(report.failures.length)process.exit(1);
