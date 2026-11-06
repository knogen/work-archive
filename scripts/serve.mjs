import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.pdf':'application/pdf','.wav':'audio/wav','.mp4':'video/mp4'};
http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const publicFiles=new Set(['/','/index.html','/styles.css','/app.js','/agent-config.js','/agent-widget.js','/agent-widget.css']);
    if(pathname.split('/').some(part=>part.startsWith('.'))||(!publicFiles.has(pathname)&&!/^\/(?:data|assets)\//.test(pathname))){res.writeHead(404);return res.end('Not found');}
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden');}
    const bytes=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('文件未收录或不存在');}
}).listen(port,'127.0.0.1',()=>console.log(`工作档案 http://127.0.0.1:${port}`));
