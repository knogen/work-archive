// Browser-only renderer. Marked parses Markdown; DOMPurify is the final HTML boundary.
import {Marked} from 'marked';
import DOMPurify from 'dompurify';
import {linkifyCitations,validArchiveCitation,isArchiveCitationHref} from './citations.mjs';
export {validArchiveCitation,isArchiveCitationHref};

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safeLink(href){
  try{
    const url=new URL(String(href),window.location.href);
    if(!['https:','http:','mailto:'].includes(url.protocol)||url.username||url.password)return null;
    return {href:url.href,external:url.origin!==window.location.origin};
  }catch{return null;}
}
const parser=new Marked({gfm:true,breaks:false,renderer:{
  // Model-supplied HTML stays literal; it never enters the DOM as an active element.
  html({text}){return escape(text);},
  image({text}){return `<span>图片：${escape(text||'未命名图片')}（已省略）</span>`;},
  link({href,title,tokens}){
    const label=this.parser.parseInline(tokens),safe=safeLink(href);
    if(!safe)return label;
    return `<a href="${escape(safe.href)}"${title?` title="${escape(title)}"`:''}${safe.external?' target="_blank" rel="noopener noreferrer nofollow"':''}>${label}</a>`;
  },
}});
const sanitizeOptions={
  ALLOWED_TAGS:['p','br','hr','h1','h2','h3','h4','h5','h6','strong','em','del','blockquote','pre','code','ul','ol','li','table','thead','tbody','tr','th','td','a','span'],
  ALLOWED_ATTR:['href','title','target','rel','class','start','align'],
  ALLOWED_URI_REGEXP:/^(?:https?:|mailto:|#)/i,
  ALLOW_DATA_ATTR:false,
  ALLOW_ARIA_ATTR:false,
  RETURN_DOM_FRAGMENT:true,
};

export function render(target,markdown,citations=[],onNavigate){
  if(!target)return;
  const source=String(markdown??'').replace(/^[\u200b-\u200f\ufeff]+/,'');
  const html=parser.parse(source);
  // Do not pass purified output through another parser or interpolate it into an HTML string.
  target.replaceChildren(DOMPurify.sanitize(html,sanitizeOptions));
  // This helper only creates text and validated same-site links through DOM APIs.
  linkifyCitations(target,citations,onNavigate);
  target.classList.add('agent-markdown');
}
