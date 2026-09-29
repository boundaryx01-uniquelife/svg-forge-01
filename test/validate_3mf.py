import sys, zipfile, re, numpy as np, trimesh, lib3mf
import xml.etree.ElementTree as ET
W=lib3mf.get_wrapper()
NS={'m':'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}
ok=True
for f in sys.argv[1:]:
    # 1) lib3mf로 읽기 (스펙 준수)
    model=W.CreateModel(); rd=model.QueryReader('3mf'); rd.SetStrictModeActive(True)
    try:
        rd.ReadFromFile(f); warn=rd.GetWarningCount()
    except Exception as e:
        print('FAIL lib3mf read', f, e); ok=False; continue
    meshes=model.GetMeshObjects(); n=0; man=0
    while meshes.MoveNext():
        mo=meshes.GetCurrentMeshObject(); n+=1
        if mo.IsManifoldAndOriented(): man+=1
    comps=model.GetComponentsObjects(); nc=0
    while comps.MoveNext(): nc+=1
    # 2) trimesh로 파트별 watertight/부피
    z=zipfile.ZipFile(f); root=ET.fromstring(z.read('3D/3dmodel.model'))
    vols=[]
    for ob in root.find('m:resources',NS).findall('m:object',NS):
        mesh=ob.find('m:mesh',NS)
        if mesh is None: continue
        V=np.array([[float(v.get(k)) for k in 'xyz'] for v in mesh.find('m:vertices',NS)])
        T=np.array([[int(t.get(k)) for k in ('v1','v2','v3')] for t in mesh.find('m:triangles',NS)])
        tm=trimesh.Trimesh(V,T,process=False)
        vols.append((ob.get('name'), tm.is_watertight, tm.is_winding_consistent, round(tm.volume,1)))
    cfg=z.read('Metadata/model_settings.config').decode()
    ext=re.findall(r'<part id="(\d+)"[^>]*>\s*<metadata key="name" value="([^"]+)"/>\s*<metadata key="extruder" value="(\d+)"',cfg)
    good = warn==0 and man==n and all(v[1] and v[2] and v[3]>0 for v in vols)
    ok&=good
    print(('PASS ' if good else 'FAIL ')+f.split('/')[-1], f'| lib3mf 경고 {warn} | 메시 {n} (닫힌·방향일치 {man}) | 조립 {nc}')
    for v,e in zip(vols,ext): print('     ',v[0].ljust(14),'watertight',v[1],'winding',v[2],'vol',v[3],'mm³ | 필라멘트',e[2])
print('ALL OK' if ok else 'SOME FAILED')
