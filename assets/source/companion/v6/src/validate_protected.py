from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent.parent
expected=json.loads((R/'src/approved-v5-protected.json').read_text());m=json.loads((R/'output/companion-stylized.json').read_text());b=(R/'output/companion-stylized.bin').read_bytes()
report={'baselineRuntimeSHA256':'c3fe27a0266b788550eb50e3c359a82627c1deedcdcf76f22abad7c8f8c8edfa','runtimeSHA256':hashlib.sha256(b).hexdigest(),'sourceSHA256':hashlib.sha256((R/'src/build_companion.py').read_bytes()).hexdigest(),'headFaceHair':{},'paletteUnchanged':m['palette']==expected['_palette'],'proportions':m['proportions'],'torsoHeightOffsets':m['torsoHeightOffsets'],'seatCoreContact':json.loads((R/'output/structure-validation.json').read_text())['seatCoreContact']}
assert report['paletteUnchanged']
for p in m['parts']:
 if p['name'] not in expected:continue
 e=expected[p['name']]
 for k in ['verts','tris','lo','hi']:assert p[k]==e[k],(p['name'],k)
 records=sorted((b[p['pos']+i*6:p['pos']+i*6+6]+b[p['nrm']+i*3:p['nrm']+i*3+3]+b[p['mat']+i:p['mat']+i+1]).hex() for i in range(p['verts']))
 h=hashlib.sha256('\n'.join(records).encode()).hexdigest();assert h==e['hash'],p['name']
 report['headFaceHair'][p['name']]={'exactPositionNormalMaterialSet':True,'hash':h}
assert m['proportions']=={'headUniformScale':.95,'standingLegScaleAboveAnkle':1.10,'ankleAnchor':.065,'seatedKneeForwardOffset':.037}
assert abs(m['torsoHeightOffsets']['tea']-.0795)<1e-12
(R/'output/v5-protection-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
