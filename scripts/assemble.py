"""Build the static archive from local analysis; no network or AI calls.

Usage: python scripts/assemble.py --analysis ../archive-analysis --source ..
The complete original chat and raw attachments are never copied wholesale.
"""
import argparse,collections,copy,hashlib,json,pathlib,re,shutil,zipfile
from versions import family_key

ap=argparse.ArgumentParser()
ap.add_argument('--analysis',default='.local/analysis')
ap.add_argument('--source',default='..')
args=ap.parse_args()
ROOT=pathlib.Path(__file__).resolve().parents[1]
AN=pathlib.Path(args.analysis).resolve()
SOURCE=pathlib.Path(args.source).resolve()
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def write(p,x): p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
analyses=[read(AN/f'analysis-{i}.json' if (AN/f'analysis-{i}.json').exists() else ROOT/f'editorial/analysis-{i}.json') for i in range(1,4)]
original_analyses=copy.deepcopy(analyses)
messages=read(AN/'messages.json');msg={m['id']:m for m in messages}
attachments=read(AN/'attachments.json');inventory=read(AN/'inventory.json')
definitions=[
 ('wiki-platform','Wikipedia 学科关系平台','从学科距离、Core 分类到小世界检验，将百科数据变成可查询、可比较的研究平台。','已有平台交付',['wiki-research-platform','wiki-core-consistency','academic-distance']),
 ('science-atlas','学科图谱与知识融通','以 MAG / OpenAlex 构建学科距离与网络，积累 One / Two / Many Cultures 文稿、图表和数据归档。','数据与图表已交付',['mag-science-mapping','one-two-many-cultures-paper','knowledge-consilience']),
 ('disruption','颠覆度与重要性的检验','从 D 指标计算到 Wikipedia–MAG 交集，持续追问高颠覆度是否真的代表重要成果。','阶段研究成果',['disruption-metrics','disruption-wm','disruption-index']),
 ('gpc','GPC 语义距离与推理','完成语义距离计算与查询演示，继续探索类比推理、文本相似度及应用边界。','计算与演示已交付',['gpc-distance','gpc-text-similarity']),
 ('knowledge-complexity','知识复杂度与国家排名','从经济复杂性出发，形成国家依赖、知识复杂度与论文数量的可演示页面。','已有产品演示',['knowledge-complexity']),
 ('network-entropy','网络熵、复杂度与 KQI','比较多种网络测度，记录反例、算法实现和理论争议，保留仍需核实的定义与证明。','阶段结果 / 待续',['network-entropy','network-entropy-kqi']),
 ('wiki-evolution','Wikipedia 演化与知识增长','重建百科历史，拟合文章、链接与内容增长，讨论知识增长是否在放缓。','历史数据与研究稿',['wiki-evolution']),
 ('computing-growth','摩尔定律与算力增长','整理晶体管、性能和能耗的演进数据，形成《摩尔定律死了，摩尔定律万岁》发表成果。','已有发表成果',['computing-growth']),
 ('software-compression','软件复用与跨语料压缩','从 JDK 调用和软件复用，到代码、文学、论文的压缩实验，检验“复杂”的可测含义。','阶段实验成果',['software-compression']),
 ('science-migration','科学迁徙与知识地图','把科学家迁移、书籍与图书馆数据转为可演示地图，记录覆盖度与匹配问题。','已有地图演示',['science-migration']),
]
source_projects={p['id']:p for a in analyses for p in a['projects']}
project_map={s:d[0] for d in definitions for s in d[4]}
projects=[];questions=[];events=[]
for pid,title,summary,label,sources in definitions:
    ps=[source_projects[s] for s in sources]
    achievements=[v for p in ps for v in p.get('achievements',[])]
    milestones=[dict(m,projectId=pid,status='阶段记录') for p in ps for m in p.get('milestones',[])]
    for m in milestones:
        if m['title']=='数据仓库交付':m['detail']=m['detail'].replace('已发表图表','原有图表')
    milestones.sort(key=lambda m:m['date'])
    source_ids=re.findall(r'm\d{5}',json.dumps(ps,ensure_ascii=False))
    dates=[m['date'] for m in milestones]+[msg[mid]['date'][:10] for mid in source_ids if mid in msg]
    p=dict(id=pid,title=title,summary=summary,label=label,period=(min(dates)[:4]+' — '+max(dates)[:4]) if dates else ps[0]['period'],tags=list(dict.fromkeys(t for s in ps for t in s.get('tags',[]))),achievements=achievements,milestones=milestones,sourceIds=sources,caveat='专题中包含已完成的子任务与仍在推进的研究。阶段结果、演示上线和文稿产出，不自动表示全部结论通过验证或正式发表。')
    projects.append(p)
    events.extend(milestones)
    for s in ps:
        for i,q in enumerate(s.get('questions',[])):
            q=dict(q,id=f"{s['id']}-q{i+1}",projectId=pid,sourceProjectId=s['id'],topicTitle=s['title'])
            ids=q.get('evidence',[])+[v for a in q.get('attempts',[]) for v in a.get('evidence',[])]
            q['lastDate']=max((msg[mid]['date'][:10] for mid in ids if mid in msg),default='')
            q['priority']=bool(re.search('KQI|压缩|代数|几何|迭代退化|交叉学科|16.8|Fragment|fragment',q['title']))
            questions.append(q)
