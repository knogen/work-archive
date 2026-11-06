import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'assets/vendor'),require=createRequire(import.meta.url);
const packages=[{name:'marked',version:'18.1.3',licenses:['LICENSE']},{name:'dompurify',version:'3.4.17',licenses:['LICENSE','LICENSE-MPL']}];
await fs.mkdir(out,{recursive:true});
for(const pkg of packages){
  const directory=path.resolve(path.dirname(require.resolve(pkg.name)),'..');
  const metadata=JSON.parse(await fs.readFile(path.join(directory,'package.json'),'utf8'));
  if(metadata.version!==pkg.version)throw Error(`Expected ${pkg.name}@${pkg.version}; run npm ci before rebuilding the vendor bundle.`);
  for(const license of pkg.licenses)await fs.copyFile(path.join(directory,license),path.join(out,`${pkg.name}.${license}.txt`));
}
await build({entryPoints:[path.join(root,'agent/markdown.mjs')],outfile:path.join(out,'agent-markdown.min.js'),bundle:true,format:'iife',globalName:'ArchiveMarkdown',platform:'browser',target:'es2020',minify:true,legalComments:'eof',banner:{js:'/* Work Archive Markdown: marked 18.1.3 + DOMPurify 3.4.17. Licenses are shipped beside this file. */'}});
await fs.writeFile(path.join(out,'README.md'),'# Local Markdown renderer\n\nBuilt from `agent/markdown.mjs` using fixed versions of marked 18.1.3 (MIT) and DOMPurify 3.4.17 (MPL-2.0 OR Apache-2.0). Full upstream licenses are included beside the bundle.\n\nRun `npm ci` and `npm run agent:vendor` to rebuild. No CDN or external script is loaded at runtime.\n');
console.log('Built local Markdown parser/sanitizer bundle and retained upstream licenses in assets/vendor/.');
