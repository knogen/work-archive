// This module never records matched values. Reports contain counts and record IDs only.
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----|$)/g, '[私钥已移除]'],
  ['credential', /\b(?:sk-(?:proj-|svcacct-)?[a-zA-Z0-9_-]{16,}|gh[pousr]_[a-zA-Z0-9_]{15,}|github_pat_[a-zA-Z0-9_]{15,}|AKIA[A-Z0-9]{16})\b/g, '[凭证已移除]'],
  ['bearer', /\bBearer\s+[a-zA-Z0-9._~+\/-]{8,}=*/gi, 'Bearer [凭证已移除]'],
  ['jwt', /\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b/g, '[会话凭证已移除]'],
  ['email', /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/g, '[邮箱已移除]'],
  ['mobile', /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}(?!\d)/g, '[手机号已移除]'],
  ['identity', /(?<!\d)[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g, '[证件号已移除]'],
  ['credential-line', /^.*(?:(?:密码|口令|验证码)\s*(?:[:：=是为]|[a-zA-Z0-9@#$%^&*_+-]{4,})|门锁|开门码|(?:api[_ -]?key|access[_ -]?token|secret[_ -]?key|password)["']?\s*[:：=]).*$/gim, '[敏感凭证行已移除]'],
  ['personal-line', /^.*(?:家庭住址|收货地址|身份证号|银行卡号|微信号|私人电话|个人电话|紧急联系人|家庭电话)\s*[:：=是为].*$/gm, '[私人信息行已移除]'],
  ['private-address', /\b(?:127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g, '[内网地址已移除]'],
  ['local-path', /(?:\b[A-Za-z]:[\\/]|\\\\)[^\s<>"'，。；）)\]】]+/g, '[本地路径已移除]'],
];

function isPrivateHost(hostname) {
  const host=hostname.toLowerCase().replace(/^\[|\]$/g,'');
  if(host==='localhost'||!host.includes('.')&&!host.includes(':')||/\.(?:localhost|local|internal|lan|home)$/.test(host))return true;
  if(host==='::'||host==='::1'||/^(?:f[cd][a-f0-9]{2}|fe[89ab][a-f0-9]):/i.test(host))return true;
  const ipv4=host.startsWith('::ffff:')?host.slice(7):host;
  if(/^\d+\.\d+\.\d+\.\d+$/.test(ipv4)){
    const [a,b]=ipv4.split('.').map(Number);
    return a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127;
  }
  return false;
}

export function createSanitizer({privateTerms = [], authors = []} = {}) {
  const counts = {};
  const mark = key => { counts[key] = (counts[key] || 0) + 1; };
  // Sender identities are omitted; mentions of known sender names are also removed.
  const terms = [...new Set([...privateTerms.filter(x=>typeof x==='string'&&x.length>=1),...authors.filter(x=>typeof x==='string'&&x.length>=2)].map(x=>x.normalize('NFKC').replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g,'')))].filter(Boolean).sort((a,b) => b.length-a.length);
  function text(value) {
    let result = String(value ?? '').normalize('NFKC').replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '');
    const academicUrls=[];
    // Parse URLs before replacing addresses or credentials, otherwise malformed leftovers
    // can retain a private path. Remove userinfo, query strings, fragments, and private hosts.
    result = result.replace(/https?:\/\/[^\s<>"'）)】]+/gi, value => {
      try {
        const url = new URL(value);
        if (url.username || url.password || isPrivateHost(url.hostname)) { mark('private-url'); return '[私有链接已移除]'; }
        if (url.search || url.hash) { mark('url-parameters'); url.search = ''; url.hash = ''; }
        // DOI suffixes can contain phone-shaped numbers. They are scholarly identifiers,
        // not contact numbers. Preserve reviewed DOI paths without query/userinfo.
        if((/^(?:dx\.)?doi\.org$/.test(url.hostname)&&/^\/10\.\d{4,9}\/\S+/.test(url.pathname))||/\/doi\/(?:[a-z]+\/)?10\.\d{4,9}\/\S+/i.test(url.pathname)){
          // Only the mobile-number heuristic is bypassed for DOI suffixes.
          // Credentials, identities, emails, and other rules still apply.
          for(const [name,pattern] of rules){
            if(name==='mobile')continue;
            pattern.lastIndex=0;const unsafe=pattern.test(url.href);pattern.lastIndex=0;
            if(unsafe){mark(name);return '[链接中的敏感信息已移除]';}
          }
          const index=academicUrls.push(url.href)-1;return `\uE000${index}\uE001`;
        }
        return url.href;
      } catch { mark('invalid-url'); return '[链接已移除]'; }
    });
    for (const [name, pattern, replacement] of rules) result = result.replace(pattern, () => { mark(name); return replacement; });
    result=result.replace(/\uE000(\d+)\uE001/g,(_,index)=>academicUrls[Number(index)]||'[链接已移除]');
    for (const term of terms) {
      if (result.includes(term)) { mark('private-term-or-author'); result = result.split(term).join('[已隐去]'); }
    }
    return result;
  }
  return {text, counts};
}
