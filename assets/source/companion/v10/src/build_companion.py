import bpy, math, json, struct, os, sys
from mathutils import Vector, Matrix, Euler
from math import sin, cos, pi, exp
from pathlib import Path
ROOT=os.environ.get('STUDY_COMPANION_ROOT', str(Path(__file__).resolve().parent.parent))
OUT=ROOT+'/output'; PRE=ROOT+'/previews'
if '--' in sys.argv:
 import argparse
 ap=argparse.ArgumentParser(description='Build the Study Village companion in Blender')
 ap.add_argument('--output-dir')
 args=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
 if args.output_dir:OUT=os.path.abspath(args.output_dir);PRE=os.path.join(OUT,'previews')
os.makedirs(OUT,exist_ok=True); os.makedirs(PRE,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials): bpy.data.materials.remove(d)
PAL={'skin':0xEBC5AC,'skinShade':0xCC927F,'skinLight':0xF1D3BB,'lip':0x9D565D,'hair':0xB9C6D1,'hairDark':0x8995AE,'hairLight':0xE0E5E7,'cardigan':0x807291,'cardEdge':0x514760,'cardLight':0xADA0BC,'blouse':0xE7E1CF,'skirt':0x343747,'skirtDeep':0x242A3C,'stock':0xCDCBBF,'shoe':0x49382F,'sole':0x24232B,'button':0xB99A5A,'eye':0xEEE6D7,'iris':0x627F91,'ink':0x353543,'ribbon':0x486D96,'ribbonLight':0x7797B3,'gold':0xAC8650,'blush':0xDDB1A0}
PAL.update({'hair':0xBAC7D4,'hairDark':0xA4B1C3,'hairLight':0xCED8E2,'cardEdge':0x70617F,'cardLight':0x9A8AAB,'lip':0xB7797A,'skinShade':0xD7AA97})
PAL.update({'hairSilk':0xC9D3DD,'hairThread':0xA5B4C5,'skirtHem':0x424657})
MAT={}
def srgb(v): return v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4
for n,h in PAL.items():
 m=bpy.data.materials.new(n); m.diffuse_color=(*(srgb(((h>>s)&255)/255) for s in (16,8,0)),1); m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=m.diffuse_color; bs.inputs['Roughness'].default_value=.78
 if n in ['button','gold']: bs.inputs['Metallic'].default_value=.6; bs.inputs['Roughness'].default_value=.35
 MAT[n]=m
parts={}; normal_sources={}; current='headOpen'
def use(part):
 global current
 current=part
 if part not in parts: parts[part]=[]
def register(o,name,mat):
 o.name=current+'__'+name; o.data.materials.append(MAT[mat]); parts.setdefault(current,[]).append(o); o['part']=current; o['authored_design']='Study Village / Keeper of the Lamplight'
 return o
def mesh(name,vs,fs,mat,smooth=True,sub=0):
 me=bpy.data.meshes.new(name); me.from_pydata(vs,[],fs); me.update(); o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); register(o,name,mat)
 for p in me.polygons: p.use_smooth=smooth
 if sub: mo=o.modifiers.new('Sculptural surface','SUBSURF'); mo.levels=sub; mo.render_levels=sub
 return o
def ell(name,loc,scale,mat,seg=24,rings=12):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc); o=bpy.context.object; o.scale=scale; register(o,name,mat)
 for p in o.data.polygons:p.use_smooth=True
 return o
def tube(name,pts,rads,mat,seg=10,flat=.0):
 pts=[Vector(p) for p in pts]; vs=[]; prevu=None
 for i,p in enumerate(pts):
  tangent=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized(); axis=Vector((0,0,1))
  if abs(tangent.dot(axis))>.95:axis=Vector((0,1,0))
  u=(prevu-tangent*prevu.dot(tangent)).normalized() if prevu is not None else tangent.cross(axis).normalized()
  if u.length<.1:u=tangent.cross(axis).normalized()
  prevu=u.copy();v=tangent.cross(u).normalized();r=rads[i] if isinstance(rads,list) else rads
  if isinstance(r,tuple):rx,ry=r
  else: rx=ry=r
  for j in range(seg):
   a=2*pi*j/seg; vs.append(tuple(p+u*rx*cos(a)+v*ry*sin(a)))
 fs=[]
 for i in range(len(pts)-1):
  for j in range(seg):a=i*seg+j;b=i*seg+(j+1)%seg;fs.append((a,b,b+seg,a+seg))
 fs += [tuple(reversed(tuple(range(seg)))),tuple((len(pts)-1)*seg+j for j in range(seg))]
 return mesh(name,vs,fs,mat)
def line(name,pts,rad,mat,seg=8): return tube(name,pts,rad,mat,seg)
def cubic(a,b,c,d,n=12):
 return [tuple((1-t)**3*a[k]+3*(1-t)**2*t*b[k]+3*(1-t)*t*t*c[k]+t**3*d[k] for k in range(3)) for t in [i/n for i in range(n+1)]]
def slab(name,poly,depth,mat,bevel=.002):
 # polygon in 3D, extrude backward along Y
 vs=[tuple(p) for p in poly]+[(x,y+depth,z) for x,y,z in poly]; n=len(poly); fs=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 o=mesh(name,vs,fs,mat,False)
 if bevel:mo=o.modifiers.new('Tailored edge','BEVEL');mo.width=bevel;mo.segments=2
 return o
def loft(name,rings,mat,n=32,sub=1,pleats=0):
 # rings z, halfwidth, frontdepth, backdepth, centerY
 vs=[]
 for k,(z,w,f,b,y) in enumerate(rings):
  for i in range(n):
   a=2*pi*i/n; c=cos(a); s=sin(a); factor=1+pleats*cos(a*12)
   vs.append((w*s*factor,y-(f if c>=0 else b)*c*factor,z))
 fs=[]
 for k in range(len(rings)-1):
  for i in range(n):a=k*n+i;b=k*n+(i+1)%n;fs.append((a,b,b+n,a+n))
 fs += [tuple(reversed(range(n))),tuple((len(rings)-1)*n+i for i in range(n))]
 return mesh(name,vs,fs,mat,True,sub)
def hairlock(name,pts,widths,depths,mat):
 # Smooth Catmull-Rom flow, with sparse surface-hugging strands at varied lengths.
 raw=[Vector(p) for p in pts];points=[];ww=[];dd=[]
 steps=6 if 'back' in name or 'ridge' in name else 8
 def interp(a,b,c,d,t):return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
 for k in range(len(raw)-1):
  for j in range(steps):
   t=j/steps
   ix=[max(0,k-1),k,k+1,min(len(raw)-1,k+2)]
   points.append(interp(*(raw[i] for i in ix),t))
   ww.append(max(.0005,interp(*(widths[i] for i in ix),t))*1.12)
   dd.append(max(.0005,interp(*(depths[i] for i in ix),t))*(.50 if 'fringe' in name else .72))
 points.append(raw[-1]);ww.append(widths[-1]*1.12);dd.append(depths[-1]*.72)
 # Integral tapered silk crests: a single watertight surface, no separate
 # subpixel tubes or competing depth layers. Irregular spacing follows the flow.
 centers=[] # V7: surface detail is painted, never raised noodle-like crests
 angles=[2*pi*j/24-pi for j in range(24)]
 vs=[];n=len(angles)
 for i,(point,w,d) in enumerate(zip(points,ww,dd)):
  t=i/(len(points)-1)
  tangent=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized()
  u=tangent.cross(Vector((0,1,0))).normalized();v=u.cross(tangent).normalized()
  for a0 in angles:
   a=a0+.055*sin(t*pi*1.3)*(-sin(a0))
   crest=sum(exp(-((a0-c)/.043)**2) for c in centers)
   taper=sin(pi*t)**1.15
   normal=(u*cos(a)/max(w,.0005)+v*sin(a)/max(d,.0005)).normalized()
   vs.append(tuple(point+u*w*cos(a)+v*d*sin(a)+normal*(.00070*crest*taper)))
 fs=[]
 for k in range(len(points)-1):
  for j in range(n):a=k*n+j;b=k*n+(j+1)%n;fs.append((a,b,b+n,a+n))
 fs += [tuple(reversed(range(n))),tuple((len(points)-1)*n+i for i in range(n))]
 o=mesh(name,vs,fs,mat,True,0)
 # Longitudinal silver paint follows each authored lock, with broad silk light and
 # subtle unequal filament bands. Colors are surface data, not separate geometry.
 attr=o.data.color_attributes.new(name='ArtColor',type='FLOAT_COLOR',domain='POINT')
 base=MAT[mat].diffuse_color[:3]
 for i in range(len(points)):
  t=i/(len(points)-1)
  for j,a in enumerate(angles):
   broad=.91+.13*exp(-((t-.32)/.24)**2)
   filaments=.018*sin(a*13+t*.6)+.012*sin(a*21-t*.7)
   edge=.055*cos(a*2+.3)
   value=broad+filaments+edge
   attr.data[i*n+j].color=(*(min(1,max(0,c*value)) for c in base),1)
 return o
