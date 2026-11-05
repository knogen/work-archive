"""Extract local document content for reviewed summaries. No network calls."""
import argparse,collections,hashlib,json,pathlib,re,zipfile,xml.etree.ElementTree as ET
from versions import family_key

ap=argparse.ArgumentParser();ap.add_argument('--source',default='..');ap.add_argument('--analysis',default='.local/analysis');args=ap.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];source=pathlib.Path(args.source).resolve();analysis=pathlib.Path(args.analysis).resolve()
attachments=json.loads((analysis/'attachments.json').read_text(encoding='utf-8'))
groups=collections.defaultdict(list)
for a in attachments:
    if a['available']:groups[family_key(a['name'])].append(a)
library={f['family']:f for f in json.loads((root/'data/archive.json').read_text(encoding='utf-8'))['library']}
def extract(p):
    ext=p.suffix.lower()
    if ext in ('.docx','.pptx'):
        with zipfile.ZipFile(p) as z:
            if z.testzip():raise ValueError('CRC failure')
            names=['word/document.xml'] if ext=='.docx' else sorted([n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)],key=lambda n:int(re.search(r'(\d+)\.xml',n)[1]))
            blocks=[]
            for name in names:
                tree=ET.fromstring(z.read(name))
                paragraphs=[''.join(e.text or '' for e in para.iter() if e.tag.endswith('}t')) for para in tree.iter() if para.tag.endswith('}p')]
                blocks.append(('\n幻灯片 '+re.search(r'\d+',name)[0]+'\n' if ext=='.pptx' else '')+'\n'.join(paragraphs))
            return '\n'.join(blocks),'正文文字（含表格/公式可提取文字）'
    if ext=='.pdf':
        from pypdf import PdfReader
        r=PdfReader(p)
        if r.is_encrypted:raise ValueError('Encrypted PDF')
        n=len(r.pages)
        if n>100:raise ValueError('Long book requires separate reading')
        pages=list(range(n)) if n<=16 else sorted(set(list(range(6))+list(range(max(6,n-5),n))))
        return '\n'.join(f'\n[第 {i+1}/{n} 页]\n'+(r.pages[i].extract_text() or '') for i in pages),'PDF '+('全文' if n<=16 else '第 '+','.join(str(i+1) for i in pages)+' 页')
    if ext=='.txt':return p.read_text(encoding='utf-8',errors='replace'),'纯文本正文'
    if ext=='.xlsx':
        from openpyxl import load_workbook
        w=load_workbook(p,read_only=True,data_only=True)
        blocks=[]
        for sheet in w:
            rows=[]
            for i,row in enumerate(sheet.iter_rows(values_only=True)):
                if i>=18:break
                rows.append(' | '.join(str(v) if v is not None else '' for v in row[:16]))
            blocks.append(f'工作表：{sheet.title}，{sheet.max_row}行，{sheet.max_column}列\n'+'\n'.join(rows))
        w.close();return '\n'.join(blocks),'工作表结构、表头与前18行样例'
    raise ValueError('Unsupported document format')
docs=[];excluded=[]
for family,versions in groups.items():
    if re.search('密码|口令|住址|房间|vpn|v.p.n',versions[-1]['name'],re.I):continue
    selected=None
    for a in sorted(versions,key=lambda v:(v['date'],v['messageId']),reverse=True):
        try:
            p=source/a['paths'][0];text,scope=extract(p)
            text=re.sub(r'[ \t]+',' ',text).strip()
            if len(re.findall(r'[\u4e00-\u9fffA-Za-z]',text))<180:raise ValueError('Too little readable content')
            if len(text)>22000:
                text=text[:15000]+'\n[中间文字略，以下为末段]\n'+text[-7000:];scope+='；长文取首末段，未声称逐页审阅'
            f=library.get(family,dict(id='file-'+hashlib.sha256(family.encode()).hexdigest()[:10],projectIds=[]))
            selected=dict(id=f['id'],name=a['name'],family=family,messageId=a['messageId'],date=a['date'],extension=pathlib.Path(a['name']).suffix.lower(),projectIds=f['projectIds'],text=text,readScope=scope,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
            break
        except Exception as e:failure=type(e).__name__+': '+str(e)[:100]
    if selected:docs.append(selected)
    else:excluded.append(dict(family=family,reason=failure))
out=root/'.local/document-reading';out.mkdir(parents=True,exist_ok=True)
(out/'documents.json').write_text(json.dumps(docs,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'excluded.json').write_text(json.dumps(excluded,ensure_ascii=False,indent=2),encoding='utf-8')
buckets=[[] for _ in range(3)];sizes=[0]*3
for d in sorted(docs,key=lambda d:-len(d['text'])):
    i=min(range(3),key=lambda i:sizes[i]);buckets[i].append(d);sizes[i]+=len(d['text'])
for i,b in enumerate(buckets,1):(out/f'batch-{i}.json').write_text(json.dumps(b,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(documents=len(docs),excluded=len(excluded),batchCounts=[len(b) for b in buckets],batchCharacters=sizes),ensure_ascii=False))
