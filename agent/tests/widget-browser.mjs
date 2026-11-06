// Optional headless QA against the loopback preview. Uses an isolated browser profile.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.local/agent-qa');
await fs.mkdir(out,{recursive:true});
let executablePath=process.env.AGENT_BROWSER_EXECUTABLE||chromium.executablePath();
try{await fs.access(executablePath);}catch{
  const cache=path.join(process.env.LOCALAPPDATA||'', 'ms-playwright');
  const builds=(await fs.readdir(cache)).filter(name=>/^chromium-\d+$/.test(name)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]));
  let found=false;
  for(const build of builds){for(const suffix of ['chrome-win64/chrome.exe','chrome-win/chrome.exe']){
    const candidate=path.join(cache,build,suffix);try{await fs.access(candidate);executablePath=candidate;found=true;break;}catch{}
  }if(found)break;}
  if(!found)throw Error('No isolated Chromium installation is available. Run npx playwright install chromium.');
}
const browser=await chromium.launch({headless:true,executablePath});
const errors=[];
const requests=[],expectedMode=process.env.AGENT_EXPECT_AUTH_MODE||'public';
const recordRequest=request=>{
  if(!request.url().includes('/api/agent/chat'))return;
  const body=request.postDataJSON();requests.push({authorization:Boolean(request.headers().authorization),challenge:Boolean(body?.turnstileToken)});
};
const context=await browser.newContext({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('request',recordRequest);
const base=process.env.AGENT_PREVIEW_URL||'http://127.0.0.1:4174';
const assertText=async(selector,text)=>assert.ok((await page.locator(selector).textContent()).includes(text));
const waitDone=async()=>page.locator('.agent-flow[data-status="done"]').last().waitFor({timeout:20000});
try{
  const initial=await page.goto(base,{waitUntil:'networkidle'});assert.equal(initial.status(),200,'preview homepage must be available');
  await page.locator('.agent-launcher').click();
  await page.waitForFunction(()=>!document.querySelector('.agent-send').disabled);
  assert.equal(await page.evaluate(()=>window.WORK_ARCHIVE_AGENT.authMode),expectedMode,'preview uses the intended access mode');
  await assertText('.agent-preview-banner','回答为模拟');
  assert.equal(await page.locator('.agent-auth').isVisible(),false,'local preview must not require credentials');
  await page.screenshot({path:path.join(out,'01-desktop-ready.png')});
  await page.locator('#agent-question').fill('2022 年主要做了哪些工作？');
  await page.locator('.agent-send').click();
  await page.locator('.agent-flow-list>li[data-stage="generate"][data-status="running"]').waitFor({timeout:15000});
  await page.screenshot({path:path.join(out,'02-desktop-working.png')});
  await waitDone();
  await assertText('.agent-assistant .agent-message-text','本地流程演示');
  assert.ok(await page.locator('.agent-sources a').count()>0,'verified source links should render');
  const completedStages=await page.locator('.agent-flow-list>li[data-status="done"]').evaluateAll(rows=>rows.map(row=>row.dataset.stage));
  for(const stage of ['parse','evidence','count','budget','generate'])assert.ok(completedStages.includes(stage),`missing stage ${stage}`);
  await page.screenshot({path:path.join(out,'03-desktop-completed.png')});

  // The host site's slash shortcut must not open another modal while the agent has focus.
  await page.locator('.agent-reset').focus();await page.keyboard.press('/');
  assert.equal(await page.locator('#search-dialog').evaluate(el=>el.open),false);
  await page.locator('.agent-sources a').first().click();
  assert.equal(await page.locator('#archive-agent').evaluate(el=>el.open),false);
  assert.ok((await page.locator('#main').textContent()).length>100,'original route remains readable');
  await page.locator('.agent-launcher').click();await page.waitForFunction(()=>!document.querySelector('.agent-send').disabled);
  await page.locator('.agent-reset').click();
  assert.equal(await page.locator('.agent-message').count(),0);
  assert.equal(await page.locator('.agent-intro').isVisible(),true);

  // Stop a real local simulated generation and check the terminal workflow state.
  await page.locator('#agent-question').fill('GPC 有哪些已有尝试和待验证问题？');await page.locator('.agent-send').click();
  await page.locator('.agent-flow-list>li[data-stage="generate"][data-status="running"]').waitFor({timeout:15000});
  await page.locator('.agent-stop').click();
  await page.locator('.agent-flow[data-status="error"]').waitFor();
  await assertText('#agent-notice','已停止');
  await page.waitForFunction(()=>!document.querySelector('.agent-send').disabled);

  // A controlled endpoint fixture checks rendering, citation URL rejection, and repeated evidence links.
  const evil='<img src=x onerror="window.__agentXss=1">';
  await page.route('**/api/agent/chat',async route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({answer:evil,citations:[{id:'bad',title:evil,href:'javascript:window.__agentXss=1',date:'2022-01-01'},{id:'m00008',title:'原文证据 m00008',href:'#/evidence/m00008',date:'2018-11-10'}],cutoff:'2026-05-06'})}));
  await page.locator('#agent-question').fill('测试证据链接');await page.locator('.agent-send').click();await waitDone();
  assert.equal(await page.evaluate(()=>window.__agentXss),undefined);
  assert.equal(await page.locator('.agent-message-text img').count(),0);
  assert.equal(await page.locator('.agent-sources a[href^="javascript:"]').count(),0);
  await page.locator('.agent-sources a[href="#/evidence/m00008"]').click();
  await page.locator('#evidence-dialog[open]').waitFor();await assertText('#evidence-title','m00008');
  await page.locator('#evidence-dialog [data-action="close"]').click();
  await page.locator('.agent-launcher').click();await page.locator('.agent-sources a[href="#/evidence/m00008"]').click();
  await page.locator('#evidence-dialog[open]').waitFor();
  await page.locator('#evidence-dialog [data-action="close"]').click();

  await page.locator('.agent-launcher').click();
  await page.unroute('**/api/agent/chat');
  await page.route('**/api/agent/chat',route=>route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:{code:'daily_budget',message:'今日问答预算已用完，北京时间零点恢复。'}})}));
  await page.locator('#agent-question').fill('测试预算耗尽');await page.locator('.agent-send').click();
  await page.waitForFunction(()=>document.querySelector('#agent-notice').textContent.includes('今日问答预算已用完'));await assertText('#agent-notice','今日问答预算已用完');
  await page.screenshot({path:path.join(out,'04-desktop-budget-limit.png')});

  if(expectedMode==='public'){
    await page.unroute('**/api/agent/chat');
    await page.route('**/api/agent/chat',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{code:'unavailable',message:'问答服务暂时不可用，请稍后重试。'}})}));
    await page.locator('#agent-question').fill('测试服务错误');await page.locator('.agent-send').click();
    await page.waitForFunction(()=>document.querySelector('#agent-notice').textContent.includes('问答服务暂时不可用'));
    assert.equal(await page.locator('.agent-auth').isVisible(),false,'public failures never introduce a passphrase gate');
  }

  // Separate mobile context prevents any reuse of the desktop page's application state.
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const phone=await mobile.newPage();phone.on('pageerror',error=>errors.push(error.message));phone.on('request',recordRequest);
  await phone.goto(base,{waitUntil:'networkidle'});await phone.locator('.agent-launcher').click();
  await phone.waitForFunction(()=>!document.querySelector('.agent-send').disabled);
  const layout=await phone.locator('#archive-agent').evaluate(el=>({scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,height:el.getBoundingClientRect().height,viewHeight:innerHeight}));
  assert.ok(layout.scrollWidth<=layout.clientWidth+1,'mobile panel must not overflow horizontally');
  assert.ok(Math.abs(layout.height-layout.viewHeight)<=2,'mobile panel uses the viewport height');
  await phone.screenshot({path:path.join(out,'05-mobile-ready.png')});
  await phone.locator('#agent-question').fill('GPC 有哪些已有尝试和待验证问题？');await phone.locator('.agent-send').click();
  await phone.locator('.agent-flow-list>li[data-stage="generate"][data-status="running"]').waitFor({timeout:15000});
  await phone.screenshot({path:path.join(out,'06-mobile-working.png')});
  await phone.locator('.agent-flow[data-status="done"]').waitFor({timeout:20000});
  await phone.screenshot({path:path.join(out,'07-mobile-completed.png')});
  await mobile.close();
  if(expectedMode==='public'){
    assert.ok(requests.length>=3,'public request transport exercised');
    assert.ok(requests.every(request=>!request.authorization&&!request.challenge),'public requests contain neither Authorization nor challenge tokens');
  }
  assert.deepEqual(errors,[],'browser runtime errors');
  console.log(JSON.stringify({ok:true,base,authMode:expectedMode,completedStages,screenshots:out,checks:['desktop','mobile','trace','citations','stop','new conversation','budget error','original routes','slash shortcut','XSS rejection','repeated evidence link',...(expectedMode==='public'?['public without credentials','no Authorization header','public error without passphrase']:[])]}));
}catch(error){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});console.error(JSON.stringify({errors,url:page.url(),title:await page.title(),body:(await page.locator('body').textContent()).slice(0,500)}));throw error;}
finally{await browser.close();}
