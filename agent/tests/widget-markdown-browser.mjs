// Browser regression for public-mode Markdown rendering. All generation is a local fixture.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const out=path.resolve(import.meta.dirname,'../../.local/agent-qa');await fs.mkdir(out,{recursive:true});
let executablePath=process.env.AGENT_BROWSER_EXECUTABLE||chromium.executablePath();
try{await fs.access(executablePath);}catch{
  const cache=path.join(process.env.LOCALAPPDATA||'','ms-playwright');
  for(const build of (await fs.readdir(cache)).filter(x=>/^chromium-\d+$/.test(x)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]))){
    let found=false;for(const suffix of ['chrome-win64/chrome.exe','chrome-win/chrome.exe'])try{const candidate=path.join(cache,build,suffix);await fs.access(candidate);executablePath=candidate;found=true;break;}catch{}if(found)break;
  }
}
const markdown=[
  '# Markdown 档案回答',
  '中文分块渲染：知识复杂度，测试通过。 **重点** 与 *说明*。',
  '## 已有工作',
  '- 第一项\n- 第二项',
  '1. 先核对证据\n2. 再提出建议',
  '| 年份与阶段说明 | 对应的研究专题 | 已经完成的工作 | 后续仍需核验的事项 | 原文来源编号 |\n| --- | --- | --- | --- | --- |\n| 2022 | GPC | 历史记录 | 待验证 | m00008 |',
  '```js\nconst html = \'<img src=x onerror="window.__agentXss=1">\';\nconsole.log("中文代码");\n```',
  '> 这是一段引用，只说明历史记录。',
  '[安全链接](https://example.com/research) · [危险链接](javascript:window.__agentXss=1) · [data链接](data:text/html;base64,PHNjcmlwdD4=)',
  '已有证据 [m06905] [m06942]，所属专题 [project:knowledge-complexity]。',
  '![外部跟踪图](https://tracking.invalid/pixel.png)',
  '<script>window.__agentXss=1</script>\n<img src="https://tracking.invalid/raw.png" onerror="window.__agentXss=1">\n<svg onload="window.__agentXss=1"></svg>',
].join('\n\n');
const citations=[{id:'m06905',title:'原文证据 m06905',href:'#/evidence/m06905',date:'2022-11-10'},{id:'m06942',title:'原文证据 m06942',href:'#/evidence/m06942',date:'2022-11-14'},{id:'project:knowledge-complexity',title:'知识复杂度与国家排名',href:'#/project/knowledge-complexity',date:'2022-11-10'}];
const browser=await chromium.launch({headless:true,executablePath}),context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage();
const errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(request.url().includes('tracking.invalid'))remote.push(request.url());});
await page.addInitScript(({answer,refs})=>{
  const nativeFetch=window.fetch.bind(window);window.__mdRequests=[];
  window.fetch=async(input,init)=>{
    if(!String(input).endsWith('/api/agent/chat'))return nativeFetch(input,init);
    const headers=new Headers(init?.headers);window.__mdRequests.push({authorization:headers.has('Authorization')});
    const frame=(event,data)=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const bytes=new TextEncoder().encode(frame('trace',{stage:'generate',label:'生成测试回答',status:'running'})+frame('delta',{text:answer})+frame('done',{answer,citations:refs,cutoff:'2026-05-06',version:'fixture',budget:{remainingUsd:1,limitUsd:1}}));
    let offset=0;
    return new Response(new ReadableStream({pull(controller){if(offset>=bytes.length){controller.close();return;}const size=1+offset%7;controller.enqueue(bytes.slice(offset,offset+size));offset+=size;}}),{headers:{'Content-Type':'text/event-stream; charset=utf-8'}});
  };
},{answer:markdown,refs:citations});
try{
  await page.goto(process.env.AGENT_PREVIEW_URL||'http://127.0.0.1:4175',{waitUntil:'networkidle'});
  await page.locator('.agent-launcher').click();await page.waitForFunction(()=>!document.querySelector('.agent-send').disabled);
  assert.equal(await page.evaluate(()=>window.WORK_ARCHIVE_AGENT.authMode),'public');
  assert.equal(await page.locator('.agent-auth').isVisible(),false);
  await page.locator('#agent-question').fill('# 我的问题 **保持原文**');await page.locator('.agent-send').click();
  await page.locator('.agent-flow[data-status="done"]').waitFor();
  const answer=page.locator('.agent-assistant .agent-markdown');
  assert.equal(await answer.locator('h1').textContent(),'Markdown 档案回答');
  assert.equal(await answer.locator('h2').textContent(),'已有工作');
  assert.equal(await answer.locator('ul>li').count(),2);assert.equal(await answer.locator('ol>li').count(),2);
  assert.equal(await answer.locator('table tbody tr').count(),1);assert.equal(await answer.locator('th').count(),5);
  assert.ok((await answer.locator('pre code').textContent()).includes('<img src=x onerror='));
  assert.ok((await answer.locator('blockquote').textContent()).includes('历史记录'));
  assert.ok((await answer.textContent()).includes('中文分块渲染：知识复杂度，测试通过。'));
  assert.ok(!(await answer.textContent()).includes('\ufffd'),'split UTF-8 must not corrupt Chinese text');
  assert.equal(await answer.locator('script,img,svg,iframe').count(),0);
  assert.equal(await answer.locator('a[href^="javascript:"],a[href^="data:"]').count(),0);
  assert.equal(await answer.locator('a[href="https://example.com/research"]').count(),1);
  assert.equal(await answer.locator('.agent-inline-citation').count(),3);
  assert.equal(await answer.locator('.agent-inline-citation[data-citation-id="m06905"]').textContent(),'原文 m06905');
  assert.ok((await answer.locator('.agent-inline-citation[data-citation-id="project:knowledge-complexity"]').textContent()).includes('知识复杂度'));
  assert.equal(await page.locator('.agent-user h1,.agent-user strong').count(),0);
  assert.equal(await page.locator('.agent-user .agent-message-text').textContent(),'# 我的问题 **保持原文**');
  assert.equal(await page.evaluate(()=>window.__agentXss),undefined);assert.deepEqual(remote,[]);
  assert.ok((await page.evaluate(()=>window.__mdRequests)).every(request=>!request.authorization));
  // Verified inline citations and footer sources both return to the original answer and scroll position.
  const originalHash=await page.evaluate(()=>location.hash),originalAnswer=await answer.textContent();
  await page.locator('.agent-flow').evaluate(el=>{el.open=false;});
  await answer.locator('[data-citation-id="project:knowledge-complexity"]').scrollIntoViewIfNeeded();
  const originalScroll=await page.locator('.agent-feed').evaluate(el=>el.scrollTop);
  await answer.locator('[data-citation-id="project:knowledge-complexity"]').click();
  await page.waitForFunction(()=>location.hash==='#/project/knowledge-complexity');await page.locator('.agent-return:not([hidden])').waitFor();
  await page.screenshot({path:path.join(out,'10-project-return-to-chat.png')});
  await page.locator('.agent-return').click();await page.locator('#archive-agent[open]').waitFor();
  await page.waitForFunction(hash=>location.hash===hash,originalHash);
  assert.equal(await answer.textContent(),originalAnswer);
  await page.waitForFunction(scroll=>Math.abs(document.querySelector('.agent-feed').scrollTop-scroll)<3,originalScroll);
  assert.equal(await page.locator('.agent-user').count(),1);
  await answer.locator('[data-citation-id="m06905"]').click();await page.locator('#evidence-dialog[open]').waitFor();
  await page.screenshot({path:path.join(out,'11-evidence-return-to-chat.png')});
  await page.locator('.agent-evidence-return:not([hidden])').click();await page.locator('#archive-agent[open]').waitFor();
  assert.equal(await answer.textContent(),originalAnswer);
  // A second visit to the same inline evidence still opens its native dialog and returns correctly.
  await answer.locator('[data-citation-id="m06905"]').click();await page.locator('#evidence-dialog[open]').waitFor();
  await page.locator('.agent-evidence-return').click();await page.locator('#archive-agent[open]').waitFor();
  await page.locator('.agent-sources a[href="#/evidence/m06942"]').click();await page.locator('#evidence-dialog[open]').waitFor();
  await page.locator('.agent-evidence-return').click();await page.locator('#archive-agent[open]').waitFor();
  await page.locator('.agent-close').click();
  await page.locator('a[data-nav="projects"]').click();
  assert.equal(await page.locator('.agent-return').isVisible(),false,'ordinary navigation must not create a return-to-chat state');
  await page.locator('.agent-launcher').click();await page.waitForFunction(()=>!document.querySelector('.agent-send').disabled);
  await page.locator('.agent-flow').evaluate(el=>{el.open=false;});await page.locator('.agent-feed').evaluate(el=>{el.scrollTop=0;});
  await page.screenshot({path:path.join(out,'08-desktop-markdown.png')});
  await page.setViewportSize({width:390,height:844});
  const table=await answer.locator('table').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));assert.ok(table.scroll>table.client,'wide mobile tables scroll horizontally');
  const panel=await page.locator('#archive-agent').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));assert.ok(panel.scroll<=panel.client+1,'Markdown must not widen the mobile panel');
  await page.screenshot({path:path.join(out,'09-mobile-markdown.png')});
  await page.setViewportSize({width:1440,height:1100});await answer.locator('[data-citation-id="project:knowledge-complexity"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,'12-inline-citation-links.png')});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,markdown:true,authMode:'public',checks:['headings','unordered/ordered lists','table','fenced code literal','blockquote','safe links','raw HTML rejected','remote images blocked','UTF-8 split stream','user remains plain text','public without Authorization','mobile horizontal table scroll','inline verified citations','project return preserves answer and scroll','evidence return inside dialog','repeated evidence return','footer return','ordinary navigation unaffected'],screenshots:out}));
}catch(error){await page.screenshot({path:path.join(out,'markdown-failure.png')}).catch(()=>{});console.error(JSON.stringify({errors}));throw error;}
finally{await browser.close();}
