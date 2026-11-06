import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Miniflare} from 'miniflare';
import {build} from 'esbuild';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),port=Number(process.env.AGENT_PREVIEW_PORT||4174),base=`http://127.0.0.1:${port}`;
const corpus=JSON.parse(await fs.readFile(path.join(root,'.local/agent-release/corpus.json'),'utf8'));
const bundled=await build({entryPoints:[path.join(root,'agent/tests/preview-worker.mjs')],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
const mf=new Miniflare({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-07-01',kvNamespaces:['ARCHIVE_CORPUS'],durableObjects:{BUDGET_LEDGER:{className:'BudgetLedger',useSQLite:true}},bindings:{DAILY_BUDGET_USD:'1',AUTH_MODE:'token',ALLOWED_ORIGINS:base,CORPUS_VERSION:corpus.version,OPENAI_MODEL:'local-preview-model',INPUT_USD_PER_MILLION:'0.25',OUTPUT_USD_PER_MILLION:'2',OPENAI_API_KEY:'local-preview-not-a-real-openai-key',AGENT_ACCESS_TOKEN:'local-preview-access-token-not-secret'}});
const kv=await mf.getKVNamespace('ARCHIVE_CORPUS');await kv.put(`corpus:${corpus.version}`,JSON.stringify(corpus));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.pdf':'application/pdf'};
const publicFiles=new Set(['/','/index.html','/app.js','/styles.css','/agent-widget.js','/agent-widget.css']);
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,base),pathname=decodeURIComponent(url.pathname);
    if(pathname==='/agent-config.js'){
      res.writeHead(200,{'Content-Type':types['.js'],'Cache-Control':'no-store'});return res.end(`window.WORK_ARCHIVE_AGENT=${JSON.stringify({apiBase:`${base}/api/agent`,authMode:'token',preview:true,demoAccessToken:'local-preview-access-token-not-secret',turnstileSiteKey:''})};`);
    }
    if(pathname.startsWith('/api/agent/')){
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>24576){res.writeHead(413);return res.end('Request too large');}chunks.push(chunk);}
      const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(','):v);
      headers.set('CF-Connecting-IP',req.socket.remoteAddress||'127.0.0.1');
      const controller=new AbortController();res.on('close',()=>controller.abort());
      const response=await mf.dispatchFetch(url.href,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks),signal:controller.signal});
      res.writeHead(response.status,Object.fromEntries(response.headers));
      if(response.body)for await(const chunk of response.body){if(res.destroyed)break;res.write(chunk);}return res.end();
    }
    if(pathname.split('/').some(p=>p.startsWith('.'))||(!publicFiles.has(pathname)&&!/^\/(?:assets|data)\//.test(pathname))){res.writeHead(404);return res.end('Not found');}
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(404);return res.end('Not found');}
    const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(bytes);
  }catch{if(!res.headersSent)res.writeHead(503);res.end('Local preview unavailable');}
});
server.listen(port,'127.0.0.1',()=>console.log(`LOCAL ONLY: ${base} — real retrieval / private KV / SQLite budget, simulated OpenAI (no external API calls)`));
async function shutdown(){server.close();await mf.dispose();process.exit(0);}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