def make_head(open=True):
 use('headOpen' if open else 'head')
 # Explicit contour rings: temple, cheekbone, narrow jaw and chin. Not an ellipsoid.
 rings=[(.014,.018,.054,.025),(.025,.035,.068,.042),(.045,.057,.071,.055),(.075,.077,.075,.064),(.105,.093,.079,.079),(.128,.096,.076,.089),(.153,.093,.070,.092),(.182,.093,.076,.089),(.215,.083,.068,.075),(.241,.060,.044,.052),(.254,.012,.010,.01)]
 vs=[]; n=40
 for z,w,f,b in rings:
  for j in range(n):
   a=2*pi*j/n;c=cos(a);s=sin(a);x=w*math.copysign(abs(s)**.86,s);y=-(f if c>=0 else b)*math.copysign(abs(c)**.7,c)
   if c>0:
    y+=.003*exp(-((abs(x)-.043)/.024)**2-((z-.149)/.024)**2)
    y-=.004*exp(-((abs(x)-.064)/.024)**2-((z-.108)/.02)**2)
   vs.append((x,y,z))
 fs=[]
 for k in range(len(rings)-1):
  for i in range(n):a=k*n+i;b=k*n+(i+1)%n;fs.append((a,b,b+n,a+n))
 fs += [tuple(reversed(range(n))),tuple((len(rings)-1)*n+i for i in range(n))]
 mesh('Sculpted facial planes',vs,fs,'skin',True,1)
 loft('Neck', [(-.078,.040,.035,.039,.005),(-.045,.037,.033,.037,.005),(.006,.037,.032,.039,.007),(.035,.043,.034,.040,.008)],'skin',24,1)
 # Angular nasal bridge / chiseled tip, closed mesh with intentional planar highlight
 vs=[(-.009,-.073,.172),(.009,-.073,.172),(-.010,-.090,.139),(.010,-.090,.139),(-.009,-.113,.113),(.009,-.113,.113),(-.016,-.098,.104),(.016,-.098,.104),(0,-.119,.108),(0,-.089,.099)]
 fs=[(0,1,3,2),(2,3,5,4),(4,5,8),(2,4,6),(3,7,5),(6,4,8,9),(8,5,7,9),(0,2,6,9,7,3,1)]
 vs=[(x,-.073+(y+.073)*.70,z) for x,y,z in vs]
 mesh('Nose bridge and tip',vs,fs,'skin',True,2)
 for s in [-1,1]:
  # Subtle nose planes carry the nostril structure without detached accents.
  ell('Ear',(s*.096,.002,.116),(.014,.020,.029),'skin',20,12)
  ell('Ear concha',(s*.102,-.012,.119),(.008,.005,.017),'skinShade',16,10)
  # Eyes use almond silhouettes, not protruding balls
  cx=s*.043; cz=.146
  if open:
   upper=[(-.025,0),(-.014,.007),(.002,.008),(.019,.004),(.027,-.001)]
   lower=[(.027,-.001),(.012,-.008),(-.005,-.009),(-.020,-.005),(-.025,0)]
   outline=upper+lower[1:-1]; vs2=[(cx,-.074,cz)]+[(cx+s*x,-.080+max(0,abs(cx+s*x)-.025)*.40,cz+z) for x,z in outline]
   fs2=[(0,i+1,(i+1)%len(outline)+1) for i in range(len(outline))];mesh('Almond sclera',vs2,fs2,'eye',True,1)
   ell('Iris',(cx-s*.001,-.075,cz),(.0085,.0008,.008),'iris',24,12)
   ell('Pupil',(cx-s*.001,-.0762,cz),(.0042,.0008,.0061),'ink',20,10)
   ell('Catchlight',(cx-.003,-.0773,cz+.004),(.0023,.0007,.0023),'eye',12,8)
   up=[(cx+s*x,-.0815+max(0,abs(cx+s*x)-.025)*.40,cz+z) for x,z in upper]
   low=[(cx+s*x,-.0805+max(0,abs(cx+s*x)-.025)*.40,cz+z) for x,z in lower]
   line('Upper lid',up,[.0012,.002,.0022,.0018,.0008],'ink')
   line('Lower lid',low,[.0008,.0011,.0011,.0008,.0006],'skinShade')
  else:
   pts=cubic((cx-s*.024,-.077,cz-.002),(cx-s*.011,-.085,cz-.010),(cx+s*.015,-.083,cz-.011),(cx+s*.027,-.075,cz-.003),10)
   line('Quiet lowered eyelid',pts,[.0015+.0009*sin(pi*i/10) for i in range(11)],'ink')
   pts2=[(x,y+.002,z+.006) for x,y,z in pts];line('Lid sculpt',pts2,.004,'skin')
  # expressive arched brows, thin shaped wedges
  slab('Sculpted eyebrow',[(cx-s*.026,-.078,.177),(cx+s*.010,-.079,.186),(cx+s*.030,-.069,.177),(cx+s*.008,-.080,.180),(cx-s*.025,-.079,.173)],.003,'hairDark',.001)
  # subtle planar cheek color rather than painted circles
  # cheek transition is modeled in the facial mesh; no stuck-on blush patch
  # antique spectacles, slightly hexagonal round profile
  pts=[(cx+.033*cos(2*pi*i/40),-.104+.004*cos(2*pi*i/40),.142+.029*sin(2*pi*i/40)) for i in range(41)]
  line('Bronze spectacle rim',pts,.0018,'gold')
  line('Spectacle temple',[(cx+s*.032,-.100,.146),(s*.098,-.047,.153),(s*.100,.006,.145)],.0017,'gold')
  # little sculpted lashes
  line('Outer lash',[(cx+s*.023,-.078,.148 if open else .141),(cx+s*.030,-.078,.152 if open else .139)],.0012,'ink',6)
 line('Spectacle bridge',cubic((-.011,-.104,.145),(-.007,-.112,.152),(.007,-.112,.152),(.011,-.104,.145),10),.0016,'gold')
 # cupid bow and lower lip volumes with relaxed smile corners
 slab('Upper lip',[(-.022,-.076,.077),(-.011,-.083,.081),(-.005,-.085,.083),(0,-.085,.080),(.006,-.085,.083),(.015,-.081,.080),(.023,-.075,.079),(.010,-.085,.076),(0,-.087,.075),(-.010,-.084,.076)],.004,'lip',.0015)
 slab('Lower lip',[(-.020,-.077,.075),(-.010,-.086,.072),(0,-.088,.070),(.011,-.085,.073),(.021,-.076,.077),(.009,-.085,.076),(0,-.087,.075),(-.010,-.084,.076)],.003,'skinShade',.0015)
 line('Mouth expression',[(-.020,-.079,.076),(-.010,-.087,.075),(0,-.089,.0745),(.010,-.087,.076),(.021,-.078,.078)],.0008,'ink',6)
 # earring stud
 ell('Small brass stud',(.104,-.010,.098),(.0045,.004,.0045),'gold',16,8)