for a in analyses:
    events.extend(dict(e,projectId=project_map.get(e.get('projectId',''))) for e in a.get('minorEvents',[]))
# Small projects remain in the timeline, while their unresolved questions remain discoverable.
for s in source_projects.values():
    if s['id'] in project_map: continue
    for m in s.get('milestones',[]): events.append(dict(m,projectId=None,status='阶段记录'))
    for i,q in enumerate(s.get('questions',[])):
        q=dict(q,id=f"{s['id']}-q{i+1}",projectId=None,sourceProjectId=s['id'],topicTitle=s['title'])
        ids=q.get('evidence',[])+[v for a in q.get('attempts',[]) for v in a.get('evidence',[])]
        q['lastDate']=max((msg[x]['date'][:10] for x in ids if x in msg),default='')
        q['priority']=False;questions.append(q)
# Any closure removals must be backed by the human-readable cross-period audit.
audit_path=AN/'question-audit.json' if (AN/'question-audit.json').exists() else ROOT/'editorial/question-audit.json'
audit=read(audit_path) if audit_path.exists() else {}
resolved={(r['projectId'],r['title']) for r in audit.get('resolved',[])}
questions=[q for q in questions if (q['sourceProjectId'],q['title']) not in resolved]
for note in audit.get('notes',[]):
    if note.get('attemptToAdd'):
        q=next((q for q in questions if q['title']==note['title']),None)
        if q:
            q['attempts'].insert(0,note['attemptToAdd'])
            q['lastKnown']='2019 年已有“距离都变远”的初步答复。'+note['lastKnown']+' 需恢复原始集合、版本与距离实现，检验旧答复是否稳健。'
            q['nextSteps']=note['nextSteps'];q['priority']=True
            q['evidence']=list(dict.fromkeys(q['evidence']+note['evidence']))
    if note.get('type')=='keep-open':
        q=next((q for q in questions if q['title']==note['title']),None)
        if q:
            q['lastKnown']='后期已定位模板链接等差异来源，并有历史距离重算和季度数据更新。针对 2011/2013 数据转换是否全部修正，仍缺专项验收证据。'
            q['attempts'].append(dict(text=note['finding'],evidence=note['evidence']))
    if note.get('type')=='update-latest-state':
        q=next((q for q in questions if q['title']==note['title']),None)
        if q:
            q['attempts'].append(dict(text=note['finding'],evidence=note['evidence']))
            q['lastKnown']='2022 年仍有 v3 稿与两层学术圈集群图更新；已经形成文稿和图表，但本次记录中未见这篇论文的明确发表确认。'
