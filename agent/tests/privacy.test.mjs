import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createSanitizer} from '../shared/privacy.mjs';
import {buildAgent} from '../../scripts/build-agent.mjs';

test('credentials, contacts, keys, and sender mentions are removed without recording values',()=>{
  const s=createSanitizer({authors:['示例发送人'],privateTerms:['内部代号甲']});
  const fixtures=[
    'sk-proj-'+ 'A'.repeat(30), 'ghp_'+'B'.repeat(30),
    'Bearer abcdefghijklmnop', 'eyJabcdefghijk.abcdefghijkl.abcdefghijkl',
    'someone@example.net', '13800138000', '+86 139 1234 5678',
    '110101199001011234','密码：example-password','微信号：private-contact',
    '-----BEGIN PRIVATE KEY-----\nprivate material\n-----END PRIVATE KEY-----',
    'C:\\Users\\someone\\private-data\\file.txt', '示例发送人', '内部代号甲',
  ];
  for(const input of fixtures)assert.ok(!s.text(input).includes(input));
  assert.ok(!JSON.stringify(s.counts).includes('someone'));
  assert.ok(Object.values(s.counts).every(Number.isSafeInteger));
});

test('private URL paths disappear completely; signed URL parameters and fragments are removed',()=>{
  const s=createSanitizer();
  for(const url of ['http://10.0.0.1/private-file','http://127.0.0.1/private-file','http://[::1]/private-file','https://printer.local/private-file','https://service/private-file','https://user:pass@example.org/private-file','http://169.254.169.254/private-file']){
    const clean=s.text(url);assert.ok(!clean.includes('private-file'));assert.ok(!clean.includes('user:pass'));
  }
  const clean=s.text('https://example.org/paper?token=example-secret#private-fragment');
  assert.equal(clean,'https://example.org/paper');
});

test('zero-width/full-width obfuscation is normalized and DOI identifiers remain intact',()=>{
  const s=createSanitizer({privateTerms:['秘密术语']});
  assert.ok(!s.text('秘\u200b密术语').includes('术语'));
  assert.ok(!s.text('ｓｋ－ｐｒｏｊ－'+'Ａ'.repeat(30)).includes('AAAA'));
  const doi='https://onlinelibrary.wiley.com/doi/10.1002/asi.13800138000';
  assert.equal(s.text(doi),doi);
  assert.equal(s.text('https://doi.org/10.1002/13800138000?tracking=private'), 'https://doi.org/10.1002/13800138000');
  assert.ok(!s.text('手机号 13800138000').includes('13800138000'));
  assert.equal(s.text('2019 年完成 1000 次实验，KQI=2.36。'),'2019 年完成 1000 次实验,KQI=2.36。');
});

test('DOI protection only skips the mobile heuristic and explicit one-character private terms work',()=>{
  const secret='sk-proj-'+ 'Z'.repeat(30),jwt='eyJabcdefghijk.abcdefghijkl.abcdefghijkl';
  const s=createSanitizer({privateTerms:['甲']});
  for(const url of [`https://doi.org/${secret}`,`https://doi.org/${jwt}`,`https://doi.org/10.1002/${secret}`,`https://doi.org/10.1002/${jwt}`,'https://doi.org/13800138000','https://doi.org/10.1002/contact@example.org']){
    const clean=s.text(url);assert.ok(!clean.includes(secret));assert.ok(!clean.includes(jwt));assert.ok(!clean.includes('13800138000'));assert.ok(!clean.includes('contact@example.org'));
  }
  assert.ok(!s.text('代号甲的记录').includes('甲'));
  assert.ok(!s.text('{"password":"example-password"}').includes('example-password'));
  assert.ok(!s.text('密码abcd1234').includes('abcd1234'));
});