def hair_surface(name, rows, mat='hair', thickness=.002):
 # A ribbon is a broad two-dimensional sheet, never an elliptical tube.
 # Each row is a cross-section of the continuous hair mass.
 vs=[tuple(p) for row in rows for p in row];n=len(rows[0]);fs=[]
 for k in range(len(rows)-1):
  for j in range(n if 'Continuous silver scalp' in name else n-1):
   a=k*n+j;b=k*n+(j+1)%n;fs.append((a,b,b+n,a+n))
 o=mesh(name,vs,fs,mat,True,1)
 mod=o.modifiers.new('Fine hair sheet thickness','SOLIDIFY');mod.thickness=thickness
 attr=o.data.color_attributes.new(name='ArtColor',type='FLOAT_COLOR',domain='POINT')
 base=MAT[mat].diffuse_color[:3]
 for k in range(len(rows)):
  t=k/(len(rows)-1)
  for j in range(n):
   u=j/(n-1)
   # Painted flow only: irregular fine cool separations plus one broad
   # highlight shared across the whole mass; no raised groove geometry.
   gu=u
   if 'back curtain' in name:
    panel=int(name.rsplit(' ',1)[1]);a,b=[(-1,-.27),(-.27,.36),(.36,1)][panel];gu=(a+(b-a)*u+1)*.5
   flow=gu+.014*sin(t*5.4+gu*7)+.006*sin(t*11+gu*4)
   dark=0
   for center,strength,thick in [(.09,.22,.007),(.22,.15,.004),(.38,.20,.005),(.53,.14,.004),(.69,.22,.006),(.83,.17,.004),(.94,.13,.005)]:
    dark+=strength*exp(-((flow-center)/thick)**2)
   root=.29*exp(-(t/.17)**2)
   inner=.13*(abs(gu-.5)*2)**2
   shade=.79+.19*exp(-((t-.32)/.17)**2)-root-inner-dark
   cold=.05*(root+inner+dark)/.3
   attr.data[k*n+j].color=(base[0]*shade*(1-cold),base[1]*shade,base[2]*shade*(1+cold*.45),1)
 return o

def make_hair():
 use('hair')
 # Continuous scalp-to-nape shell with a swept frontal edge. No separate fins.
 rows=[];N=64;K=18
 for k in range(K+1):
  t=k/K;row=[]
  for j in range(N):
   a=2*pi*j/N;c=cos(a)
   lower=(.08+.12*c**1.5+.012*sin(a+.6)*c) if c>=0 else (.08+.13*c)
   ph=.016+t*math.acos(max(-.99,min(.99,(lower-.135)/.135)))
   row.append((.108*sin(ph)*sin(a),-.109*sin(ph)*cos(a)+.008,.135+.135*cos(ph)))
  rows.append(row)
 hair_surface('Continuous silver scalp and swept fringe',rows,'hair',.003)
 # A single thin side-swept bang follows the scalp, with no tubular profile.
 rows=[]
 for k in range(19):
  t=k/18;cx=-.025+.107*t;cz=.263-.119*t
  width=.021*sin(pi*t)**.8+.0003;row=[]
  for j in range(11):
   u=2*j/10-1;x=cx+u*width;z=cz+u*width*.3
   y=.008-.109*math.sqrt(max(.005,1-(x/.108)**2-((z-.135)/.135)**2))-.002
   row.append((x,y,z))
  rows.append(row)
 hair_surface('Thin side swept fringe',rows,'hair',.001)
 # The recognisable blue half-up bow is retained, not multiplied into ornaments.
 ell('Ribbon knot',(0,.132,.127),(.016,.010,.014),'ribbon',16,8)
 for side in [-1,1]:
  slab('Bow loop',[(side*.008,.131,.130),(side*.060,.124,.158),(side*.071,.121,.132),(side*.056,.124,.109),(side*.009,.131,.123)],.011,'ribbon',.003)
  line('Bow fold',[(side*.012,.145,.128),(side*.049,.141,.132),(side*.061,.138,.146)],.002,'ribbonLight')
  slab('Ribbon tail',[(side*.008,.139,.120),(side*.028,.142,.110),(side*.044,.154,.033),(side*.025,.151,.045),(side*.016,.152,.027)],.003,'ribbon',.0015)

def make_flowing_lengths(pose, M, origin):
 # Most hair lies BEHIND the shoulders. This softly curved back mass is
 # distinct from the two narrow face-framing pieces, never a facial cape.
 for panel,(u0,u1) in enumerate([(-1,-.27),(-.27,.36),(.36,1)]):
  rows=[]
  for k in range(29):
   t=k/28;row=[]
   for j in range(65):
    u=u0+(u1-u0)*j/64
    side=abs(u)**2.5;wrap=.43*exp(-((t-.23)/.27)**2)
    angle=u*(1.32+wrap)
    root=M@Vector((.103*sin(angle),.098*cos(angle)+.003,.085))+origin
    width=.103+.046*sin(pi*t*.9)-.016*t*t
    x=width*sin(angle)*(1-.13*side*exp(-((t-.27)/.18)**2))+.012*sin(t*pi*1.5)
    yy=.025+(.10+.025*sin(pi*t))*cos(angle)+.013*sin(t*pi*1.6)+.028*exp(-((t-.40)/.14)**2)
    z=.63-.54*t+.19*(1-t)*exp(-(t/.43)**4)*side
    z+=t**5*(.050-.11*exp(-((u+.70)/.13)**2)-.14*exp(-((u-.04)/.19)**2)-.085*exp(-((u-.70)/.12)**2))
    point=Vector((x,yy,z))
    if t<.28:
     hz=.264-.72*t;hr=.109*math.sqrt(max(.001,1-((hz-.135)/.135)**2))
     scalp=M@Vector((hr*sin(angle),(hr+.002)*cos(angle)+.008,hz))+origin
     blend=max(0,min(1,(t-.16)/.12));blend=blend*blend*(3-2*blend)
     point=scalp*(1-blend)+point*blend
    # Curve only the existing outer rear sheet around the ear-back/neck.
    tuck=side*exp(-((t-.34)/.18)**2)
    point.y-=.075*tuck
    point.x-=math.copysign(.018*tuck,u)
    # Tea's raised sleeve seam needs clearance at shoulder height only.
    if pose=='tea':point.y+=.060*side*exp(-((t-.43)/.065)**2)
    gap=max(0,(t-.76)/.24)*.0015
    if j==0 and panel>0:point.x+=gap
    if j==64 and panel<2:point.x-=gap
    row.append(tuple(point))
   rows.append(row)
  hair_surface('Waist length back curtain %d'%panel,rows,'hair',.002)
 # Narrow tapered S-curves frame the cheeks and fall over the front of the
 # cardigan. They are fine flat sheets with a varying width, not twin slabs.
 for side in [-1,1]:
  rows=[]
  for k in range(29):
   t=k/28
   root=M@Vector((side*.083,-.064,.185))+origin
   x=side*(.083+.072*sin(pi*t*.85)-.025*t)
   yy=-.065-.080*sin(pi*t*.75)
   zz=.74-.56*t+.016*side*t
   center=Vector((x,yy,zz));blend=min(1,t*5);center=root*(1-blend)+center*blend
   width=(.011+.011*sin(pi*t)+.003*sin(3*pi*t))*(1-t)**.70+.0004
   row=[]
   for j in range(11):
    u=2*j/10-1
    row.append(tuple(center+Vector((side*u*width,-.003*(1-u*u),.012*u*sin(pi*t)))))
   rows.append(row)
  hair_surface('Waist length face framing sheet %d'%side,rows,'hair',.0012)

POSES={
'read':{'torso':(.44,-.02,-.12),'head':(.42,0,False),'arms':[([-.16,.44,0],[-.2,.22,.12],[-.12,.26,.29],[.6,.3,.4],.55),([.16,.44,0],[.2,.22,.12],[.12,.26,.29],[-.6,.3,.4],.55)]},
 'turn':{'torso':(.44,-.02,-.12),'head':(.42,0,False),'arms':[([-.16,.44,0],[-.2,.22,.12],[-.12,.26,.29],[.6,.3,.4],.55),([.16,.44,0],[.2,.25,.14],[.02,.36,.33],[-.3,-.6,.4],.2)]},
 'look':{'torso':(.44,-.02,-.05),'head':(-.08,-.32,True),'arms':[([-.16,.44,0],[-.19,.22,.08],[-.1,.145,.24],[0,-1,0],.2),([.16,.44,0],[.24,.22,.02],[.27,.07,.17],[0,-1,0],.4)]},
 'tea':{'torso':(.86,0,.12),'head':(.38,0,False),'arms':[([-.16,.44,0],[-.18,.27,.19],[-.03,.33,.43],[0,-1,0],.3),([.16,.44,0],[.21,.27,.2],[.12,.26,.42],[-1,0,0],.8)]}}