for group in audit.get('duplicateGroups',[]):
    qs=[q for q in questions if q['title'] in group['titles']]
    if len(qs)>1:
        keep=qs[-1]
        keep['attempts']=[a for q in qs for a in q['attempts']]
        keep['evidence']=list(dict.fromkeys([mid for q in qs for mid in q['evidence']]+group.get('evidence',[])))
        questions=[q for q in questions if q not in qs or q is keep]
for q in questions:
    ids=q['evidence']+[mid for a in q.get('attempts',[]) for mid in a.get('evidence',[])]
    q['lastDate']=max((msg[mid]['date'][:10] for mid in ids if mid in msg),default=q['lastDate'])
# Exact duplicates only; similar titles remain separate until reviewed.
seen=set();unique=[]
for e in events:
    key=(e['date'],e['title'])
    if key in seen: continue
    seen.add(key)
    if re.search('公寓|会员注册|购买完成',e['title']): continue
    outcomes={
      'CCCF发表材料归档':'已发表',
      '距离预计算完成':'计算完成',
      '距离库查询演示上线':'演示上线',
      '完成媒体导出':'地图与媒体导出',
      '扩展书与图书馆':'地图演示',
      '形成产品演示':'演示上线',
      '数据仓库交付':'数据交付',
      '相似子图申请提交':'申请提交（非授权）',
      '导航入口交付':'入口交付',
      '处理完成':'数据处理完成',
      '上市公司雇员数据交付':'文件交付',
      'NSFC数据上线':'数据上线',
      '历史距离部署':'功能上线',
      '季度阈值数据上线':'数据上线',
      'SPECint可编辑图交付':'图表交付',
      '新两层学术圈图交付':'图表交付',
      'Wikipedia聚类图与说明完成':'图表交付',
    }
    e['featured']=e['title'] in outcomes
    if e['featured']:e['status']=outcomes[e['title']]
    unique.append(e)
events=sorted(unique,key=lambda e:e['date'])
high=''
for m in messages:
    m['forwarded']=m['date']<high
    high=max(high,m['date'])
# Include source references from the curated output and version history only.
all_ids=set(re.findall(r'm\d{5}',json.dumps([projects,questions,events],ensure_ascii=False)))
artifact_refs={v['messageId']:v for p in source_projects.values() for v in p.get('artifacts',[]) if v.get('messageId')}
families=collections.defaultdict(list)
for a in attachments:
    if pathlib.Path(a['name']).suffix.lower() not in ('.docx','.pptx','.xlsx','.pdf','.txt','.doc','.svg'): continue
    if re.search('密码|口令|住址|房间|vpn|v.p.n',a['name'],re.I):continue
    families[family_key(a['name'])].append(a)
library=[]
bundled={};budget=36_000_000
integrity_cache={}
def verify_office(item):
    path=item['paths'][0]
    if path not in integrity_cache:
        try:
            with zipfile.ZipFile(SOURCE/path) as z:
                integrity_cache[path]='damaged' if z.testzip() else 'passed'
        except Exception:
            integrity_cache[path]='damaged'
    return integrity_cache[path]
