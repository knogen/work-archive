import fs from 'node:fs/promises';
await import('./sync-data.mjs');
const root=new URL('../',import.meta.url),out=new URL('../dist/',import.meta.url);
await fs.mkdir(out,{recursive:true});
for(const file of ['index.html','styles.css','app.js','data','assets']) await fs.cp(new URL(file,root),new URL(file,out),{recursive:true});
console.log('静态网站已构建到 dist/，可部署到任意静态托管服务。');