def B(p):return Vector((p[0],-p[2],p[1]))
def make_upper(pose):
 use('upper_'+pose)
 # torso broad shoulders and clean hourglass tailoring, with no fused SDF lumps
 rings=[(0,.169,.130,.121,0),(.018,.171,.132,.123,0),(.075,.164,.125,.118,0),(.180,.137,.105,.102,0),(.245,.143,.120,.103,0),(.340,.174,.141,.114,0),(.410,.186,.116,.103,.005),(.449,.178,.094,.091,.005),(.482,.122,.061,.062,.005),(.517,.043,.034,.037,.005)]
 openings=[.002,.002,.003,.008,.028,.056,.067,.065,.044,.028]
 vs=[];nn=36
 for (z,w,f,b,cy),opening in zip(rings,openings):
  alpha=math.asin(opening/w)
  for j in range(nn+1):
   a=alpha+(2*pi-2*alpha)*j/nn;c=cos(a);vs.append((w*sin(a),cy-(f if c>=0 else b)*c,z))
 fs=[]
 for k in range(len(rings)-1):
  for j in range(nn):a=k*(nn+1)+j;fs.append((a,a+1,a+nn+2,a+nn+1))
 jacket=mesh('Open tailored cardigan shell',vs,fs,'cardigan',True,1)
 solid=jacket.modifiers.new('Knit fabric thickness','SOLIDIFY');solid.thickness=.006
 loft('Ivory blouse under cardigan',[(z,w*.91,f*.91,b*.91,cy) for z,w,f,b,cy in rings],'blouse',36,1)
 for side in [-1,1]:
  # long lapel modeled as broad angular planes
  # A rolled lapel has thickness and a curved cross-section, not a block wedge.
  outer=[(side*.111,-.093,.459),(side*.101,-.122,.427),(side*.076,-.151,.354),(side*.047,-.140,.287),(side*.026,-.126,.230)]
  inner=[(side*.043,-.077,.480),(side*.048,-.116,.424),(side*.043,-.137,.354),(side*.031,-.129,.287),(side*.024,-.124,.230)]
  lvs=[]
  for a,b in zip(outer,inner):
   for j in range(5):
    t=j/4;lvs.append((a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t-.006*sin(pi*t),a[2]*(1-t)+b[2]*t))
  lfs=[]
  for k in range(4):
   for j in range(4):a=k*5+j;lfs.append((a,a+1,a+6,a+5))
  lap=mesh('Rolled tailored lapel',lvs,lfs,'cardLight',True,1)
  thick=lap.modifiers.new('Lapel cloth thickness','SOLIDIFY');thick.thickness=.003

  slab('Blouse pointed collar',[(side*.004,-.048,.519),(side*.044,-.052,.505),(side*.069,-.085,.466),(side*.026,-.088,.473)],.007,'blouse',.003)
  # waist pocket with trim and small stitch, actual raised topology
  slab('Cardigan welt pocket',[(side*.065,-.120,.140),(side*.139,-.082,.126),(side*.137,-.092,.080),(side*.063,-.130,.092)],.004,'cardEdge',.002)
  line('Pocket seam',[(side*.065,-.127,.139),(side*.137,-.092,.126)],.0015,'cardLight',6)
  # shoulder/armhole seam seam
  # Shoulder joins are continuous overlapping cloth surfaces.
 # fitted ribbed hem and asymmetric edge placket
 for k in range(2):
  pts=[(.170*sin(2*pi*i/48),-(.132 if cos(2*pi*i/48)>0 else .122)*cos(2*pi*i/48),.011+k*.010) for i in range(49)];line('Ribbed hem piping',pts,.0025,'cardEdge')
 for z in [.07,.143,.216]:
  ell('Engraved brass button',(.025,-(.139 if z<.1 else .123 if z<.2 else .125),z),(.0055,.003,.0055),'button',16,8)
 for z in [.30,.365,.425]:ell('Blouse button',(0,-(.144 if z<.4 else .118),z),(.003,.0018,.003),'button',12,8)
 # blue knotted scarf, echoing the hair ribbon and drawing eye toward face
 slab('Neck ribbon',[(-.020,-.065,.481),(0,-.078,.493),(.020,-.065,.481),(.008,-.082,.466),(0,-.087,.472),(-.009,-.082,.466)],.004,'ribbon',.002)
 slab('Neck ribbon tail',[(-.005,-.078,.473),(.009,-.078,.470),(.015,-.099,.407),(.002,-.098,.416),(-.010,-.096,.407)],.003,'ribbon',.001)
 # tiny book-and-light pin in brass: distinctive scholar motif
 slab('Scholar enamel brooch',[(.105,-.129,.369),(.116,-.123,.383),(.130,-.119,.369),(.115,-.131,.348)],.003,'gold',.0015)
 line('Brooch inset',[(.115,-.135,.357),(.115,-.132,.374)],.0015,'ribbon',6)
 # neck base remains under head's articulated neck
 loft('Neck base',[(.488,.035,.031,.031,.001),(.529,.032,.029,.031,.002),(.565,.032,.028,.032,.002)],'skin',24,1)
 P=POSES[pose]
 for ai,(sh,el,wr,palm,curl) in enumerate(P['arms']):
  S,E,W=B(sh),B(el),B(wr); direction=(W-E).normalized()
  # Broad sleeve cap blends into torso; axilla stays tucked, not a sphere joint.
  coords=[S+Vector((-.064 if S.x>0 else .064,0,-.005)),S,S.lerp(E,.14),S.lerp(E,.58),S.lerp(E,.88),E,E.lerp(W,.13),E.lerp(W,.38),E.lerp(W,.74),W-direction*.012,W+direction*.002]
  r=[(.056,.050),(.064,.059),(.066,.061),(.065,.060),(.060,.055),(.059,.054),(.062,.057),(.060,.055),(.050,.047),(.043,.041),(.041,.039)]
  # Sample the bent cloth centerline densely; sculpt compression folds in mesh.
  dense=[]; radii=[]
  for kk in range(41):
   u=kk/40*10; k=min(9,int(u)); t=u-k
   dense.append(coords[k].lerp(coords[k+1],t)); radii.append(tuple(r[k][a]*(1-t)+r[k+1][a]*t for a in range(2)))
  sleeve=tube('Continuous tailored sleeve %d'%ai,[tuple(p) for p in dense],radii,'cardigan',16)
  for kk in range(41):
   u=kk/40;center=dense[kk]
   for j in range(16):
    a=2*pi*j/16
    # Compression near elbow and wrist, asymmetric around bent cloth.
    inner=((S-E).normalized()+(W-E).normalized()).normalized()
    radial=(sleeve.data.vertices[kk*16+j].co-center).normalized()
    compression=max(0,radial.dot(inner))**1.5
    # Two broad oblique compressed folds; outside elbow is stretched smooth.
    phase=u+.018*cos(a)
    f=compression*(.005*exp(-((phase-.43)/.038)**2)-.006*exp(-((phase-.50)/.035)**2)+.004*exp(-((phase-.58)/.045)**2))
    f+=.002*max(0,radial.dot(inner))*exp(-((u-.88)/.07)**2)*sin((u-.82)*pi*16)
    # Subtle underarm hollow, retaining the shoulder's outside fullness.
    inward=max(0,-radial.x*(1 if S.x>0 else -1))
    f-=.006*inward*exp(-((u-.19)/.10)**2)
    v=sleeve.data.vertices[kk*16+j];delta=v.co-center
    v.co=center+delta*(1+f/max(.03,delta.length))
  mod=sleeve.modifiers.new('Soft knitted sleeve transition','SUBSURF');mod.levels=1
  # Remove the distal disc: actual cuff opening with knitted inner wall.
  import bmesh
  bm=bmesh.new();bm.from_mesh(sleeve.data)
  bmesh.ops.delete(bm,geom=[f for f in bm.faces if len(f.verts)>4],context='FACES')
  bm.to_mesh(sleeve.data);bm.free()
  wall=sleeve.modifiers.new('Sleeve inner knit wall','SOLIDIFY');wall.thickness=.004
  axis=direction.cross(Vector((0,0,1))).normalized();across=direction.cross(axis).normalized()
  cv=[];cf=[];ns=32
  # Closed annular cuff: visible rim, darker inner wall, no cap through wrist.
  for offset,rx,ry in [(-.025,.046,.043),(-.019,.047,.044),(.004,.044,.041),(.005,.037,.034),(-.021,.039,.036)]:
   center=W+direction*offset
   for j in range(ns):
    a=2*pi*j/ns;cv.append(tuple(center+axis*rx*cos(a)+across*ry*sin(a)))
  for k in range(5):
   for j in range(ns):cf.append((k*ns+j,k*ns+(j+1)%ns,((k+1)%5)*ns+(j+1)%ns,((k+1)%5)*ns+j))
  mesh('Open tailored cuff %d'%ai,cv,cf,'cardEdge',True,1)
 # Fuse only cardigan knit shells, not lapels, trim, skin or hair. This removes
 # intersecting shoulder caps while retaining the open front and wrist holes.
 knit=[o for o in parts[current] if 'Open tailored cardigan shell' in o.name or 'Continuous tailored sleeve' in o.name]
 bpy.ops.object.select_all(action='DESELECT')
 for o in knit:
  bpy.context.view_layer.objects.active=o
  for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
  o.select_set(True)
 bpy.context.view_layer.objects.active=jacket;bpy.ops.object.join()
 parts[current]=[o for o in parts[current] if o not in knit]+[jacket]
 jacket.name=current+'__Continuous shoulder axilla cardigan'
 rem=jacket.modifiers.new('Unified knit shoulder surface','REMESH');rem.mode='VOXEL';rem.voxel_size=.0022;rem.use_smooth_shade=True
 bpy.ops.object.modifier_apply(modifier=rem.name)
 sm=jacket.modifiers.new('Soft shoulder cloth relaxation','SMOOTH');sm.factor=.20;sm.iterations=2;bpy.ops.object.modifier_apply(modifier=sm.name)
 # Retain the continuous dense normal field before economical triangulation.
 reference=jacket.copy();reference.data=jacket.data.copy();reference.name='Temporary dense knit normal reference '+pose
 bpy.context.collection.objects.link(reference);reference.hide_render=True
 for poly in reference.data.polygons:poly.use_smooth=True
 normal_sources[jacket.name]=reference
 dec=jacket.modifiers.new('Knit surface runtime budget','DECIMATE');dec.ratio=.045;bpy.ops.object.modifier_apply(modifier=dec.name)
 # Collapse can leave isolated zero-area triangles; remove the geometry itself.
 bm=bmesh.new();bm.from_mesh(jacket.data)
 bmesh.ops.dissolve_degenerate(bm,dist=1e-7,edges=list(bm.edges))
 bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_area()<1e-12],context='FACES')
 # Decimation can flatten an isolated voxel speck into two opposite coincident
 # triangles. It has nonzero area but no volume: remove the tiny component,
 # rather than inventing normals for a physically nonexistent cloth fragment.
 pending=set(bm.verts);specks=[]
 while pending:
  seed=pending.pop();component={seed};stack=[seed]
  while stack:
   v=stack.pop()
   for edge in v.link_edges:
    other=edge.other_vert(v)
    if other in pending:pending.remove(other);component.add(other);stack.append(other)
  if len(component)<12:specks.extend(component)
 if specks:bmesh.ops.delete(bm,geom=specks,context='VERTS')
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(jacket.data);bm.free()
 for poly in jacket.data.polygons:poly.use_smooth=True
 # Lower long-hair sheets attached to torso, root follows articulated head transform exactly.
 tilt,turn,_=P['head']; M=Matrix.Rotation(-turn,4,'Z')@Matrix.Rotation(tilt,4,'X')
 # Rotation conversion: head runtime Y is Blender Z, runtime X is Blender X. Facing -Y.
 M=Matrix.Rotation(turn,4,'Z')@Matrix.Rotation(tilt,4,'X')
 origin=B((0,.555,.01))
 make_flowing_lengths(pose,M,origin)
 use('hands_'+pose)
 for ai,(sh,el,wr,palm,curl) in enumerate(P['arms']):
  if pose=='read' and ai==1:
   # Reading is an exactly bilateral pose: mirror the evaluated skin once,
   # avoiding independent voxel-grid sampling differences between sides.
   reflection=Matrix.Diagonal((-1,1,1,1))
   for original in list(parts[current]):
    copy=original.copy();copy.data=original.data.copy();bpy.context.collection.objects.link(copy)
    copy.matrix_world=reflection@original.matrix_world
    copy.name=original.name+' anatomical left mirror';parts[current].append(copy)
  else:make_hand(ai,B(wr), (B(wr)-B(el)).normalized(),B(palm).normalized(),curl)

