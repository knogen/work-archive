// Add links only after Markdown has been sanitized and inserted into the DOM.
// The server's verified citation list is the complete allowlist; model text alone
// can never create a citation target.
const slug='[a-zA-Z0-9-]{1,100}';
const recordRoute=new RegExp(`^#/(?:project|question|library)/${slug}$`);
const evidenceRoute=/^#\/evidence\/m\d{5}$/;
const timelineRoute=/^#\/timeline(?:\?year=(?:19|20)\d{2})?$/;
const citationId=/^(?:m\d{5}|evidence:m\d{5}|(?:project|question|document|output):[a-zA-Z0-9-]{1,100}|event:\d{1,10})$/;
const skipped='a,code,pre,script,style,textarea,title,noscript,button';

export function isArchiveCitationHref(href){
  return typeof href==='string'&&(recordRoute.test(href)||evidenceRoute.test(href)||timelineRoute.test(href)||href==='#/projects');
}

export function validArchiveCitation(citation){
  if(!citation||typeof citation!=='object'||Array.isArray(citation)||typeof citation.id!=='string'||!citationId.test(citation.id)||!isArchiveCitationHref(citation.href))return false;
  const {id,href}=citation;
  if(/^m\d{5}$/.test(id))return href===`#/evidence/${id}`;
  const separator=id.indexOf(':'),kind=id.slice(0,separator),value=id.slice(separator+1);
  if(kind==='evidence')return href===`#/evidence/${value}`;
  if(kind==='project')return href===`#/project/${value}`;
  if(kind==='question')return href===`#/question/${value}`;
  if(kind==='document')return href===`#/library/${value}`;
  // Event/output records point to the archive page holding the record, rather
  // than to a dedicated event/output route.
  if(kind==='event')return new RegExp(`^#/project/${slug}$`).test(href)||timelineRoute.test(href);
  if(kind==='output')return new RegExp(`^#/project/${slug}$`).test(href)||href==='#/projects';
  return false;
}

function readable(citation){
  const id=citation.id,kind=id.includes(':')?id.slice(0,id.indexOf(':')):'evidence';
  const title=typeof citation.title==='string'?citation.title.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim():'';
  const date=typeof citation.date==='string'&&/^\d{4}-\d{2}-\d{2}/.test(citation.date)?citation.date.slice(0,10):'';
  if(kind==='evidence')return {label:`原文 ${id.replace(/^evidence:/,'')}`,title,date};
  const prefix={project:'专题',question:'问题',document:'文档',event:'节点',output:'图表'}[kind]||'来源';
  const short=title.length>28?`${title.slice(0,28)}…`:title;
  return {label:`${prefix} · ${short||id.slice(id.indexOf(':')+1)}`,title,date};
}

/**
 * Link verified [m00001] / [project:some-id] markers in an existing sanitized DOM.
 * Returns the number of links added. Existing anchors and code/pre stay literal.
 * onNavigate(citation, event) is called for an unmodified primary click. When
 * supplied, the default navigation is prevented so the caller owns navigation.
 */
export function linkifyCitations(container,citations,onNavigate){
  if(!container?.ownerDocument||!Array.isArray(citations)||!citations.length)return 0;
  const verified=new Map();
  for(const candidate of citations){
    if(!validArchiveCitation(candidate))continue;
    // Conflicting server entries are ignored rather than picking a target.
    if(verified.has(candidate.id)&&verified.get(candidate.id)?.href!==candidate.href){verified.set(candidate.id,null);continue;}
    if(verified.get(candidate.id)===null)continue;
    verified.set(candidate.id,{id:candidate.id,href:candidate.href,title:typeof candidate.title==='string'?candidate.title:'',date:typeof candidate.date==='string'?candidate.date:'',kind:typeof candidate.kind==='string'?candidate.kind:''});
  }
  const doc=container.ownerDocument,walker=doc.createTreeWalker(container,4,{acceptNode(node){return node.parentElement?.closest(skipped)?2:1;}}),texts=[];
  let node;while((node=walker.nextNode()))if(node.nodeValue?.includes('['))texts.push(node);
  let count=0;
  for(const textNode of texts){
    const source=textNode.nodeValue,pattern=/\[([a-zA-Z0-9_:-]{1,160})\]/g,fragment=doc.createDocumentFragment();let previous=0,changed=false;
    for(const match of source.matchAll(pattern)){
      const citation=verified.get(match[1]);if(!citation)continue;
      const info=readable(citation),anchor=doc.createElement('a');
      anchor.className='agent-inline-citation';anchor.setAttribute('href',citation.href);anchor.setAttribute('data-citation-id',citation.id);
      anchor.textContent=info.label;anchor.title=[info.title,info.date,`引用 ID：${citation.id}`].filter(Boolean).join(' · ');
      anchor.setAttribute('aria-label',`${info.label}${info.date?`，${info.date}`:''}，查看已核验来源 ${citation.id}`);
      if(typeof onNavigate==='function')anchor.addEventListener('click',event=>{
        if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
        event.preventDefault();onNavigate(citation,event);
      });
      fragment.append(doc.createTextNode(source.slice(previous,match.index)),anchor);previous=match.index+match[0].length;changed=true;count++;
    }
    if(changed){fragment.append(doc.createTextNode(source.slice(previous)));textNode.replaceWith(fragment);}
  }
  return count;
}
