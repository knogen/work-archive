(() => {
  'use strict';
  const config=window.WORK_ARCHIVE_AGENT||{},api=String(config.apiBase||'').replace(/\/$/,''),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const turnstileMode=config.authMode==='turnstile';
  // The preview credential is injected only by the loopback demo server, never by the static config.
  const preview=Boolean(config.preview)&&['127.0.0.1','localhost'].includes(location.hostname)&&api.startsWith(`${location.origin}/`);
  let history=[],accessToken=preview?String(config.demoAccessToken||''):'',abortController=null,challenge='',challengeId=null,busy=false;
  const launcher=document.createElement('button');launcher.className='agent-launcher';launcher.type='button';launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-controls','archive-agent');
  launcher.innerHTML='<span aria-hidden="true">↗</span> 问档案 <small>ASK</small>';
  const panel=document.createElement('dialog');panel.id='archive-agent';panel.className='agent-panel';panel.setAttribute('aria-labelledby','agent-heading');
  panel.innerHTML=`<div class="agent-head"><div><span class="agent-eyebrow">WORK ARCHIVE / 问答</span><h2 id="agent-heading">向档案提问<span aria-hidden="true">↙</span></h2></div><button type="button" class="agent-close" aria-label="关闭问答">×</button></div>
    <div class="agent-scope"><span class="agent-dot" aria-hidden="true"></span><span id="agent-service">${api?'正在检查服务…':'问答服务待连接'}</span><button type="button" class="agent-reset">新对话</button></div>
    ${preview?'<div class="agent-preview-banner"><strong>本地流程演示</strong><span>真实检索与预算流程 · 回答为模拟 · 不调用 OpenAI</span></div>':''}
    <div class="agent-feed" id="agent-feed" role="log" aria-label="档案问答记录" aria-relevant="additions text"><div class="agent-intro"><span class="agent-index">01 / 从记录中寻找</span><h3>把时间、主题和线索<br>连成一个回答。</h3><p>依据已审阅的脱敏工作摘录与文档摘要回答，附可回查的来源。资料截止 <time>${esc(window.WORK_ARCHIVE?.meta?.end||'2026-05-06')}</time>。</p><div class="agent-suggestions"><button type="button">2022 年主要做了哪些工作？</button><button type="button">GPC 有哪些已有尝试和待验证问题？</button><button type="button">知识复杂度研究最后进展到哪里？</button></div></div></div>
    <div class="agent-auth" ${turnstileMode||accessToken?'hidden':''}><label for="agent-passphrase">问答访问口令</label><div><input id="agent-passphrase" type="password" autocomplete="off" placeholder="输入访问口令" maxlength="200"><button type="button" class="agent-connect">连接</button></div><p>口令仅在本次页面内使用。</p></div>
    <div class="agent-challenge" ${turnstileMode?'':'hidden'}></div>
    <form class="agent-form"><label class="sr-only" for="agent-question">向档案提问</label><textarea id="agent-question" rows="2" maxlength="1200" placeholder="例如：这项研究后来有了哪些进展？"></textarea><div class="agent-compose-bottom"><span id="agent-context">全部工作档案</span><button type="button" class="agent-stop" hidden>停止</button><button type="submit" class="agent-send">提问 <span aria-hidden="true">↑</span></button></div></form>
    <div class="agent-foot"><span id="agent-budget">每日总预算 $1 · 北京时间零点恢复</span><span id="agent-notice" role="status" aria-live="polite"></span></div>`;
  document.body.append(launcher,panel);
  const $=selector=>panel.querySelector(selector),feed=$('.agent-feed'),input=$('#agent-question'),notice=$('#agent-notice');
  let serviceReady=false;
  function context(){
    const parts=location.hash.split('?')[0].split('/');
    if(parts[1]==='project')return {projectId:parts[2]};
    if(parts[1]==='question')return {questionId:parts[2]};
    return {};
  }
  function showContext(){
    const value=context(),archive=window.WORK_ARCHIVE;
    const record=value.projectId?archive?.projects.find(p=>p.id===value.projectId):value.questionId?archive?.questions.find(q=>q.id===value.questionId):null;
    $('#agent-context').textContent=record?`当前档案：${record.title}`:'全部工作档案';
  }
  function refresh(){
    $('.agent-send').disabled=busy||!serviceReady||(!turnstileMode&&!accessToken)||(turnstileMode&&!challenge);
    $('.agent-stop').hidden=!busy;input.disabled=busy;
    $('.agent-reset').disabled=busy;$('.agent-connect').disabled=busy;
  }
  async function checkService(){
    if(!api){notice.textContent='可以继续浏览与搜索档案；连接问答服务后即可提问。';refresh();return;}
    let parsed;try{parsed=new URL(api,location.href);}catch{notice.textContent='问答服务地址无效。';return;}
    if(parsed.protocol!=='https:'&&!(parsed.protocol==='http:'&&['127.0.0.1','localhost'].includes(parsed.hostname))){notice.textContent='问答服务需要 HTTPS。';return;}
    try{
      const response=await fetch(`${api}/health`,{cache:'no-store',signal:AbortSignal.timeout(10000)}),data=await response.json();
      if(!response.ok||data.status!=='ready')throw Error(data.error?.message||'问答服务暂不可用。');
      if(data.authMode!==config.authMode)throw Error('问答访问方式与服务配置不一致。');
      serviceReady=true;$('#agent-service').textContent=`${preview?'演示已就绪 · ':''}资料截止 ${data.cutoff}`;
      $('#agent-budget').textContent=`${preview?'演示预算':'每日总预算'} $${data.dailyBudgetUsd} · 北京时间零点恢复`;
      panel.classList.add('agent-ready');notice.textContent=turnstileMode?'完成人机验证后即可提问。':accessToken?'可以提问了。':'输入访问口令后即可提问。';
    }catch(error){serviceReady=false;$('#agent-service').textContent='服务暂未就绪';notice.textContent=error.name==='TimeoutError'?'连接超时，请稍后重试。':error.message;}
    refresh();
  }
  async function setupChallenge(){
    if(!turnstileMode||challengeId!==null||!api)return;
    if(!config.turnstileSiteKey){notice.textContent='人机验证尚未配置。';return;}
    try{
      if(!window.turnstile)await new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=resolve;script.onerror=reject;document.head.append(script);
      });
      challengeId=window.turnstile.render($('.agent-challenge'),{sitekey:config.turnstileSiteKey,action:'archive_chat',callback:token=>{challenge=token;refresh();},'expired-callback':()=>{challenge='';refresh();},'error-callback':()=>{challenge='';notice.textContent='验证未完成，请重试。';refresh();}});
    }catch{notice.textContent='无法加载人机验证，请检查网络后重试。';}
  }
  function resetChallenge(){challenge='';if(challengeId!==null)window.turnstile?.reset(challengeId);}
  function scroll(){feed.scrollTop=feed.scrollHeight;}
  function bubble(role,text){
    const article=document.createElement('article');article.className=`agent-message agent-${role}`;
    const label=document.createElement('span');label.className='agent-message-label';label.textContent=role==='user'?'你的问题':'档案回答';
    const content=document.createElement('div');content.className='agent-message-text';content.textContent=text;article.append(label,content);feed.append(article);scroll();return {article,content};
  }
  function sources(article,citations){
    if(!citations?.length)return;
    const list=document.createElement('div');list.className='agent-sources';const title=document.createElement('span');title.textContent='回查来源';list.append(title);
    for(const citation of citations){
      // Only same-site archive routes can become links, even if an endpoint is misconfigured.
      if(!/^#\/(?:project|question|library|evidence)\/[a-zA-Z0-9-]+$|^#\/timeline(?:\?year=\d{4})?$|^#\/projects$/.test(citation.href))continue;
      const a=document.createElement('a');a.href=citation.href;a.textContent=`${citation.date?.slice(0,10)||''} · ${citation.title}`;
      a.addEventListener('click',()=>{panel.close();if(location.hash===citation.href&&citation.href.startsWith('#/evidence/'))window.dispatchEvent(new CustomEvent('archive:open-evidence',{detail:citation.href.slice('#/evidence/'.length)}));});list.append(a);
    }
    article.append(list);
  }
  async function* events(stream){
    const reader=stream.getReader(),decoder=new TextDecoder();let buffer='';
    try{while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});buffer=buffer.replace(/\r\n/g,'\n');let end;
      while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);const type=frame.match(/^event:\s*(.+)$/m)?.[1],data=frame.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');if(data)yield {type,data:JSON.parse(data)};}
      if(buffer.length>1000000)throw Error('回答数据异常。');if(done)break;
    }}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
  const flowStages=[['parse','解析问题'],['lexical','关键词检索'],['time','时间索引'],['topic','主题索引'],['rank','合并排序'],['evidence','选取原文证据'],['count','核对输入 tokens'],['budget','预留今日预算'],['generate','生成回答']];
  function createFlow(article){
    const started=performance.now(),details=document.createElement('details');details.className='agent-flow';details.open=true;
    const summary=document.createElement('summary'),title=document.createElement('span'),state=document.createElement('span');title.textContent='本次查阅流程';state.className='agent-flow-state';state.textContent='正在连接';summary.append(title,state);
    const list=document.createElement('ol'),rows=new Map();list.className='agent-flow-list';
    for(const [stage,label]of flowStages){
      const li=document.createElement('li');li.dataset.stage=stage;li.dataset.status='pending';
      const marker=document.createElement('span');marker.className='agent-flow-marker';marker.setAttribute('aria-hidden','true');marker.textContent=String(rows.size+1).padStart(2,'0');
      const copy=document.createElement('div'),heading=document.createElement('span'),detail=document.createElement('small');heading.className='agent-flow-label';heading.textContent=label;detail.className='agent-flow-detail';copy.append(heading,detail);li.append(marker,copy);list.append(li);rows.set(stage,{li,heading,detail});
    }
    details.append(summary,list);article.insertBefore(details,article.querySelector('.agent-message-text'));
    function update(event){
      const stage=event.stage||event.phase||event.step,row=rows.get(stage);if(!row)return;
      row.li.dataset.status=['running','done','error','skipped'].includes(event.status)?event.status:'done';
      if(typeof event.label==='string')row.heading.textContent=event.label.slice(0,100);
      const pieces=[];
      if(typeof event.detail==='string')pieces.push(event.detail.slice(0,200));
      if(Number.isFinite(event.count))pieces.push(`${event.count.toLocaleString()} ${stage==='count'?'input tokens':stage==='evidence'?'条证据':'项'}`);
      if(Number.isFinite(event.inputTokens))pieces.push(`${event.inputTokens.toLocaleString()} input tokens`);
      if(Number.isFinite(event.tokens))pieces.push(`${event.tokens.toLocaleString()} tokens`);
      if(Number.isFinite(event.reservedUsd))pieces.push(`预留 $${event.reservedUsd.toFixed(6)}`);
      if(Number.isFinite(event.remainingUsd))pieces.push(`可用 $${event.remainingUsd.toFixed(3)}`);
      if(event.time?.from&&event.time?.to)pieces.push(`${event.time.from} — ${event.time.to}`);
      if(Array.isArray(event.topics)&&event.topics.length)pieces.push(event.topics.slice(0,3).map(t=>typeof t==='string'?t:t.title).filter(Boolean).join('、'));
      row.detail.textContent=pieces.join(' · ');
      row.li.querySelector('.agent-flow-nodes')?.remove();
      if(Array.isArray(event.nodes)&&event.nodes.length){
        const nodeList=document.createElement('ul');nodeList.className='agent-flow-nodes';
        for(const node of event.nodes.slice(0,3)){const li=document.createElement('li');li.textContent=`${String(node.id||'').slice(0,90)} · ${String(node.title||'').slice(0,90)}`;nodeList.append(li);}
        row.detail.parentElement.append(nodeList);
      }
      state.textContent=event.status==='running'?`正在${row.heading.textContent}`:`${row.heading.textContent} ✓`;
      details.dataset.status='running';scroll();
    }
    function finish(ok,message){
      for(const row of rows.values()){
        if(row.li.dataset.status==='running')row.li.dataset.status=ok?'done':'error';
        if(row.li.dataset.status==='pending'){row.li.dataset.status='skipped';if(!row.detail.textContent)row.detail.textContent='本次未执行';}
      }
      details.dataset.status=ok?'done':'error';state.textContent=message||`${ok?'查阅完成':'流程中断'} · ${((performance.now()-started)/1000).toFixed(1)}s`;
    }
    return {update,finish};
  }
  function historyForRequest(){
    const result=[];let length=0;
    for(const item of history.slice(-6).reverse()){
      const content=item.content.slice(0,3000);if(length+content.length>6000)break;
      result.unshift({role:item.role,content});length+=content.length;
    }
    // Start at a user message rather than an orphaned assistant response.
    if(result[0]?.role==='assistant')result.shift();
    return result;
  }
  function budget(value){if(value)$('#agent-budget').textContent=`${preview?'演示剩余额度':'今日剩余额度'} $${Number(value.remainingUsd).toFixed(3)} / $${value.limitUsd} · 北京时间零点恢复`;}
  async function submit(event){
    event?.preventDefault();if(busy||$('.agent-send').disabled)return;
    const question=input.value.trim();if(question.length<2){notice.textContent='请至少输入两个字。';return;}
    history=historyForRequest();
    $('.agent-intro').hidden=true;
    bubble('user',question);input.value='';const reply=bubble('assistant','');const flow=createFlow(reply.article);
    flow.update({stage:'parse',status:'running',detail:'正在连接问答服务'});
    busy=true;refresh();notice.textContent='正在查阅档案…';abortController=new AbortController();
    let completed=false,answer='';
    try{
      const headers={'Content-Type':'application/json'};if(!turnstileMode)headers.Authorization=`Bearer ${accessToken}`;
      const response=await fetch(`${api}/chat`,{method:'POST',headers,body:JSON.stringify({question,context:context(),history:historyForRequest(),turnstileToken:challenge||undefined}),signal:abortController.signal});
      if(!response.ok){const data=await response.json();if(response.status===401&&!turnstileMode){accessToken='';$('.agent-auth').hidden=false;}throw Error(data.error?.message||'提问未成功，请稍后再试。');}
      if(response.headers.get('Content-Type')?.includes('application/json')){
        const data=await response.json();for(const trace of data.trace||[])flow.update(trace);answer=data.answer;reply.content.textContent=answer;sources(reply.article,data.citations);budget(data.budget);completed=true;
      }else{
        for await(const frame of events(response.body)){
          if(frame.type==='trace')flow.update(frame.data);
          if(frame.type==='delta'){answer+=frame.data.text;reply.content.textContent=answer;scroll();}
          if(frame.type==='done'){answer=frame.data.answer;reply.content.textContent=answer;sources(reply.article,frame.data.citations);budget(frame.data.budget);completed=true;notice.textContent=frame.data.incomplete?'回答未完整生成，可缩小问题范围后再问。':'已附可核对的来源。';}
          if(frame.type==='error')throw Error(frame.data.message||'回答中断。');
        }
      }
      if(!completed)throw Error('连接已中断，未收到完整回答。');
      flow.finish(true);
      history.push({role:'user',content:question},{role:'assistant',content:answer.slice(0,1800)});
      if(!notice.textContent.includes('未完整'))notice.textContent='回答依据历史资料，请结合来源核对。';
    }catch(error){
      const message=error.name==='AbortError'?'已停止本次回答。未完成的调用可能仍计入今日额度。':error.message;
      flow.finish(false,error.name==='AbortError'?'已停止':'流程中断');
      const errorLine=document.createElement('p');errorLine.className='agent-error';errorLine.textContent=message;reply.article.append(errorLine);
      if(!answer)reply.content.textContent='';notice.textContent=message;
    }finally{busy=false;abortController=null;resetChallenge();refresh();scroll();input.focus();}
  }
  launcher.addEventListener('click',()=>{showContext();panel.showModal();checkService();setupChallenge();input.focus();});
  $('.agent-close').addEventListener('click',()=>panel.close());
  panel.addEventListener('click',event=>{if(event.target===panel){const r=panel.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)panel.close();}});
  $('.agent-connect').addEventListener('click',()=>{const value=$('#agent-passphrase').value.trim();if(!value){notice.textContent='请输入问答访问口令。';return;}accessToken=value;$('#agent-passphrase').value='';$('.agent-auth').hidden=true;notice.textContent='口令已暂存，提问时会验证。';refresh();input.focus();});
  $('#agent-passphrase').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('.agent-connect').click();}});
  $('.agent-form').addEventListener('submit',submit);
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();submit();}});
  $('.agent-stop').addEventListener('click',()=>abortController?.abort());
  $('.agent-reset').addEventListener('click',()=>{if(busy)return;history=[];feed.querySelectorAll('.agent-message').forEach(x=>x.remove());$('.agent-intro').hidden=false;notice.textContent='已开始新对话。';input.focus();});
  $('.agent-suggestions').addEventListener('click',event=>{const button=event.target.closest('button');if(button){input.value=button.textContent;input.focus();}});
  window.addEventListener('hashchange',showContext);
  refresh();
})();