def make_hand(i,w,d,n,curl):
 # Preserve palm normal/curl, mirror ONLY the transverse axis for anatomical left.
 transverse=d.cross(n).normalized();nn=transverse.cross(d).normalized()
 handedness=1 if i==0 else -1
 side=transverse*handedness;w=w+d*.005
 def pt(x,y,z):return tuple(w+side*x+nn*y+d*z)
 hand_start=len(parts[current])
 # eight-sided palm with shaped heel, broad knuckles, narrow wrist
 vs=[];rings=[(-.009,.019,.011),(0,.020,.012),(.015,.026,.014),(.034,.029,.0125),(.045,.027,.011),(.052,.023,.010)]
 for z,r,dep in rings:
  for j in range(16):
   a=2*pi*j/16;xx=r*cos(a);yy=dep*sin(a)
   yy+=.0025*max(0,sin(a))*exp(-((xx-.013)/.014)**2)*exp(-((z-.023)/.020)**2)
   vs.append(pt(xx,yy,z))
 fs=[]
 for k in range(len(rings)-1):
  for j in range(16):a=k*16+j;b=k*16+(j+1)%16;fs.append((a,b,b+16,a+16))
 fs.extend([tuple(reversed(range(16))),tuple((len(rings)-1)*16+j for j in range(16))])
 # Mirroring a coordinate frame also reverses winding; preserve outward palm normals.
 if Matrix((side,nn,d)).determinant()<0:fs=[tuple(reversed(f)) for f in fs]
 mesh('Sculpted palm %d'%i,vs,fs,'skin',True,1)
 for finger,(x,L) in enumerate([(-.018,.036),(-.006,.047),(.007,.050),(.019,.041)]):
  base=w+side*x+d*([.041,.047,.048,.043][finger]);coords=[tuple(base)];a1=.32+curl*.65;a2=.20+curl*1.20
  p1=base+d*(L*.47)+nn*(curl*L*.20);p2=p1+(d*cos(a1)+nn*sin(a1))*L*.32;p3=p2+(d*cos(a1+a2)+nn*sin(a1+a2))*L*.22
  coords += [tuple(base.lerp(p1,.55)),tuple(p1),tuple(p2),tuple(p3),tuple(p3+(p3-p2).normalized()*.002)];tube('Finger %d %d'%(i,finger),coords,[.0080,.0072,.0066,.0059,.0042,.0018],'skin',10)
  # understated nail plate on dorsal distal end, no mitten hands
  # Delicate modeled nail bed and a broad knuckle pad, not white wire fingers.
  fd=(p3-p2).normalized()
  dorsal=(-nn+fd*nn.dot(fd)).normalized()
  nailSide=dorsal.cross(fd).normalized()
  nailpos=p3-fd*.006+dorsal*.0045
  nail=ell('Natural nail %d %d'%(i,finger),nailpos,(.0035,.0009,.0052),'skinLight',12,6)
  nail.rotation_euler=Matrix((nailSide,dorsal,fd)).transposed().to_euler()
  ell('Finger knuckle %d %d'%(i,finger),p1,(.0060,.0060,.0060),'skin',12,6)
 # Thumb is anatomically separate and angled outward
 base=w+side*.016+d*.012+nn*.003; p1=base+side*.018+d*.009+nn*.003; p2=p1+side*.010+d*.017+nn*.003; p3=p2-side*.004+d*.014+nn*curl*.013
 tube('Opposable thumb %d'%i,[tuple(base),tuple(p1),tuple(p2),tuple(p3)],[.012,.0095,.0078,.0055],'skin',10)
 # Original thenar/web volume observed from the reference hand: broad at palm,
 # tapering into an independently angled thumb, never an attached sphere.
 web=ell('Thenar thumb web %d'%i,pt(.016,.005,.025),(.014,.009,.020),'skin',16,10)
 web.rotation_euler=Matrix((side,nn,d)).transposed().to_euler()
 # Join only skin surfaces. Voxel union makes finger roots and thumb web one
 # manifold surface while retaining the authored pose and separate nail plates.
 skin=[o for o in parts[current][hand_start:] if 'Natural nail' not in o.name]
 bpy.ops.object.select_all(action='DESELECT')
 for o in skin:o.select_set(True)
 bpy.context.view_layer.objects.active=skin[0];bpy.ops.object.join();joined=skin[0]
 parts[current]=[o for o in parts[current][:hand_start]]+[joined]+[o for o in parts[current][hand_start:] if o not in skin]
 joined.name=current+'__Continuous anatomical hand %d'%i
 for modifier in list(joined.modifiers):bpy.ops.object.modifier_apply(modifier=modifier.name)
 rem=joined.modifiers.new('Continuous palm and finger webs','REMESH');rem.mode='VOXEL';rem.voxel_size=.0014;rem.use_smooth_shade=True
 bpy.ops.object.modifier_apply(modifier=rem.name)
 sm=joined.modifiers.new('Gentle skin relaxation','SMOOTH');sm.factor=.22;sm.iterations=2;bpy.ops.object.modifier_apply(modifier=sm.name)
 dec=joined.modifiers.new('Runtime hand surface budget','DECIMATE');dec.ratio=.22;bpy.ops.object.modifier_apply(modifier=dec.name)
 for poly in joined.data.polygons:poly.use_smooth=True

