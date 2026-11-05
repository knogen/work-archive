"""Index one Moect Markdown export locally, without transmitting source data."""
import argparse,collections,hashlib,json,pathlib,re,xml.etree.ElementTree as ET,zipfile
from versions import family_key

ap=argparse.ArgumentParser()
ap.add_argument('--source',required=True,help='Directory containing one exported chat Markdown file')
ap.add_argument('--output',default='.local/analysis')
args=ap.parse_args()
root=pathlib.Path(args.source).resolve();out=pathlib.Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
sources=[p for p in root.glob('*.md') if p.is_file()]
if len(sources)!=1:raise SystemExit('Expected exactly one chat Markdown export in --source; isolate it in its own export directory.')
source=sources[0];raw=source.read_text(encoding='utf-8')
def write(name,data):(out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
matches=list(re.finditer(r'^\[(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\] (.+)$',raw,re.M))
messages=[]
for i,m in enumerate(matches):
    body=raw[m.end():matches[i+1].start() if i+1<len(matches) else len(raw)].strip()
    messages.append(dict(id=f'm{i+1:05d}',date=m[1],author=m[2],text=body,line=raw.count('\n',0,m.start())+1,assets=re.findall(r'\]\(<([^>]+)>\)',body)))
if not messages:raise SystemExit('No timestamped messages found.')
write('messages.json',messages)
for n in range(3):
    subset=messages[len(messages)*n//3:len(messages)*(n+1)//3]
    (out/f'chunk-{n+1}.md').write_text('\n\n'.join(f"[{m['id']}] {m['date']} {m['author']} (源文件行 {m['line']})\n{m['text']}" for m in subset),encoding='utf-8')
reports=list(root.glob('*_assets/resource-report.jsonl'));records=[]
for report in reports:records.extend(json.loads(l) for l in report.read_text(encoding='utf-8').splitlines() if l.strip())
inventory=dict(source=source.name,count=len(messages),start=messages[0]['date'],end=messages[-1]['date'],sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),years=dict(collections.Counter(m['date'][:4] for m in messages)),resource_status=dict(collections.Counter(r['status'] for r in records)),resource_kinds=dict(collections.Counter(r['kind'] for r in records)))
write('inventory.json',inventory)
catalog=[]
for m in messages:
    match=re.search(r'^\[文件\] (.+)',m['text'])
    if not match:continue
    name=match[1].strip();paths=[p for p in m['assets'] if '/file/' in p]
    item=dict(name=name,messageId=m['id'],date=m['date'],paths=paths,available=bool(paths),family=family_key(name))
    if paths:
        p=(root/paths[0]).resolve()
        if not p.is_relative_to(root):raise SystemExit('Export attachment points outside the source directory.')
        if not p.is_file():item['available']=False;catalog.append(item);continue
        item.update(size=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
        text=''
        try:
            if p.suffix in ('.docx','.pptx','.xlsx'):
                with zipfile.ZipFile(p) as z:
                    names=[n for n in z.namelist() if n=='word/document.xml' or re.fullmatch(r'ppt/slides/slide\d+\.xml',n) or n=='xl/sharedStrings.xml']
                    text='\n'.join(' '.join(e.text for e in ET.fromstring(z.read(n)).iter() if e.tag.endswith('}t') and e.text) for n in names)
            elif p.suffix=='.txt':text=p.read_text(encoding='utf-8',errors='replace')
            item['textPreview']=text[:20000]
        except Exception as e:item['extractionError']=type(e).__name__
    catalog.append(item)
write('attachments.json',catalog)
print(json.dumps(dict(source=source.name,parsedRecords=len(messages),fileMessages=len(catalog),output=str(out)),ensure_ascii=False))