# Bundle only representative in-house materials, with text-based secret screening.
# Third-party papers/books are indexed but not redistributed.
for family,versions in families.items():
    versions.sort(key=lambda v:(v['date'],v['messageId']))
    available=[x for x in versions if x['available']]
    selected=available[-1] if available else versions[-1]
    reason=next((artifact_refs[v['messageId']]['reason'] for v in reversed(versions) if v['messageId'] in artifact_refs),'')
    ps=sorted({project_map[s['id']] for s in source_projects.values() if s['id'] in project_map and any(a.get('messageId') in {v['messageId'] for v in versions} for a in s.get('artifacts',[]))})
    ext=pathlib.Path(selected['name']).suffix.lower()
    integrity='unchecked' if available else 'missing'
    fallback=False
    if reason and ps and available and ext in ('.docx','.pptx','.xlsx') and selected.get('size',0)<=4_000_000:
        candidates=[v for v in reversed(available) if v.get('size',0)<=4_000_000]
        healthy=next((v for v in candidates if verify_office(v)=='passed'),None)
        if healthy:
            fallback=healthy is not selected
            selected=healthy;integrity='passed'
        else:integrity='damaged'
    f=dict(id='file-'+hashlib.sha256(family.encode()).hexdigest()[:10],name=selected['name'],family=family,date=selected['date'],messageId=selected['messageId'],available=bool(available),integrity=integrity,extension=ext,description=reason or '最近现存副本；未见明确的最终定稿确认。',projectIds=ps,uniqueVersions=len({v.get('sha256') for v in available}),versions=[{k:v[k] for k in ('name','date','messageId','available')} for v in versions],url=None)
    selected_reason=artifact_refs.get(selected['messageId'],{}).get('reason','')
    if available:
        f['description']=selected_reason or '最近现存副本；未见明确的最终定稿确认。'
        if versions[-1]['date']>selected['date'] and not versions[-1]['available']:
            f['description']='本组更晚发送的版本缺失；此处展示最近现存副本。'+selected_reason
    text=selected.get('textPreview','')
    is_representative=bool(reason and ps and available and integrity!='damaged' and ext in ('.docx','.pptx','.xlsx','.svg'))
    safe=not re.search(r'密码|口令|门锁|access.?token|api.?key|secret.?key|BEGIN.*PRIVATE KEY',text,re.I)
    if is_representative and safe and selected.get('size',0)<=4_000_000 and selected.get('size',0)<=budget:
        path=selected['paths'][0];src=SOURCE/path
        if src.is_file():
            url='assets/'+src.name;shutil.copy2(src,ROOT/url);budget-=src.stat().st_size
            bundled[path]=dict(url=url,name=selected['name'],kind='file');f['url']=url
    if not available:
        f['description']='本次导出没有可读原文件；保留发送记录。'+reason
    elif integrity=='damaged':
        f['description']='现存副本未通过文件完整性校验，下载暂不收录；可恢复原文件后补充。'+reason
    elif not f['url']:
        f['description']='导出中有原文件，网站未收录下载（完整性未核验）。'+(reason or '代表材料尚未确认最终定稿。')
    elif fallback:
        f['description']='选取较早且通过完整性校验的副本；较新现存副本损坏。'+reason
    library.append(f)
    all_ids.update(v['messageId'] for v in versions)
blocked={'m00370','m08504','m08510','m08511','m09650'}
evidence={}
for mid in sorted(all_ids):
    if mid in blocked or mid not in msg: continue
    m=msg[mid]
    body=m['text']
    # Missing/encrypted notices are replaced with readable availability notes.
    body=re.sub(r'尚未找到通过完整 AES 校验的图片密钥[^\n]*','[图片未解密，内容未核实]',body)
    body=body.replace('本机附件或有效 CDN 资源尚不可用，请在微信下载原文件后重新导出。','[本次导出附件缺失]')
    body=re.sub(r'!?\[[^\]]*\]\(<[^>]+>\)','[附件见下方状态]',body)
    # Redact entire lines with credentials / household access information.
    lines=[]
    for line in body.splitlines():
        if re.search(r'密码|口令|门锁|验证码|access.?token|api.?key|secret.?key|BEGIN.*PRIVATE KEY',line,re.I):line='[与工作归档无关的敏感信息已隐去]'
        # Do not corrupt DOI/article identifiers inside URLs.
        parts=re.split(r'(https?://[^\s<>]+)',line)
        line=''.join(part if part.startswith(('http://','https://')) else re.sub(r'(?<!\d)1[3-9]\d{9}(?!\d)','[手机号已隐去]',part) for part in parts)
        line=re.sub(r'(https?://[^\s?]+)\?[^\s]*',r'\1?[查询参数已省略]',line)
        lines.append(line)
    assets=[]
    for path in m.get('assets',[]):
        src=SOURCE/path
        if path in bundled:assets.append(dict(bundled[path],status='网站已收录'))
        elif src.suffix.lower()=='.dat':assets.append(dict(name='原附图片',status='加密，尚不可读取',url=None))
        elif src.suffix.lower()=='.wav':assets.append(dict(name='语音',status='未转写，未据此下结论',url=None))
        elif src.suffix.lower() in ('.png','.jpg','.gif') and src.stat().st_size<1_000_000 and mid in set(re.findall(r'm\d{5}',json.dumps([projects,questions,events],ensure_ascii=False))):
            # Non-icon image attachments are kept with their cited message.
            if src.name!='66a9100bb63bd6ec15f5e041.png':
                url='assets/'+src.name;shutil.copy2(src,ROOT/url);assets.append(dict(name='消息图片',kind='image',status='可读',url=url))
        else:assets.append(dict(name=next((a['name'] for a in attachments if a['messageId']==mid),'原附文件'),status='原文件保留在本地，网站未收录',url=None))
    evidence[mid]={k:m[k] for k in ('id','date','author','line','forwarded')}
    evidence[mid].update(text='\n'.join(lines),assets=assets)