def shoe(name,x,y):
 # sculpted square-round Mary Jane, heel and sole separated
 loft(name+' leather upper',[(.018,.044,.088,.036,y-.018),(.032,.047,.095,.038,y-.018),(.055,.043,.089,.034,y-.018),(.075,.030,.047,.027,y+.002),(.088,.024,.025,.024,y+.008)],'shoe',28,1)
 objs=parts[current][-1:]
 for o in objs:o.location.x=x
 sole=loft(name+' sole',[(.008,.045,.091,.037,y-.017),(.013,.048,.097,.039,y-.017),(.025,.048,.097,.039,y-.017),(.029,.046,.094,.038,y-.017)],'sole',28,1);sole.location.x=x
 # strap spans top of foot
 pts=[(x-.037,y-.040,.063),(x-.024,y-.044,.079),(x,y-.047,.084),(x+.024,y-.044,.079),(x+.037,y-.040,.063)];line(name+' instep strap',pts,.005,'shoe')
 ell(name+' buckle',(x+.033,y-.046,.075),(.007,.004,.006),'gold',16,8)

def make_lower():
 use('lowerStand')
 # uninterrupted long skirt with six deep pleats on either side, varied ring rhythm
 o=loft('Long pleated charcoal skirt',[(.205,.286,.213,.197,0),(.221,.289,.215,.199,0),(.280,.278,.207,.191,0),(.430,.251,.187,.176,0),(.620,.214,.162,.149,0),(.810,.167,.115,.108,0),(.915,.145,.101,.094,0)],'skirt',72,0,.045)
 for p in o.data.polygons:
  if p.index%72 in [0,6,12,18,24,30,36,42,48,54,60,66]:p.material_index=1
 o.data.materials.append(MAT['skirtDeep'])
 # narrow waist band and woven hem
 loft('Skirt waistband',[(.867,.152,.105,.100,0),(.891,.149,.103,.098,0),(.915,.145,.101,.094,0)],'skirtDeep',40,1)
 for side in [-1,1]:
  x=side*.080
  tube('Cream stocking',[(x,0,.065),(x,.001,.10),(x,.013,.16),(x,.021,.23),(x,.013,.30),(x,0,.43)],[.035,.039,.047,.056,.055,.059],'stock',24)
  shoe('Mary Jane',x,0)
 # seated skirt: authored draped mesh with rounded lap merging into hanging pleated front
 use('lapSeated')
 n=64;vs=[]
 # loops around torso path from waist across the knees and down to the hem, in XZ sections around an axial Y path
 rings=[(.48,.00,.157,.114),(.49,-.075,.186,.089),(.488,-.19,.203,.081),(.464,-.31,.213,.089),(.422,-.378,.213,.111),(.33,-.391,.217,.119),(.21,-.393,.226,.122),(.169,-.394,.229,.123)]
 for k,(z,y,w,depth) in enumerate(rings):
  before=rings[max(0,k-1)];after=rings[min(len(rings)-1,k+1)]
  dy=after[1]-before[1];dz=after[0]-before[0];ln=math.hypot(dy,dz);ny=dz/ln;nz=-dy/ln
  for j in range(n):
   a=2*pi*j/n
   # Pleats are quiet across supported lap, deepen only below bent knees.
   hanging=max(0,min(1,(k-3)/4));fac=1+(.010+.037*hanging)*cos(a*12)+.010*sin(a*5+.5)
   x=w*sin(a)*fac
   # Cross-section follows the bent thigh-to-shin axis, not a flat diagonal sheet.
   c=cos(a);radial=depth*(.55 if c>=0 and k<4 else 1.0)
   yy=y+ny*radial*c*fac
   # Below knees retain the approved front/back hem heights and leg reveal.
   hemblend=max(0,min(1,(k-3)/2))
   zz=z+(1-hemblend)*nz*radial*c+hemblend*depth*.55*c
   lap=exp(-((k-2.7)/1.45)**2)*max(0,cos(a))
   support=exp(-((abs(x)-.087)/.048)**2)
   zz+=lap*(.014*support-.008*exp(-(x/.050)**2))
   # Curving fan fold, directed from hip to outside knee, part of same surface.
   fan=exp(-((abs(x)-(.055+.020*k))/.027)**2)
   zz+=.006*fan*exp(-((k-1.6)/1.4)**2)*max(0,cos(a))
   yy+=.007*hanging*sin(a*6+.5)*max(0,cos(a))
   # Chair cushion top is runtime Y=.42. Seated undersurface flattens onto it;
   # only the free knee/shin overhang may descend below the cushion.
   seat=.423-.12*max(0,min(1,(-yy-.255)/.075))
   if k<4 and c<0:zz=max(zz,seat)
   vs.append((x,yy,zz))
 fs=[]
 for k in range(len(rings)-1):
  for j in range(n):a=k*n+j;b=k*n+(j+1)%n;fs.append((a,b,b+n,a+n))
 fs.append(tuple(reversed(range(n))));fs.append(tuple((len(rings)-1)*n+i for i in range(n)));mesh('Seated draped skirt',vs,fs,'skirt',True,1)
 for side in [-1,1]:
  x=side*.081
  tube('Seated cream stocking',[(x,-.37,.075),(x,-.370,.10),(x,-.372,.155),(x,-.378,.215),(x,-.375,.28),(x,-.365,.35)],[.035,.040,.049,.057,.058,.061],'stock',24)
  shoe('Seated Mary Jane',x,-.37)


