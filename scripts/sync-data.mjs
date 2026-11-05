import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile(new URL('../data/archive.json',import.meta.url),'utf8'));
await fs.writeFile(new URL('../data/archive.js',import.meta.url),'window.WORK_ARCHIVE = '+JSON.stringify(data)+';\n');
console.log('已从 data/archive.json 更新浏览器数据。');
