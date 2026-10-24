import bpy,sys,os
from mathutils import Vector,Matrix
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
path=str(ROOT/'output/study-companion.blend')
bpy.ops.wm.open_mainfile(filepath=path)
s=bpy.context.scene;c=s.camera
s.cycles.samples=48;s.cycles.use_denoising=False;s.render.resolution_x=900;s.render.resolution_y=1000
# Identical neutral studio camera and light for an honest art comparison.
c.location=(1.5,-3.8,1.93);target=Vector((0,-.035,1.48));c.rotation_euler=(target-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=.70
s.render.filepath=str(ROOT/'previews/v10-portrait.png');bpy.ops.render.render(write_still=True)