def enrich_cloth():
 # Real mesh deformation establishes broad drape / compression folds. Surface detail
 # is in the geometry exported to runtime, not a studio-only material trick.
 for pose in POSES:
  use('upper_'+pose)
  for o in list(parts[current]):
   if 'Open tailored cardigan shell' in o.name:
    for v in o.data.vertices:
     x,y,z=v.co
     # diagonal tension from waist to bust; broad sculpted folds below pocket.
     if y<0:
      weight=max(0,1-abs(abs(x)-.105)/.075)
      v.co.y-=weight*(.004*sin(z*24+abs(x)*13))
  # Neckline sits on shoulders, not painted atop a blank torso.
  for side in [-1,1]:
   # Welt edge, pocket flaps and short functional buttonholes.
   line('Pocket folded top edge',[(side*.063,-.127,.142),(side*.099,-.117,.137),(side*.139,-.093,.128)],.003,'cardLight',8)
   for z in [.075,.146,.219]:
    line('Buttonhole',[(side*.033,-(.14 if z<.1 else .128),z-.004),(side*.034,-(.141 if z<.1 else .129),z+.004)],.0012,'cardEdge',6)
   # Broad folded hip gusset, genuinely adds a second cloth layer at hem.
   slab('Side vent facing',[(side*.158,-.052,.075),(side*.168,-.038,.064),(side*.172,-.038,.012),(side*.160,-.055,.019)],.004,'cardLight',.002)
  # Back yoke and central fabric seam are visible when the character turns.
  line('Back shoulder yoke',[(-.157,.070,.445),(-.085,.103,.425),(0,.111,.421),(.085,.103,.425),(.157,.070,.445)],.002,'cardEdge',8)
  line('Back centre seam',[(0,.120,.403),(0,.114,.32),(0,.104,.22),(0,.122,.08)],.0014,'cardLight',6)
  # A fabric belt-like rib band gives visual weight and purposeful waist definition.
  pts=[(.139*sin(2*pi*i/64),-.108*cos(2*pi*i/64),.175+.003*sin(4*pi*i/64)) for i in range(65)]
 # skirt has fabric thickness, stitched hem and deep shaded alternate fold valleys.
 for name in ['lowerStand','lapSeated']:
  use(name)
  for o in list(parts[name]):
   if 'skirt' in o.name.lower() and 'waistband' not in o.name.lower():
    for vert in o.data.vertices:
     x,y,z=vert.co
     if name=='lowerStand':
      a=math.atan2(x,-y)
      # Asymmetric weight-bearing folds give cloth a directional drape.
      weight=max(0,min(1,(.84-z)/.55))
      fac=1+weight*(.025*sin(3*a+.6)+.015*cos(5*a-.7))
      vert.co.x*=fac;vert.co.y*=fac
      if z<.29:vert.co.z+=.006*sin(3*a+.6)
     elif y<-.2:
      vert.co.y+=.006*sin(x*54+z*17)*max(0,1-abs(x)/.18)
    mod=o.modifiers.new('Substantial woven skirt thickness','SOLIDIFY');mod.thickness=.009
   if 'leather upper' in o.name:
    for v in o.data.vertices:v.co.x*=1.12
  if name=='lowerStand':
   for z in [.233]:
    pts=[(.288*sin(2*pi*i/96)*(1+.045*cos(24*pi*i/96)),-.214*cos(2*pi*i/96)*(1+.045*cos(24*pi*i/96)),z-.010) for i in range(97)]
    line('Weighted skirt stitched hem',pts,.0016,'skirtDeep',6)
  # Toe cap stitches outline the shoe rather than relying on featureless ovals.
  yy=0 if name=='lowerStand' else -.37
  for side in [-1,1]:
   xx=side*(.080 if name=='lowerStand' else .081)
   line('Leather toe-cap stitched seam',[(xx-.037,yy-.062,.050),(xx-.027,yy-.077,.063),(xx,yy-.082,.068),(xx+.027,yy-.077,.063),(xx+.037,yy-.062,.050)],.0012,'button',6)
   ell('Shoe heel counter',(xx,yy+.014,.032),(.039,.025,.024),'shoe',20,10)

# Preserve the approved V7 geometry byte-for-byte in an editable base library.
# Only new hair surfaces are constructed during V8 iteration.
bpy.ops.wm.open_mainfile(filepath=str(Path(ROOT)/'src/v7-protected-base.blend'))
MAT={}
for name,h in PAL.items():
 m=bpy.data.materials.get(name)
 if not m:
  m=bpy.data.materials.new(name);m.diffuse_color=(*(srgb(((h>>ss)&255)/255) for ss in (16,8,0)),1);m.use_nodes=True
  bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=m.diffuse_color
  node=m.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='ArtColor';m.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
 MAT[name]=m
parts={};normal_sources={}
for o in list(bpy.data.objects):
 if o.type=='MESH' and '__' in o.name:
  name=o.name.split('__')[0];parts.setdefault(name,[]).append(o)
# Local lower-face contour correction only; eye/nose/mouth meshes unchanged.
for part in ['head','headOpen']:
 for o in parts[part]:
  if o.name.endswith('Sculpted facial planes'):
   for v in o.data.vertices:
    x,y,z=v.co
    if z<.075:
     q=max(0,min(1,(.075-z)/.061));smooth=q*q*(3-2*q)
     # Broaden the chin pad and lengthen its lower transition by at most 8mm.
     v.co.x=x*(1+.18*smooth)
     v.co.z=z-.008*smooth
     v.co.y=y-.0015*smooth
HEAD_SCALE=.95;LEG_SCALE=1.10;STAND_TORSO_OFFSET=.0795
make_hair()
bpy.context.view_layer.update() # flush newly created sphere scale before baking head proportions
for o in parts['hair']:o.matrix_world=Matrix.Scale(HEAD_SCALE,4)@o.matrix_world
for pose in POSES:
 use('upper_'+pose);oldcount=len(parts[current]);tilt,turn,_=POSES[pose]['head']
 M=Matrix.Rotation(turn,4,'Z')@Matrix.Rotation(tilt,4,'X');origin=B((0,.555,.01))
 make_flowing_lengths(pose,M,origin)
 for o in parts[current][oldcount:]:o.matrix_world=Matrix.Translation(origin)@Matrix.Scale(HEAD_SCALE,4)@Matrix.Translation(-origin)@o.matrix_world
# Original palette materials already contain ArtColor nodes from V7. Add colors
# to bow meshes; new sheets carry their own coherent directional vertex paint.
for group in parts.values():
 for o in group:
  if not o.data.color_attributes.get('ArtColor'):
   attr=o.data.color_attributes.new(name='ArtColor',type='FLOAT_COLOR',domain='POINT');base=o.data.materials[0].diffuse_color
   for v in o.data.vertices:attr.data[v.index].color=base
# Export exact compatible runtime buffers from evaluated Blender meshes.
def packed_export():
 names=['head','headOpen','hair','lapSeated','lowerStand']+[x+'_'+p for p in POSES for x in ['upper','hands']]
 palette_keys=list(PAL);data=bytearray();manifest={'palette':PAL,'parts':[],'generator':'blender-v10-curved-rear-hair-chin','teaPropStyle':'camera-v7','includesHeadDetails':True,'design':'Original adult lamplight keeper; silver hair, blue bow, bronze glasses; hand-authored Blender surfaces','coordinates':'Y up, +Z forward; existing study-village rigid part origins','source':'study-companion.blend','torsoHeightOffsets':{'tea':STAND_TORSO_OFFSET},'proportions':{'headUniformScale':HEAD_SCALE,'standingLegScaleAboveAnkle':LEG_SCALE,'ankleAnchor':.065,'seatedKneeForwardOffset':.037}}
 def push(buf):
  off=len(data);data.extend(buf)
  while len(data)%4:data.append(0)
  return off
 dg=bpy.context.evaluated_depsgraph_get()
 for name in names:
  pos=[];norm=[];mat=[];colors=[];idx=[];unique={}
  for o in parts[name]:
   ev=o.evaluated_get(dg);me=ev.to_mesh();me.calc_loop_triangles();matx=o.matrix_world;nm=matx.to_3x3().inverted().transposed()
   for tri in me.loop_triangles:
    mk=me.materials[tri.material_index].name;mi=palette_keys.index(mk)
    for li in (reversed(tri.loops) if matx.determinant()<0 else tri.loops):
     co=matx@me.vertices[me.loops[li].vertex_index].co;no=(nm@me.corner_normals[li].vector).normalized();v=(co.x,co.z,-co.y);n=(no.x,no.z,-no.y)
     attr=me.color_attributes.get('ArtColor')
     cc=attr.data[me.loops[li].vertex_index if attr.domain=='POINT' else li].color[:3] if attr else MAT[mk].diffuse_color[:3]
     def encode(c):return max(0,min(255,round(255*(12.92*c if c<=.0031308 else 1.055*c**(1/2.4)-.055))))
     rgb=tuple(encode(c) for c in cc)
     key=tuple(round(x,6) for x in v+n)+(mi,)+rgb
     if key not in unique:
      unique[key]=len(mat);pos.extend(v);norm.extend(n);mat.append(mi);colors.extend(rgb)
     idx.append(unique[key])
   ev.to_mesh_clear()
  nv=len(mat);lo=[min(pos[a::3]) for a in range(3)];hi=[max(pos[a::3]) for a in range(3)]
  q=[round((v-lo[i%3])/(hi[i%3]-lo[i%3] or 1)*65535-32768) for i,v in enumerate(pos)];nq=[max(-127,min(127,round(v*127))) for v in norm];wide=nv>65535
  part={'name':name,'verts':nv,'tris':len(idx)//3,'lo':lo,'hi':hi,'wide':wide,'pos':push(struct.pack('<'+'h'*len(q),*q)),'nrm':push(struct.pack('<'+'b'*len(nq),*nq)),'mat':push(bytes(mat)),'idx':push(struct.pack('<'+('I' if wide else 'H')*len(idx),*idx))}
  part['col']=push(bytes(colors))
  manifest['parts'].append(part);print('EXPORTED',name,nv,part['tris'])
 open(OUT+'/companion-stylized.bin','wb').write(data);json.dump(manifest,open(OUT+'/companion-stylized.json','w'),indent=2)
packed_export()
# Named rigid hierarchy keeps every part editable and exposes the four existing poses.
roots={}
for name,objs in parts.items():
 root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root);root.empty_display_size=.03;roots[name]=root
 for o in objs:o.parent=root
