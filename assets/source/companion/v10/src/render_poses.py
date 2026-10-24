import bpy,math,json,sys
from mathutils import Vector,Matrix
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
version='v10'
file=str(ROOT/'output/study-companion.blend')
bpy.ops.wm.open_mainfile(filepath=file)
sc=bpy.context.scene;cam=sc.camera;sc.cycles.samples=48;sc.cycles.use_denoising=False
sc.render.resolution_x=900;sc.render.resolution_y=1100
B=lambda p:Vector((p[0],-p[2],p[1]))
poses={'read':(.44,-.02,-.12,.42),'tea':(.9395,0,.12,.38)}
roots={o.name:o for o in bpy.data.objects if o.type=='EMPTY'}
props=[]
def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8;return m
paper=material('Paper ivory',(.78,.71,.56));cover=material('Blue binding',(.10,.16,.25));wood=material('Chair walnut',(.16,.09,.055));fabric=material('Chair sage cushion',(.22,.28,.25));porcelain=material('Porcelain ivory',(.82,.78,.65));ink=material('Page typography',(.23,.20,.17))
def cube(name,p,size,m,transform=Matrix.Identity(4)):
 bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.name=name;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.matrix_world=transform@Matrix.Translation(B(p));o.data.materials.append(m);mod=o.modifiers.new('Soft product edges','BEVEL');mod.width=.003;mod.segments=3;props.append(o);return o
def sph(name,p,size,m,transform=Matrix.Identity(4)):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20);o=bpy.context.object;o.name=name;o.scale=(size[0],size[2],size[1]);o.matrix_world=transform@Matrix.Translation(B(p))@Matrix.Diagonal((*o.scale,1));o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
 props.append(o);return o
def curve(name,pts,r,m,transform=Matrix.Identity(4)):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=3;sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
 for p,co in zip(sp.points,pts):p.co=(*B(co),1)
 o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);o.matrix_world=transform;o.data.materials.append(m);props.append(o)
for pose,(y,z,rx,tilt) in poses.items():
 for o in props:bpy.data.objects.remove(o,do_unlink=True)
 props=[]
 torso=Matrix.Translation(B((0,y,z)))@Matrix.Rotation(rx,4,'X')
 head=torso@Matrix.Translation(B((0,.555,.01)))@Matrix.Rotation(tilt,4,'X')
 visible={'head','hair','upper_'+pose,'hands_'+pose,'lapSeated' if pose=='read' else 'lowerStand'}
 for name,r in roots.items():
  if name.startswith(('upper_','hands_')):r.matrix_world=torso
  elif name in ['head','headOpen','hair']:r.matrix_world=head
  else:r.matrix_world=Matrix.Identity(4)
  for o in r.children:o.hide_render=name not in visible
 if pose=='read':
  cube('Presentation chair seat',(0,.386,0),(.47,.06,.45),fabric)
  cube('Presentation chair back',(0,.69,-.19),(.45,.58,.08),fabric)
  for x in [-.20,.20]:
   for zz in [-.16,.16]:cube('Chair leg',(x,.18,zz),(.035,.36,.035),wood)
  bookmat=torso@Matrix.Translation(B((0,.29,.36)))@Matrix.Rotation(-.75,4,'X')
  for side in [-1,1]:
   trans=bookmat@Matrix.Translation(B((side*.068,0,0)))@Matrix.Rotation(side*-.1,4,'Y')
   cube('Book hardcover',(0,0,0),(.132,.006,.178),cover,trans)
   cube('Book pages',(0,.009,0),(.125,.014,.17),paper,trans)
   for k in range(12):
    cube('Printed text line',(0,.0165,-.064+k*.011),(.096 if k%4 else .073,.00025,.0014),ink,trans)
 else:
  pot=torso@Matrix.Translation(B((.01,.285,.48)))@Matrix.Rotation(-.5,4,'Y')
  sph('Teapot body',(0,0,0),(.07,.06,.07),porcelain,pot)
  sph('Teapot lid',(0,.055,0),(.034,.009,.034),porcelain,pot)
  sph('Teapot lid knob',(0,.067,0),(.008,.008,.008),cover,pot)
  curve('Teapot spout',[(-.055,-.01,0),(-.085,.018,0),(-.11,.015,0)],.012,porcelain,pot)
  curve('Teapot handle',[(.062+.039*math.sin(math.pi*i/20),-.05+.035*math.cos(math.pi*i/20),0) for i in range(21)],.007,porcelain,pot)
  cube('Presentation tea table',(0,.7975,.59),(.50,.035,.40),wood)
  for x in [-.2,.2]:cube('Tea table leg',(x,.38,.64),(.03,.76,.03),wood)
  # Hollow cup: exterior, rolled rim, interior wall and recessed tea surface.
  cx,cz=-.0937254649,.5059287446
  vs=[];fs=[];n=48
  profile=[(.035,.830),(.039,.842),(.045,.887),(.045,.890),(.042,.893),(.039,.887),(.029,.842)]
  for rr,yy in profile:
   for j in range(n):
    a=2*math.pi*j/n;vs.append(tuple(B((cx+rr*math.cos(a),yy,cz+rr*math.sin(a)))))
  for k in range(len(profile)-1):
   for j in range(n):a=k*n+j;b=k*n+(j+1)%n;fs.append((a,b,b+n,a+n))
  me=bpy.data.meshes.new('Open teacup');me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new('Hollow teacup with porcelain rim',me);bpy.context.collection.objects.link(o);o.data.materials.append(porcelain);props.append(o)
  for f in me.polygons:f.use_smooth=True
  tea=material('Amber tea',(.15,.058,.012))
  bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.038,depth=.002,location=B((cx,.876,cz)));o=bpy.context.object;o.name='Recessed tea surface';o.data.materials.append(tea);props.append(o)
  curve('Cup handle',[(cx+.05,.861+.024*math.cos(2*math.pi*i/40),cz+.024*math.sin(2*math.pi*i/40)) for i in range(41)],.005,porcelain)
  sph('Saucer',(cx,.821,cz),(.075,.006,.075),porcelain)
  # Same endpoint as runtime nozzle, not an invented stream that misses the cup.
  curve('Pouring tea stream',[(cx,1.1257001153,cz),(cx,.877,cz)],.0015,tea)
 # Camera position is exactly the runtime actor-local viewpoint, optical axis
 # recentered and narrower FOV for a model inspection crop, not a UI screenshot.
 data=json.load(open(str(ROOT/'src/camera-contract.json')))[0]['poses'][pose]
 cam.location=B(data['cameraLocal']);target=B((0,.65 if pose=='read' else .87,.05));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='PERSP';cam.data.lens=95 if pose=='read' else 60
 sc.render.filepath=str(ROOT/'previews'/('v10-'+pose+'.png'));bpy.ops.render.render(write_still=True)
