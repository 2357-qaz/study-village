import bpy,math,os,json,ast
from mathutils import Vector,Matrix
from pathlib import Path
R=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(R/'output/study-companion.blend'))
src=ast.parse((R/'src/build_companion.py').read_text())
POSES=next(ast.literal_eval(n.value) for n in src.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='POSES' for t in n.targets))
def B(p):return Vector((p[0],-p[2],p[1]))
sc=bpy.context.scene;cam=sc.camera
sc.cycles.samples=int(os.getenv('STUDY_SAMPLES','48'));sc.render.resolution_x=800;sc.render.resolution_y=1000
sc.render.resolution_percentage=100
roots={o.name:o for o in bpy.data.objects if o.type=='EMPTY' and o.name in ['head','headOpen','hair','lapSeated','lowerStand']+[x+'_'+p for p in POSES for x in ['upper','hands']]}
def pose(p,portrait=False):
 P=POSES[p];y,z,rx=P['torso'];tilt,turn,opened=P['head']
 if p=='tea':y+=.0795
 if portrait:y=.9395;z=0;rx=0;turn=.10;tilt=-.025
 torso=Matrix.Translation(B((0,y,z)))@Matrix.Rotation(rx,4,'X')
 head=torso@Matrix.Translation(B((0,.555,.01)))@Matrix.Rotation(turn,4,'Z')@Matrix.Rotation(tilt,4,'X')
 visible={('lowerStand' if p=='tea' or portrait else 'lapSeated'),'upper_'+p,'hands_'+p,('headOpen' if opened else 'head'),'hair'}
 for name,root in roots.items():
  root.matrix_world=torso if name.startswith(('upper_','hands_')) else head if name in ['head','headOpen','hair'] else Matrix.Identity(4)
  for o in root.children:o.hide_render=name not in visible
 bpy.context.view_layer.update()
def render(name,loc,target,scale):
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale
 sc.render.filepath=str(R/'previews'/name);bpy.ops.render.render(write_still=True)
pose('look',True);render('02-fullbody-direction.png',(2.6,-4,2.1),(0,-.03,.84),1.97)
sc.render.resolution_y=800
render('05-garment-detail.png',(1.8,-3.8,1.9),(0,-.065,1.06),.93)
pose('read');render('08-read-side-structure.png',(3,-1.8,1.2),(0,-.15,.66),1.15)
render('09-read-front-structure.png',(0,-4,1.5),(0,-.15,.66),1.15)