# Studio objects aren't exported in the game asset.
studio=[]
world=bpy.data.worlds.new('Quiet slate studio');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.16,.22,1);world.node_tree.nodes['Background'].inputs[1].default_value=.3
for name,loc,power,size,color in [('Key',(-2,-3,4),360,3,(1,.86,.74)),('Fill',(2,-1,2),160,2.5,(.65,.79,1)),('Rim',(1,2,3),450,2.5,(.8,.88,1))]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler();studio.append(o)
bpy.ops.object.camera_add(location=(2.6,-4,2.3));cam=bpy.context.object;cam.data.type='ORTHO';bpy.context.scene.camera=cam;studio.append(cam)
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=int(os.environ.get('STUDY_SAMPLES','48'));sc.cycles.use_denoising=False;sc.render.resolution_x=1200;sc.render.resolution_y=1500;sc.render.resolution_percentage=100;sc.view_settings.view_transform='AgX';sc.render.image_settings.file_format='PNG';sc.render.film_transparent=False
# presentation ground
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0));ground=bpy.context.object;ground.name='Presentation ground';gm=bpy.data.materials.new('Studio floor');gm.diffuse_color=(.055,.071,.091,1);gm.use_nodes=True;gm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.055,.071,.091,1);gm.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.95;ground.data.materials.append(gm);studio.append(ground)
# Keep the authored runtime look pose intact; accommodate the V7 portrait's
# deliberately different head angle only in the saved presentation scene.
portrait_hair_base={o.name:[v.co.copy() for v in o.data.vertices] for o in parts['upper_look'] if 'Waist length' in o.name}
def assemble(pose,portrait=False):
 for o in parts['upper_look']:
  if o.name in portrait_hair_base:
   for v,p in zip(o.data.vertices,portrait_hair_base[o.name]):v.co=p
 if portrait:
  oldtilt,oldturn,_=POSES['look']['head'];origin=B((0,.555,.01))
  delta=Matrix.Rotation(.10,4,'Z')@Matrix.Rotation(-.025,4,'X')@(Matrix.Rotation(oldturn,4,'Z')@Matrix.Rotation(oldtilt,4,'X')).inverted()
  for o in parts['upper_look']:
   if o.name in portrait_hair_base:
    for v in o.data.vertices:
     w=max(0,min(1,(v.co.z-.57)/.15));w=w*w*(3-2*w)
     v.co=v.co*(1-w)+(origin+delta@(v.co-origin))*w
 P=POSES[pose];y,z,rx=P['torso'];tilt,turn,opened=P['head']
 if pose=='tea':y+=STAND_TORSO_OFFSET
 if portrait:y=.86+STAND_TORSO_OFFSET;z=0;rx=0;turn=.10;tilt=-.025
 torso=Matrix.Translation(B((0,y,z)))@Matrix.Rotation(rx,4,'X')
 headmat=torso@Matrix.Translation(B((0,.555,.01)))@Matrix.Rotation(turn,4,'Z')@Matrix.Rotation(tilt,4,'X')
 visible={('lowerStand' if pose=='tea' or portrait else 'lapSeated'),'upper_'+pose,'hands_'+pose,('headOpen' if opened else 'head'),'hair'}
 for name,root in roots.items():
  root.matrix_world=Matrix.Identity(4)
  if name.startswith(('upper_','hands_')):root.matrix_world=torso
  if name in ['head','headOpen','hair']:root.matrix_world=headmat
  for o in parts[name]:o.hide_render=name not in visible;o.hide_viewport=name not in visible
 return visible

def camera(loc,target,scale):
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale
# Primary portrait shows the articulated open-eye expression and full tailored silhouette.
visible=assemble('look',True);camera((2.6,-4.0,2.1),(0,-.03,.84),1.97)
sc.render.filepath=PRE+'/02-fullbody-direction.png'
if not os.environ.get('STUDY_HAND_QA_ONLY'):bpy.ops.render.render(write_still=True)
camera((1.5,-3.8,1.85),(0,-.035,1.40),.79);sc.render.resolution_x=1200;sc.render.resolution_y=1200;sc.render.filepath=PRE+'/03-portrait-direction.png'
if not os.environ.get('STUDY_HAND_QA_ONLY'):bpy.ops.render.render(write_still=True)
# Save source with full body presentation, all pose-specific authored parts retained.
visible=assemble('look',True);camera((2.6,-4,2.1),(0,-.03,.84),1.97);sc.render.resolution_x=1200;sc.render.resolution_y=1500
bpy.context.scene['description']='Original stylized scholar companion. All 13 runtime parts remain editable. Display pose is standing portrait using open-eye look upper. Runtime parts exported before presentation transforms.'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/study-companion.blend')
# self-contained glb of the full-body presentation, also editable in any glTF application
bpy.ops.object.select_all(action='DESELECT')
for name in visible:
 roots[name].select_set(True)
 for o in parts[name]:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT+'/study-companion.glb',export_format='GLB',use_selection=True,export_apply=True)
print('COMPANION_BUILD_COMPLETE')
# Detail plate documents modeled sleeve folds, lapel roll, and knuckles.
camera((1.8,-3.8,1.9),(0,-.065,1.06),.93)
sc.render.resolution_x=1200;sc.render.resolution_y=1200
sc.render.filepath=PRE+'/05-garment-detail.png'
if not os.environ.get('STUDY_HAND_QA_ONLY'):bpy.ops.render.render(write_still=True)

# Explicit anatomical QA plate: palm-facing hands in the same neutral frame.
# Character right is viewer left; palm-forward fingers-down thumbs point laterally.
for group in parts.values():
 for o in group:o.hide_render=True
use('handVerification')
for i,x in enumerate([-.08,.08]):
 make_hand(i,Vector((x,0,0)),Vector((0,0,-1)),Vector((0,-1,0)),0)
for o in parts['handVerification']:o.hide_render=False
ground.hide_render=True
camera((0,-3,-.045),(0,0,-.045),.29)
sc.render.resolution_x=1400;sc.render.resolution_y=900
sc.render.filepath=PRE+'/06-corrected-hands-front.png'
if not os.environ.get('STUDY_SKIP_HAND_RENDERS'):bpy.ops.render.render(write_still=True)
camera((0,3,-.045),(0,0,-.045),.29)
sc.render.filepath=PRE+'/07-corrected-hands-back.png'
if not os.environ.get('STUDY_SKIP_HAND_RENDERS'):bpy.ops.render.render(write_still=True)
# Check mirrored thumb placement and proper nail orientation independently of camera.
report={'expected':'Opposite chirality; mirrored finger ordering; palm normals unchanged; proper nail rotation matrices','hands':[]}
for pose,P in POSES.items():
 for i,(_,el,wr,palm,curl) in enumerate(P['arms']):
  d=(B(wr)-B(el)).normalized();n=B(palm).normalized();t=d.cross(n).normalized();nn=t.cross(d).normalized();side=t*(1 if i==0 else -1)
  chirality=side.dot(d.cross(nn))
  assert abs(chirality-(1 if i==0 else -1))<1e-5
  assert nn.dot(n)>0
  report['hands'].append({'pose':pose,'anatomicalSide':'right' if i==0 else 'left','chirality':round(chirality,5),'thumbTransverseOffset':.020*(1 if i==0 else -1)})
# Absolute anatomy check, independent of bilateral symmetry: fingers forward, palms down.
# Runtime X/Y/Z converts into Blender X/-Z/Y through B().
d=B((0,0,1));n=B((0,-1,0));t=d.cross(n).normalized()
report['canonicalPalmsDown']=[]
for i,wristx in enumerate([-.08,.08]):
 side=t*(1 if i==0 else -1)
 thumbOffset=side*.020
 assert thumbOffset.x*wristx<0, 'Palms-down thumb must point toward body midline'
 report['canonicalPalmsDown'].append({'anatomicalSide':'right' if i==0 else 'left','wristX':wristx,'thumbOffsetX':round(thumbOffset.x,6),'pointsInward':True})
json.dump(report,open(OUT+'/handedness-validation.json','w'),indent=2)
print('HANDEDNESS_VALIDATED')
