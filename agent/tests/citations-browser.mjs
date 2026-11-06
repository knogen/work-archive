// Isolated synthetic-DOM regression. No live browser profile, API, or website is used.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {build} from 'esbuild';

const root=path.resolve(import.meta.dirname,'../..');
let executablePath=process.env.AGENT_BROWSER_EXECUTABLE||chromium.executablePath();
try{await fs.access(executablePath);}catch{
  const cache=path.join(process.env.LOCALAPPDATA||'','ms-playwright');
  let found=false;
  for(const directory of (await fs.readdir(cache)).filter(x=>/^chromium-\d+$/.test(x)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]))){
    for(const suffix of ['chrome-win64/chrome.exe','chrome-win/chrome.exe'])try{const candidate=path.join(cache,directory,suffix);await fs.access(candidate);executablePath=candidate;found=true;break;}catch{}
    if(found)break;
  }
  if(!found)throw Error('No isolated Chromium is installed. Run npx playwright install chromium.');
}

const compiled=await build({stdin:{contents:"import * as citations from './agent/citations.mjs';import {render} from './agent/markdown.mjs';window.CitationFixture={...citations,render};",resolveDir:root,sourcefile:'citation-fixture.mjs'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2020'});
const browser=await chromium.launch({headless:true,executablePath}),page=await browser.newPage();
const requests=[],errors=[];
await page.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.setContent('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Citation fixture</title><body></body></html>');
  await page.addScriptTag({content:compiled.outputFiles[0].text});
  const result=await page.evaluate(()=>{
    const {linkifyCitations,validArchiveCitation,isArchiveCitationHref,render}=window.CitationFixture;
    const ensure=(condition,message)=>{if(!condition)throw Error(message);};
    const verified=[
      {id:'m06905',title:'原文证据 m06905',date:'2023-02-08',href:'#/evidence/m06905',kind:'evidence'},
      {id:'m06942',title:'原文证据 m06942',date:'2023-02-16',href:'#/evidence/m06942',kind:'evidence'},
      {id:'project:knowledge-complexity',title:'知识复杂度与国家排名',date:'2023-08-04',href:'#/project/knowledge-complexity',kind:'project'},
      {id:'question:comparison',title:'<img src=x onerror="window.__citationXss=1">',date:'2023-01-01',href:'#/question/comparison',kind:'question'},
    ];
    const make=()=>{const element=document.createElement('div');document.body.append(element);return element;};
    const container=make();
    render(container,'已有两项结果[m06905][m06942]，见专题 [project:knowledge-complexity]。未知 [m09999] 保留。\n\n`[m06905]`\n\n```txt\n[m06942]\n```\n\n[已有链接 [m06905]](https://example.org/paper)');
    let navigations=[];
    const count=linkifyCitations(container,verified,(citation,event)=>navigations.push({id:citation.id,prevented:event.defaultPrevented}));
    ensure(count===3,'adjacent citations and Chinese text must generate exactly three anchors');
    ensure(container.querySelectorAll('a.agent-inline-citation').length===3,'inline anchors should have the shared class');
    ensure(container.textContent.includes('原文 m06905原文 m06942'),'adjacent citations must both be readable');
    ensure(container.textContent.includes('专题 · 知识复杂度与国家排名'),'project citation should use its readable title');
    ensure(container.textContent.includes('[m09999]'),'unknown citations stay literal');
    ensure(container.querySelector('code').textContent==='[m06905]','inline code stays literal');
    ensure(container.querySelector('pre code').textContent.includes('[m06942]'),'fenced code stays literal');
    ensure(container.querySelector('a[href="https://example.org/paper"]').textContent.includes('[m06905]'),'existing anchor text stays literal');
    const first=container.querySelector('a.agent-inline-citation');
    ensure(first.title.includes('m06905')&&first.title.includes('2023-02-08'),'tooltip preserves citation ID and date');
    ensure(first.getAttribute('href')==='#/evidence/m06905','citation href remains a same-site archive hash');
    first.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
    ensure(navigations.length===1&&navigations[0].id==='m06905'&&navigations[0].prevented,'the caller owns ordinary citation navigation');
    first.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0,ctrlKey:true}));
    ensure(navigations.length===1,'modified clicks preserve normal browser behavior');
    ensure(linkifyCitations(container,verified)===0,'linkifying twice must be idempotent');

    for(const href of ['https://evil.invalid/','#/evidence/m06905?token=private','javascript:window.__citationXss=1','data:text/html,test','//evil.invalid/x','#/project/../evidence/m06905','#/question/x%22onclick%3Dalert(1)','#/projects#evil',' #/project/x'])ensure(!isArchiveCitationHref(href),`invalid href accepted: ${href}`);
    ensure(validArchiveCitation(verified[0]),'verified evidence should be accepted');
    ensure(!validArchiveCitation({...verified[0],href:'#/evidence/m06942'}),'evidence ID must match its route');
    ensure(!validArchiveCitation({...verified[2],href:'#/project/other'}),'project ID must match its route');
    ensure(!validArchiveCitation({id:'__proto__',href:'#/projects'}),'forged IDs must be rejected');
    ensure(!validArchiveCitation({id:'question:comparison',href:'#/library/comparison'}),'record type and route must agree');
    ensure(validArchiveCitation({id:'document:file-abc',href:'#/library/file-abc'}),'document citations use library routes');
    ensure(validArchiveCitation({id:'event:20',href:'#/timeline?year=2022'}),'event citations may use filtered timelines');
    ensure(validArchiveCitation({id:'output:chart-1',href:'#/project/knowledge-complexity'}),'output citations may use their holding project');

    const unsafe=make();
    render(unsafe,'带标题的核验引用 [question:comparison]。伪造外链 [m08888]。\n\n<img src="https://evil.invalid/pixel" onerror="window.__citationXss=1">\n<script>window.__citationXss=1</script>');
    const linked=linkifyCitations(unsafe,[...verified,{id:'m08888',href:'https://evil.invalid/evidence',title:'external'}]);
    ensure(linked===1,'malicious href cannot create a citation link');
    ensure(unsafe.querySelector('a.agent-inline-citation').textContent.includes('<img'),'malicious citation title remains text');
    ensure(!unsafe.querySelector('img,script,iframe,svg'),'citation rendering must not create executable HTML');
    ensure(unsafe.textContent.includes('[m08888]'),'invalid server citation targets remain literal');
    ensure(window.__citationXss===undefined,'no citation/title/model HTML can execute');

    const literal=make();literal.textContent='<img src=x onerror=alert(1)>[m06905]';
    linkifyCitations(literal,verified);ensure(!literal.querySelector('img'),'text is never reparsed as HTML');
    const conflict=make();conflict.textContent='[event:2]';
    ensure(linkifyCitations(conflict,[{id:'event:2',href:'#/project/one'},{id:'event:2',href:'#/project/two'}])===0,'conflicting citation destinations must be ignored');
    const codeRoot=document.createElement('pre');codeRoot.textContent='[m06905]';document.body.append(codeRoot);
    ensure(linkifyCitations(codeRoot,verified)===0,'a code/pre container itself is excluded');
    return {ok:true,inlineCitations:count,checks:['adjacent Chinese references','readable verified labels','unknown ID literal','code/pre/a excluded','callback and modified click','idempotent','archive-only hrefs','ID-to-route binding','XSS title inert','sanitized HTML inert','conflicting target rejected']};
  });
  assert.equal(result.ok,true);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log(JSON.stringify(result));
}finally{await browser.close();}
