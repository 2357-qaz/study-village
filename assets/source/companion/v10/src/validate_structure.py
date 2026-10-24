import bpy,bmesh,json,math
from pathlib import Path
R=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(R/'output/study-companion.blend'))
report={'hands':[],'knit':[],'cuffs':[],'protectedProportions':{},'referencePolicy':'Original Study Village meshes with the preserved owned body cache; no third-party source meshes imported.'}
for o in bpy.data.objects:
 if o.type!='MESH':continue
 key='hands' if 'Continuous anatomical hand' in o.name else 'knit' if 'Continuous shoulder axilla cardigan' in o.name else 'cuffs' if 'Open tailored cuff' in o.name else None
 if not key:continue
 bm=bmesh.new();bm.from_mesh(o.data)
 report[key].append({'name':o.name,'vertices':len(bm.verts),'faces':len(bm.faces),'boundaryEdges':sum(e.is_boundary for e in bm.edges),'nonmanifoldEdges':sum(not e.is_manifold for e in bm.edges),'nonfinite':sum(not math.isfinite(a) for v in bm.verts for a in v.co),'volume':bm.calc_volume(signed=False),'customNormals':o.data.has_custom_normals,'smoothFaces':sum(p.use_smooth for p in o.data.polygons)})
 bm.free()
for hand in report['hands']:assert hand['boundaryEdges']==hand['nonmanifoldEdges']==hand['nonfinite']==0,hand
for knit in report['knit']:assert knit['boundaryEdges']==knit['nonmanifoldEdges']==0 and knit['customNormals'],knit
for c in report['cuffs']:assert c['boundaryEdges']==c['nonmanifoldEdges']==0,c
lap=next(o for o in bpy.data.objects if o.type=='MESH' and 'Seated draped skirt' in o.name)
oldhidden=lap.hide_viewport;lap.hide_viewport=False;lap.hide_set(False);bpy.context.view_layer.update()
e=lap.evaluated_get(bpy.context.evaluated_depsgraph_get());me=e.to_mesh()
core=[v.co.copy() for v in me.vertices if abs(v.co.x)<.24 and -.25<v.co.y<.29]
report['seatCoreContact']={'sampling':'evaluated cloth within x +/- .24, forward <= .25','cushionTop':.42,'minimumUnderside':min(v.z for v in core),'maximumLapTop':max(v.z for v in core)}
e.to_mesh_clear();lap.hide_viewport=oldhidden
manifest_path=R/'output/companion-stylized.json'
if not manifest_path.exists():manifest_path=R.parents[3]/'dist/assets/companion-v10.json'
manifest=json.loads(manifest_path.read_text());report['protectedProportions']=manifest['proportions'];report['torsoHeightOffsets']=manifest['torsoHeightOffsets'];report['parts']=len(manifest['parts'])
assert report['parts']==13
assert len(report['hands'])==8
(R/'output/structure-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
