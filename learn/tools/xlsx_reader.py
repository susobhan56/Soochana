import zipfile, re, sys, xml.etree.ElementTree as ET
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
def col(ref):
    s=re.match(r'[A-Z]+',ref).group(); n=0
    for ch in s: n=n*26+ord(ch)-64
    return n-1
def read(path):
    z=zipfile.ZipFile(path)
    ss=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',NS):
            ss.append(''.join(t.text or '' for t in si.iter('{%s}t'%NS['m'])))
    wb=ET.fromstring(z.read('xl/workbook.xml'))
    rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rmap={r.get('Id'):r.get('Target') for r in rels}
    out={}
    for s in wb.find('m:sheets',NS):
        t=rmap[s.get('{%s}id'%NS['r'])]; t=t.lstrip('/'); t=t if t.startswith('xl/') else 'xl/'+t
        rows=[]
        for row in ET.fromstring(z.read(t)).iter('{%s}row'%NS['m']):
            vals={}
            for c in row.findall('m:c',NS):
                v=c.find('m:v',NS); typ=c.get('t')
                if typ=='inlineStr':
                    val=''.join(x.text or '' for x in c.iter('{%s}t'%NS['m']))
                elif v is None: continue
                elif typ=='s': val=ss[int(v.text)]
                else:
                    val=v.text
                    try: val=float(val); val=int(val) if val.is_integer() else round(val,4)
                    except: pass
                vals[col(c.get('r'))]=val
            if vals: rows.append([vals.get(i) for i in range(max(vals)+1)])
        out[s.get('name')]=rows
    return out
if __name__=='__main__':
    n=int(sys.argv[2]) if len(sys.argv)>2 else 5
    for name,rows in read(sys.argv[1]).items():
        print('=====',sys.argv[1].split('/')[-1],'|',name,len(rows),'rows')
        for r in rows[:n]: print([c for c in r if c is not None][:16])
