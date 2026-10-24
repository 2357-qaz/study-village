import bpy,json,hashlib,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent

def records(file):
 bpy.ops.wm.open_mainfile(filepath=str(file));out={}
 for o in bpy.data.objects:
  if o.type!='MESH' or not '__' in o.name:continue
  if 'Waist length back curtain' in o.name or o.name.endswith('Sculpted facial planes'):continue
  dg=bpy.context.evaluated_depsgraph_get();ev=o.evaluated_get(dg);me=ev.to_mesh();me.calc_loop_triangles()
  # Geometry is compared in local object frames, presentation visibility ignored.
  data=[a for v in sorted(tuple(round(x,6) for x in v.co) for v in me.vertices) for a in v]
  h=hashlib.sha256(struct.pack('<'+'d'*len(data),*data)).hexdigest()
  out[o.name]={'sha256':h,'triangles':len(me.loop_triangles),'materials':[m.name for m in me.materials]}
  ev.to_mesh_clear()
 return out
v7=records(ROOT.parent/'v8/output/study-companion.blend');v8=records(ROOT/'output/study-companion.blend')
assert v7==v8, {'missing':list(set(v7)-set(v8)),'added':list(set(v8)-set(v7)),'changed':[k for k in v7 if k in v8 and v7[k]!=v8[k]]}
assert not any('Ear transition' in o.name for o in bpy.data.objects), 'V9 additive side hair must be absent'
report={'noAdditiveEarHair':True,'protectedObjects':len(v7),'exactEvaluatedGeometryAndMaterials':True,'excludes':'two face base meshes and deformed original back-hair sheets only','reference':'V8'}
(ROOT/'output/preserved-validation.json').write_text(json.dumps(report,indent=2));print(report)