# No dangling citations, including omitted private messages.
def clean_refs(x):
    if isinstance(x,dict):
        for k,v in x.items():
            if k=='evidence':x[k]=[mid for mid in v if mid in evidence]
            else:clean_refs(v)
    elif isinstance(x,list):
        for v in x:clean_refs(v)
for x in [projects,questions,events]:clean_refs(x)
status=inventory['resource_status']
meta=dict(source=inventory['source'],start=inventory['start'][:10],end=inventory['end'][:10],exportCount=9917,parsedCount=len(messages),years=inventory['years'],resourceStatus=status,resourceTotal=sum(status.values()),voiceCount=inventory['resource_kinds']['voice'],generated='2026-11-05',sourceSha256=hashlib.sha256((SOURCE/inventory['source']).read_bytes()).hexdigest(),limitations=['时间头解析包含合并转发中的旧消息；网站统计为解析条目，并非顶层消息精确总数。','大部分原图仍为加密文件；未恢复图像内容，语音未做转写。','部分后期文稿缺失，代表材料只能选择最近可读副本，不能确认最终定稿。','对“已解决”采用保守证据标准；跨年研究问题需持续人工复核。','原文中的方法名、数值与测度结论均作为历史工作记录，不等于本次重新验证过的科学结论。'])
data=dict(meta=meta,projects=projects,questions=questions,events=events,library=sorted(library,key=lambda f:f['date'],reverse=True),evidence=evidence)
meta['damagedRepresentativeGroups']=sum(f['integrity']=='damaged' for f in library)
meta['limitations'].append('下载已检查 Office 文件的 ZIP/CRC 完整性；这不代表文档中的每一幅图表或每个科学结论已经重新验证。')
# Quarantine obsolete generated assets; original export files remain untouched.
active_urls={f['url'] for f in library if f.get('url')}
active_urls.update(a['url'] for m in evidence.values() for a in m['assets'] if a.get('url'))
for p in (ROOT/'assets').iterdir():
    if p.is_file() and p.relative_to(ROOT).as_posix() not in active_urls:
        target=ROOT/'.local/rejected-assets'/p.name
        target.parent.mkdir(parents=True,exist_ok=True)
        if target.exists():target=target.with_name(p.stem+'-'+hashlib.sha256(p.read_bytes()).hexdigest()[:8]+p.suffix)
        shutil.move(str(p),str(target))
write(ROOT/'data/archive.json',data)
(ROOT/'data/archive.js').write_text('window.WORK_ARCHIVE = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
for i,a in enumerate(original_analyses,1):write(ROOT/f'editorial/analysis-{i}.json',a)
if audit:write(ROOT/'editorial/question-audit.json',audit)
print(json.dumps(dict(projects=len(projects),questions=len(questions),events=len(events),library=len(library),evidence=len(evidence),bundled=len(bundled),attachmentBytes=36_000_000-budget),ensure_ascii=False))