async function fixture(policy){
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'archive-agent-data-'));
  const base=pathToFileURL(directory+path.sep);
  const archive={meta:{start:'2022-01-01',end:'2024-01-01',limitations:[]},projects:[{id:'safe-project',title:'安全专题',tags:['安全主题'],summary:'BLOCKED_SENTINEL',period:'2022—2024',caveat:'',achievements:[{text:'BLOCKED_SENTINEL',evidence:['m00001']}],milestones:[]}],questions:[{id:'private-question',title:'私有记录',lastDiscussedAt:'2022-02-02',projectId:'safe-project',kind:'research',status:'proposed',lastKnown:'BLOCKED_SENTINEL',attempts:[],sections:[],acceptanceCriteria:[],nextSteps:[],evidence:['m00001']}],events:[{title:'受污染事件',date:'2022-02-02',projectId:'safe-project',detail:'BLOCKED_SENTINEL',evidence:['m00001']},{title:'公开工作事件',date:'2022-03-03',projectId:'safe-project',detail:'可继续召回的研究进展',evidence:['m00002']}],library:[{id:'private-file',name:'材料',date:'2022-02-02',projectIds:['safe-project'],messageId:'m00001',summary:'BLOCKED_SENTINEL',keyPoints:[]}],outputs:[],evidence:{m00001:{date:'2022-02-02',author:'示例作者',text:'BLOCKED_SENTINEL'},m00002:{date:'2022-03-03',author:'示例作者',text:'可公开研究数据'}}};
  await fs.writeFile(new URL('source.json',base),JSON.stringify(archive));
  await fs.writeFile(new URL('policy.json',base),JSON.stringify({privateTerms:[],excludedRecordIds:[],excludedEvidenceIds:[],...policy}));
  const result=await buildAgent({sourceUrl:new URL('source.json',base),publicPolicyUrl:new URL('policy.json',base),privatePolicyUrl:new URL('absent.json',base),outputUrl:new URL('output/',base),quiet:true});
  return {directory,result};
}

test('excluded record sources cannot leak through summaries, evidence, or either index',async()=>{
  for(const policy of [{excludedRecordIds:['question:private-question']},{excludedRecordIds:['evidence:m00001']},{excludedEvidenceIds:['m00001']}]){
    const {directory,result}=await fixture(policy);
    try{
      const serialized=JSON.stringify(result.corpus);
      assert.ok(!serialized.includes('BLOCKED_SENTINEL'));
      assert.ok(!serialized.includes('m00001'));
      assert.ok(result.corpus.evidence.m00002);
      assert.ok(result.corpus.nodes.some(n=>n.title==='公开工作事件'));
      assert.ok(result.report.excludedEvidence.includes('m00001'));
    }finally{await fs.rm(directory,{recursive:true,force:true});}
  }
});

test('build is byte-deterministic and does not modify the source archive',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'archive-agent-build-'));
  const base=pathToFileURL(directory+path.sep),source=new URL('../../data/archive.json',import.meta.url);
  const before=await fs.readFile(source);
  try{
    const a=await buildAgent({outputUrl:new URL('first/',base),quiet:true});
    const b=await buildAgent({outputUrl:new URL('second/',base),quiet:true});
    assert.equal(a.corpus.version,b.corpus.version);
    for(const file of ['corpus.json','privacy-report.json','kv-upload.json'])assert.deepEqual(await fs.readFile(new URL(`first/${file}`,base)),await fs.readFile(new URL(`second/${file}`,base)));
    assert.deepEqual(await fs.readFile(source),before);
    assert.equal(a.corpus.nodes.filter(n=>n.kind==='output').every(n=>n.timeline===false),true);
    const ids=new Set(a.corpus.nodes.map(n=>n.id));
    for(const year of a.corpus.time)for(const month of year.months)for(const id of month.nodeIds){assert.ok(ids.has(id));assert.ok(!id.startsWith('output:'));assert.ok(!id.startsWith('project:'));}
    for(const e of Object.values(a.corpus.evidence))assert.deepEqual(Object.keys(e).sort(),['date','id','text']);
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});
