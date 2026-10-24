import bpy,os
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/study-companion.blend'))
s=bpy.context.scene;c=s.camera;s.cycles.samples=24;s.cycles.use_denoising=False;s.render.resolution_x=720;s.render.resolution_y=900
# Review the actual geometry under one flat hair color. This is not texture QA.
for m in bpy.data.materials:
 if m.name.startswith('hair'):
  nt=m.node_tree;bs=nt.nodes.get('Principled BSDF')
  for link in list(nt.links):
   if link.to_node==bs and link.to_socket==bs.inputs['Base Color']:nt.links.remove(link)
  bs.inputs['Base Color'].default_value=(.31,.36,.43,1);bs.inputs['Roughness'].default_value=1
c.data.type='ORTHO';c.data.ortho_scale=1.02
for name,pos in [('front',(0,-4,1.5)),('three-quarter',(2.8,-4,1.5)),('back',(0,4,1.5))]:
 c.location=pos;c.rotation_euler=(Vector((0,0,1.36))-c.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(ROOT/'previews'/('v10-silhouette-'+name+'.png'));bpy.ops.render.render(write_still=True)
