import bpy,os
from pathlib import Path
from mathutils import Vector,Matrix
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'output/study-companion.blend'))
sc=bpy.context.scene;cam=sc.camera
sc.cycles.samples=128;sc.cycles.use_denoising=False
sc.render.resolution_percentage=100
sc.render.resolution_x=800;sc.render.resolution_y=1000
sc.render.filepath=str(root/'previews/02-fullbody-direction.png');bpy.ops.render.render(write_still=True)
def camera(loc,target,scale):
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale
camera((1.5,-3.8,1.93),(0,-.035,1.48),.79)
sc.render.resolution_x=800;sc.render.resolution_y=800
sc.render.filepath=str(root/'previews/03-portrait-direction.png');bpy.ops.render.render(write_still=True)
camera((1.8,-3.8,1.98),(0,-.065,1.14),.93)
sc.render.filepath=str(root/'previews/05-garment-detail.png');bpy.ops.render.render(write_still=True)
# Actual read-pose skin meshes, not a separate decorative hand model.
for o in bpy.data.objects:
 if o.type=='MESH':o.hide_render=not o.name.startswith('hands_read__')
bpy.data.objects['hands_read'].matrix_world=Matrix.Identity(4)
for o in bpy.data.objects:
 if o.type=='LIGHT':o.location.z-=.9
camera((0,-1.2,.8),(0,-.31,.30),.40)
sc.render.resolution_x=1000;sc.render.resolution_y=700
sc.render.filepath=str(root/'previews/06-actual-reading-hands.png');bpy.ops.render.render(write_still=True)
