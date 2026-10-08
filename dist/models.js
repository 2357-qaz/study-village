import * as THREE from './vendor/three.module.min.js';
// Procedural low-poly models. Every model is written against a Builder, so the same code can be
// baked into a few merged meshes (village), rendered as live meshes (ghost preview) or with rich
// materials (collectible viewer).
const PI=Math.PI,H=PI/2;
export const P={wall:0xf1e5c3,wall2:0xe9d6ad,wall3:0xf4ead2,timber:0x7b5b3f,dark:0x56412f,plinth:0xbab3a2,stone:0xaaa597,stone2:0x8d897d,stone3:0xc9c2b0,glass:0xc5ddd6,door:0x8b6242,sill:0xdcc9a2,brick:0xb8714f,roofR:0xc8744f,roofB:0x5f81a6,roofG:0x6c9070,roofP:0x7a70b2,roofBr:0xa86c45,roofT:0x4f6e6a,gold:0xe8bd52,leaf:0x6e9c5b,leaf2:0x88ae67,leaf3:0x527f52,trunk:0x8a6a4a,straw:0xe6c977,red:0xd0614e,white:0xf7f2e6,metal:0x8f9aa3,rope:0xcab38b,soil:0x8f6c49,water:0x7ec6c0,cloth:0xf0e3c8,pink:0xf2b3c4,flowerbox:0x8a6448};
export function shade(c,l){const col=new THREE.Color(c);col.offsetHSL(0,0,l);return col.getHex();}
const G=new Map();
function cached(key,make){let g=G.get(key);if(!g){g=make();if(g.index)g=g.toNonIndexed();g.deleteAttribute('uv');g.computeVertexNormals();G.set(key,g);}return g;}
const unitBox=()=>cached('box',()=>new THREE.BoxGeometry(1,1,1));
function unitCyl(rt,rb,n,open){const m=Math.max(rt,rb)||1;return cached(`cyl${(rt/m).toFixed(3)}:${(rb/m).toFixed(3)}:${n}:${open?1:0}`,()=>new THREE.CylinderGeometry(rt/m,rb/m,1,n,1,!!open));}
const unitIco=d=>cached('ico'+d,()=>new THREE.IcosahedronGeometry(1,d));
const unitSph=(ws,hs,t0,tl)=>cached(`sph${ws}:${hs}:${t0}:${tl}`,()=>new THREE.SphereGeometry(1,ws,hs,0,PI*2,t0,tl));
const unitPrism=()=>cached('prism',()=>{const sh=new THREE.Shape();sh.moveTo(-.5,0);sh.lineTo(.5,0);sh.lineTo(0,1);sh.closePath();const g=new THREE.ExtrudeGeometry(sh,{depth:1,bevelEnabled:false});g.translate(0,0,-.5);return g;});
const unitTor=(R,n,m,arc)=>cached(`tor${R}:${n}:${m}:${arc}`,()=>new THREE.TorusGeometry(1,R,n,m,arc));
const _e=new THREE.Euler(),_q=new THREE.Quaternion(),_p=new THREE.Vector3(),_s=new THREE.Vector3();
function local(x,y,z,o,sx=1,sy=1,sz=1){const s=o?.s??1;_e.set(o?.rx||0,o?.ry||0,o?.rz||0,'YXZ');_q.setFromEuler(_e);_p.set(x,y,z);_s.set(sx*s*(o?.sx??1),sy*s*(o?.sy??1),sz*s*(o?.sz??1));return new THREE.Matrix4().compose(_p,_q,_s);}
export class Builder{
 constructor(sink){this.sink=sink;this.m=new THREE.Matrix4();this.st=[];}
 push(x=0,y=0,z=0,o){this.st.push(this.m.clone());this.m.multiply(local(x,y,z,o));return this;}
 pop(){this.m=this.st.pop();return this;}
 at(x,y,z,o,fn){if(typeof o==='function'){fn=o;o=null;}this.push(x,y,z,o);fn();this.pop();}
 add(g,c,x,y,z,o,sx,sy,sz){this.sink.add(g,c,new THREE.Matrix4().multiplyMatrices(this.m,local(x,y,z,o,sx,sy,sz)),o||{});}
 box(w,h,d,c,x=0,y=0,z=0,o){this.add(unitBox(),c,x,y,z,o,w,h,d);}
 cyl(rt,rb,h,c,x=0,y=0,z=0,n=8,o){const m=Math.max(rt,rb);this.add(unitCyl(rt,rb,n,o?.open),c,x,y,z,o,m,h,m);}
 cone(r,h,c,x=0,y=0,z=0,n=7,o){this.cyl(0,r,h,c,x,y,z,n,o);}
 ball(r,c,x=0,y=0,z=0,o){this.add(unitIco(o?.detail??0),c,x,y,z,o,r,r,r);}
 sph(r,c,x=0,y=0,z=0,o){this.add(unitSph(o?.ws??10,o?.hs??7,o?.t0??0,o?.tl??PI),c,x,y,z,o,r,r,r);}
 prism(w,h,d,c,x=0,y=0,z=0,o){this.add(unitPrism(),c,x,y,z,o,w,h,d);}
 tor(R,r,c,x=0,y=0,z=0,o){this.add(unitTor(+(r/R).toFixed(3),o?.n??6,o?.m??16,o?.arc??PI*2),c,x,y,z,o,R,R,R);}
 geo(g,c,x=0,y=0,z=0,o){this.add(g,c,x,y,z,o);}
 dyn(anim,fn,x=0,y=0,z=0,o){const grp=this.sink.dynamic(new THREE.Matrix4().multiplyMatrices(this.m,local(x,y,z,o)),anim);const sub=new Builder(new LiveSink(grp,this.sink.matFn));fn(sub,grp);return grp;}
}
export class LiveSink{
 constructor(root,matFn){this.root=root;this.matFn=matFn;}
 add(g,c,m,o){const mesh=new THREE.Mesh(g,this.matFn(c,o));mesh.applyMatrix4(m);mesh.castShadow=!o.noShadow;mesh.receiveShadow=true;this.root.add(mesh);}
 dynamic(m,anim){const grp=new THREE.Group();grp.applyMatrix4(m);grp.userData.anim=anim;this.root.add(grp);return grp;}
}
const _v=new THREE.Vector3(),_c=new THREE.Color();
export class Acc{
 constructor(){this.p=[];this.c=[];this.o=[];}
 push(g,color,m,owner){const pos=g.attributes.position;_c.setHex(color);for(let i=0;i<pos.count;i++){_v.fromBufferAttribute(pos,i).applyMatrix4(m);this.p.push(_v.x,_v.y,_v.z);this.c.push(_c.r,_c.g,_c.b);}for(let i=0;i<pos.count/3;i++)this.o.push(owner);}
 tri(a,b,c,color,owner){_c.setHex(color);for(const v of [a,b,c]){this.p.push(v[0],v[1],v[2]);this.c.push(_c.r,_c.g,_c.b);}this.o.push(owner);}
 // Quad with outward normal hint so winding is always correct.
 quad(a,b,c,d,color,owner,n){const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];const cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;if(cx*n[0]+cy*n[1]+cz*n[2]<0){this.tri(a,c,b,color,owner);this.tri(a,d,c,color,owner);}else{this.tri(a,b,c,color,owner);this.tri(a,c,d,color,owner);}}
 build(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));g.computeVertexNormals();g.computeBoundingSphere();g.userData.owners=Int32Array.from(this.o);return g;}
}
export class BakeSink{
 constructor(matFn){this.solid=new Acc();this.glow=new Acc();this.owner=0;this.dyn=[];this.matFn=matFn;}
 add(g,c,m,o){(o.glow?this.glow:this.solid).push(g,c,m,this.owner);}
 dynamic(m,anim){const grp=new THREE.Group();grp.applyMatrix4(m);grp.userData.anim=anim;grp.userData.owner=this.owner;this.dyn.push(grp);return grp;}
}

/* ---------- architectural helpers ---------- */
function plinth(b,w,d,h=.12,c=P.plinth){b.box(w,h,d,c,0,h/2,0);b.box(w+.04,.03,d+.04,shade(c,-.06),0,.015,0);}
function frame(b,w,h,d,y){for(const sx of [-1,1])for(const sz of [-1,1])b.box(.075,h,.075,P.timber,sx*w/2,y+h/2,sz*d/2);b.box(w+.06,.07,d+.06,P.timber,0,y+h-.035,0);b.box(w+.05,.05,d+.05,P.timber,0,y+.025,0);}
function braces(b,w,h,y,z){for(const s of [-1,1])b.box(.05,Math.hypot(w*.22,h)*.9,.03,P.timber,s*w*.39,y+h/2,z,{rz:s*Math.atan2(w*.22,h)});}
function win(b,x,y,z,ry=0,w=.22,h=.26,flowers=false){b.at(x,y,z,{ry},()=>{b.box(w+.07,h+.07,.04,P.timber,0,0,0);b.box(w,h,.05,P.glass,0,0,.008,{glow:1});b.box(.024,h,.065,P.timber,0,0,.012);b.box(w,.024,.065,P.timber,0,0,.012);b.box(w+.1,.035,.08,P.sill,0,-h/2-.045,.03);if(flowers){b.box(w+.04,.07,.08,P.flowerbox,0,-h/2-.1,.07);for(let i=0;i<4;i++)b.ball(.033,[0xf08aa0,0xf5d36a,0xffffff,0xc8a6e8][i],-w*.42+i*w*.28,-h/2-.05,.08);b.ball(.04,P.leaf,0,-h/2-.06,.06,{sx:3.2,sy:.6});}});}
function arched(b,x,y,z,ry=0,w=.2,h=.36){b.at(x,y,z,{ry},()=>{b.box(w+.06,h,.04,P.stone3,0,0,0);b.box(w,h-.04,.05,P.glass,0,-.02,.008,{glow:1});b.cyl(w/2,w/2,.05,P.glass,0,h/2-.02,.008,10,{rx:H,glow:1});b.cyl(w/2+.03,w/2+.03,.04,P.stone3,0,h/2-.02,-.004,10,{rx:H});b.box(.02,h,.06,P.dark,0,0,.012);});}
function door(b,x,y,z,ry=0,w=.24,h=.4,c=P.door){b.at(x,y,z,{ry},()=>{b.box(w+.07,h+.05,.04,P.timber,0,h/2,0);b.box(w,h,.05,c,0,h/2-.012,.008);for(let i=1;i<4;i++)b.box(.012,h-.04,.056,shade(c,-.08),-w/2+i*w/4,h/2-.012,.01);b.ball(.02,P.gold,w*.3,h*.45,.045);b.box(w+.18,.05,.17,P.plinth,0,-.02,.08);});}
function gable(b,w,d,h,c,y,o={}){const oh=o.oh??.1,a=Math.atan2(h,d/2),hz=d/2+oh,L=hz/Math.cos(a);b.prism(d-.02,h,w-.02,o.wall??P.wall,0,y,0,{ry:H});for(const s of [-1,1])b.at(0,y+h-hz/2*Math.tan(a)+.02,s*hz/2,{rx:s*a},()=>{b.box(w+oh*2,.07,L,c,0,0,0);for(let k=1;k<5;k++)b.box(w+oh*2+.012,.024,.035,shade(c,-.09),0,.045,-L/2+L*k/5);b.box(w+oh*2+.02,.09,.06,shade(c,-.14),0,-.005,L/2-.02);});b.box(w+oh*2+.05,.085,.11,shade(c,-.16),0,y+h+.02,0);}
function hip(b,w,d,h,c,y){b.cyl(0,.7072,h,c,0,y+h/2,0,4,{ry:PI/4,sx:w+.24,sz:d+.24});b.box(.07,.07,.07,shade(c,-.15),0,y+h,0);}
function chimney(b,x,y,z,h=.5,smoke=true){b.box(.2,h,.2,P.brick,x,y+h/2,z);b.box(.24,.06,.24,P.stone2,x,y+h,z);if(smoke)b.dyn({type:'smoke'},s=>{for(let i=0;i<3;i++)s.ball(.07,0xf4f2ee,0,0,0,{mat:{opacity:.75},noShadow:1,detail:1});},x,y+h+.05,z);}
function lantern(b,x,y,z,post=true){if(post){b.box(.05,.5,.05,P.dark,x,y+.25,z);b.box(.18,.03,.03,P.dark,x+.06,y+.5,z);}b.at(post?x+.13:x,post?y+.42:y,z,()=>{b.box(.09,.11,.09,0xffe7a8,0,0,0,{glow:1});b.cone(.08,.07,P.dark,0,.09,0,4,{ry:PI/4});b.box(.1,.02,.1,P.dark,0,-.06,0);});}
function crate(b,x,y,z,s=.22,ry=0){b.at(x,y,z,{ry},()=>{b.box(s,s,s,0xc29a65,0,s/2,0);b.box(s+.01,.03,s+.01,0x9c7448,0,s*.8,0);b.box(s+.01,.03,s+.01,0x9c7448,0,s*.2,0);});}
function barrel(b,x,y,z,s=1){b.at(x,y,z,{s},()=>{b.cyl(.1,.1,.26,0xa57a4c,0,.13,0,10);b.cyl(.105,.105,.025,P.dark,0,.05,0,10);b.cyl(.105,.105,.025,P.dark,0,.21,0,10);});}
function sack(b,x,y,z){b.ball(.1,0xe2cfa1,x,y+.08,z,{sy:.9,detail:1});b.cyl(.03,.05,.06,0xd1bb88,x,y+.18,z,6);}
function logs(b,x,y,z,n=5,len=.8,ry=0){b.at(x,y,z,{ry},()=>{let i=0;for(let row=0;i<n;row++)for(let k=0;k<3-row&&i<n;k++,i++){const px=-.12*(2-row)+k*.24;b.cyl(.11,.11,len,0x9f7a50,px,.11+row*.19,0,8,{rz:H});b.cyl(.085,.085,len+.012,0xd9b98a,px,.11+row*.19,0,8,{rz:H});}});}
function smallTree(b,x,y,z,s=1,kind=0){b.at(x,y,z,{s},()=>{b.cyl(.04,.06,.3,P.trunk,0,.15,0,5);if(kind%2){b.cone(.24,.42,P.leaf3,0,.45,0,6);b.cone(.18,.32,P.leaf,0,.66,0,6);}else{b.ball(.22,P.leaf,0,.45,0,{detail:0});b.ball(.15,P.leaf2,.08,.6,.04);}});}
function flag(b,x,y,z,c,h=.5){b.cyl(.015,.015,h,P.dark,x,y+h/2,z,5);b.ball(.025,P.gold,x,y+h+.01,z);b.dyn({type:'flag'},s=>{s.box(.24,.14,.015,c,.12,0,0);s.prism(.14,.06,.015,c,.27,0,0,{rz:-H});},x,y+h-.09,z);}
function bench(b,x,y,z,ry=0){b.at(x,y,z,{ry},()=>{for(const s of [-1,1]){b.box(.04,.18,.2,P.dark,s*.22,.09,0);}for(let i=0;i<3;i++)b.box(.55,.025,.055,0xb98a5a,0,.19,-.06+i*.06);for(let i=0;i<2;i++)b.box(.55,.05,.025,0xb98a5a,0,.3+i*.07,-.1,{rx:-.15});});}
function fenceRun(b,x,z,len,ry=0,y=0){b.at(x,y,z,{ry},()=>{const n=Math.max(1,Math.round(len/.3));for(let i=0;i<=n;i++)b.box(.05,.28,.05,0xe2d6b2,-len/2+i*len/n,.14,0);b.box(len,.035,.03,0xd6c69f,0,.12,0);b.box(len,.035,.03,0xd6c69f,0,.22,0);});}
function stars(b,lv,y,z=.8){if(lv>1)for(let i=0;i<lv-1;i++)b.ball(.045,P.gold,-.18+i*.12,y,z,{glow:1});}

/* ---------- buildings (footprint centred at origin, front facing +z) ---------- */
const BUILD={
 cottage(b,lv){
  b.at(-.24,0,.2,()=>{plinth(b,1.24,.94);b.box(1.12,.72,.84,P.wall,0,.48,0);frame(b,1.12,.72,.84,.12);braces(b,1.12,.62,.15,.425);
   win(b,-.32,.52,.43,0,.22,.26,lv>=2);win(b,.32,.52,.43,0,.22,.26,lv>=2);door(b,0,.12,.43);win(b,-.57,.5,0,-H);win(b,.57,.5,0,H);
   gable(b,1.12,.84,.56,P.roofR,.84);chimney(b,.3,.98,-.18,.46,lv>=2);
   if(lv>=4){b.at(-.28,1.08,.27,()=>{b.box(.3,.26,.3,P.wall,0,.13,0);win(b,0,.13,.155,0,.15,.15);gable(b,.3,.3,.18,P.roofR,.26,{oh:.05});});}
   b.box(.5,.03,.18,0xe4d6b0,0,.135,.6);});
  b.at(.52,0,-.46,()=>{const th=1.32+(lv>=3?.3:0);b.cyl(.38,.42,.14,P.plinth,0,.07,0,12);b.cyl(.31,.34,th,P.wall2,0,.14+th/2,0,12);
   for(const f of [.33,.66])b.cyl(.335,.335,.05,P.timber,0,.14+th*f,0,12);
   b.at(0,.14+th*.82,.3,()=>{b.cyl(.14,.14,.04,P.white,0,0,0,18,{rx:H});b.cyl(.155,.155,.03,P.timber,0,0,-.012,18,{rx:H});b.dyn({type:'clock',hand:'h'},s=>s.box(.022,.08,.012,P.dark,0,.035,0),0,0,.03);b.dyn({type:'clock',hand:'m'},s=>s.box(.016,.11,.012,P.dark,0,.05,0),0,0,.04);});
   arched(b,0,.14+th*.48,.31,0,.13,.24);
   if(lv>=4){b.cyl(.43,.43,.04,P.timber,0,.14+th,0,12);for(let i=0;i<10;i++){const a=i/10*PI*2;b.box(.03,.14,.03,P.timber,Math.cos(a)*.41,.14+th+.08,Math.sin(a)*.41);}b.tor(.41,.012,P.timber,0,.14+th+.15,0,{rx:H,m:20});}
   b.cyl(0,.45,.62,P.roofP,0,.14+th+.31,0,12);b.cyl(.47,.47,.03,shade(P.roofP,-.12),0,.14+th+.01,0,12);
   flag(b,0,.14+th+.58,0,lv>=5?P.gold:0xe7a34d,.42);});
  // reading corner: book piles and bench
  b.at(.42,0,.55,()=>{const cs=[0xb5544a,0x4f7aa3,0xd8b04f,0x6c9a63,0x8c6bb0];for(let i=0;i<5;i++)b.box(.2-.012*i,.045,.15,cs[i],0,.025+i*.047,0,{ry:i*.25});});
  if(lv>=3){b.at(-.68,0,-.48,()=>{plinth(b,.6,.5);b.box(.52,.46,.42,P.wall3,0,.35,0);frame(b,.52,.46,.42,.12);win(b,0,.38,.215,0,.18,.18);gable(b,.52,.42,.3,P.roofR,.58,{oh:.07});});}
  if(lv>=2)lantern(b,.05,0,.82);
  if(lv>=5){bench(b,-.6,0,.82);b.ball(.07,P.gold,.52,2.62,-.46,{glow:1});}
  stars(b,lv,.06,.9);},
 sawmill(b,lv){
  b.at(-.3,0,-.28,()=>{plinth(b,1.1,.9);b.box(1.0,.66,.8,0xe5d3ad,0,.45,0);frame(b,1.0,.66,.8,.12);
   for(let i=0;i<6;i++)b.box(.012,.6,.81,0xcdb68b,-.42+i*.17,.45,0);
   win(b,-.25,.5,.41,0,.22,.24,lv>=3);door(b,.22,.12,.41,0,.28,.42,0x7d6a52);win(b,-.51,.5,0,-H);
   gable(b,1.0,.8,.52,P.roofG,.78);chimney(b,-.28,.95,-.2,.38,lv>=2);
   if(lv>=4){b.at(.6,0,-.05,()=>{b.box(.3,.5,.6,0xe5d3ad,0,.37,0);b.box(.36,.05,.66,shade(P.roofG,-.05),0,.66,0,{rz:-.25});});}});
  // open saw shed
  b.at(.42,0,.42,()=>{for(const [x,z] of [[-.38,-.3],[.38,-.3],[-.38,.32],[.38,.32]])b.box(.07,.68,.07,P.timber,x,.34,z);
   b.box(.95,.05,.82,shade(P.roofG,.04),0,.72,0,{rx:-.12});for(let k=0;k<4;k++)b.box(.97,.02,.03,shade(P.roofG,-.08),0,.75,-.3+k*.2,{rx:-.12});
   b.box(.6,.2,.3,0xa98457,0,.1,0);b.box(.64,.03,.34,0x8b6a44,0,.21,0);b.cyl(.06,.06,.5,0xd4b07c,-.05,.27,0,8,{rz:H});
   b.dyn({type:'spin',axis:'z',speed:6},s=>{s.cyl(.17,.17,.02,0xc8d0d5,0,0,0,14,{rx:H,mat:{metal:.6,rough:.35}});s.cyl(.04,.04,.03,P.dark,0,0,0,8,{rx:H});for(let i=0;i<8;i++){const a=i*PI/4;s.box(.035,.035,.021,0xa9b2b8,Math.cos(a)*.17,Math.sin(a)*.17,0,{rz:a+PI/4});}},.12,.28,.17);});
  logs(b,-.55,0,.5,lv>=3?6:5,.62,H);
  if(lv>=2)logs(b,.62,0,-.62,3,.5,0);
  crate(b,.05,0,.82,.18);
  if(lv>=5){flag(b,-.85,0,-.8,0x79a977,.9);lantern(b,.85,0,.85,true);}
  if(lv>=3)b.at(-.05,0,-.85,()=>{b.cyl(.09,.11,.12,0x9f7a50,0,.06,0,8);b.box(.03,.2,.03,P.timber,.02,.18,0,{rz:.4});b.box(.08,.05,.02,0xc8d0d5,.07,.26,0,{rz:.4});});
  stars(b,lv,.06,.95);},
 quarry(b,lv){
  const rock=[0xa5aea7,0x96a09a,0xb6bdb3,0x8b948f];
  b.at(-.2,0,-.3,()=>{b.ball(.6,rock[0],0,.38,0,{sy:.85,sx:1.25,detail:0});b.ball(.42,rock[1],.45,.32,.2,{sy:1.1});b.ball(.38,rock[2],-.55,.3,.25,{sy:.9});b.ball(.3,rock[3],.2,.82,-.1);
   b.box(.42,.22,.3,0xc9cdc5,.05,.55,.42);b.box(.3,.2,.28,0xbfc4bc,-.32,.25,.55);b.ball(.08,P.leaf,-.4,.72,.1);b.ball(.07,P.leaf2,.5,.66,.05);
   if(lv>=3)b.ball(.32,rock[1],-.15,1.05,-.15,{sy:1.2});});
  // gantry crane with hanging block
  b.at(.55,0,-.05,()=>{for(const z of [-.32,.32])b.box(.07,1.25,.07,P.timber,0,.62,z);b.box(.07,.07,.72,P.timber,0,1.24,0);b.box(.6,.07,.07,P.timber,-.24,1.2,0);b.box(.05,.5,.05,P.timber,0,1.0,.2,{rx:.7});
   b.cyl(.012,.012,.42,P.rope,-.45,.98,0,4);b.box(.2,.16,.2,0xd5d8d1,-.45,.7,0);b.cyl(.06,.06,.1,P.dark,-.45,1.2,0,8,{rx:H});});
  // stacked cut blocks
  const blocks=lv>=4?7:lv>=2?5:3;for(let i=0;i<blocks;i++){const row=i<3?0:i<5?1:2,col=i<3?i:i<5?i-3:0;b.box(.22,.16,.2,i%2?0xd7dad2:0xc8ccc3,-.35+col*.24+row*.12,.08+row*.16,.62);}
  // mine cart on rails
  b.at(.35,0,.6,()=>{for(const x of [-.06,.06])b.box(.02,.02,.6,P.metal,x,.02,0);for(let i=0;i<4;i++)b.box(.2,.015,.04,P.timber,0,.008,-.24+i*.16);b.box(.2,.12,.24,0x7f6f5d,0,.13,0);b.box(.17,.04,.21,0xb7bcb3,0,.2,0);for(const x of [-.1,.1])for(const z of [-.08,.08])b.cyl(.04,.04,.02,P.dark,x,.05,z,8,{rz:H});});
  if(lv>=3)b.at(-.75,0,.55,()=>{b.box(.32,.32,.3,0xe2d2ae,0,.16,0);b.box(.38,.04,.36,P.roofBr,0,.34,0,{rx:.15});door(b,0,0,.152,0,.12,.22);});
  if(lv>=5){lantern(b,.85,0,.8);flag(b,-.85,0,-.85,0x9cabb9,.8);}
  stars(b,lv,.06,.95);},
 farm(b,lv){
  // crop field with soil ridges
  b.at(-.38,0,.18,()=>{b.box(1.05,.07,1.35,P.soil,0,.035,0);const rows=lv>=3?5:4;for(let r=0;r<rows;r++){const z=-.55+r*(1.1/(rows-1));b.box(.95,.06,.1,0x7d5b3c,0,.09,z);for(let c=0;c<6;c++){const x=-.4+c*.16;if((lv>=4&&r===0)){b.ball(.065,0xe9973f,x,.15,z,{sy:.8,detail:1});b.box(.012,.04,.012,P.leaf3,x,.21,z);}else{b.cyl(.012,.012,.18,0x9aa651,x,.2,z,4);b.cone(.04,.12,r%2?0xe8c96a:0xdcbf62,x,.33,z,5);}}}});
  // windmill
  b.at(.5,0,-.42,()=>{plinth(b,.62,.62,.1);const th=1.3+(lv>=4?.25:0);b.cyl(.24,.34,th,0xf0e3c4,0,.1+th/2,0,8);for(const f of [.3,.62])b.cyl(.30-.08*f,.30-.08*f,.04,P.timber,0,.1+th*f,0,8);
   door(b,0,.1,.31,0,.18,.3);win(b,0,.1+th*.6,.25,0,.12,.14);
   b.cyl(.06,.32,.32,0x9aa278,0,.1+th+.16,0,8);b.cone(.09,.18,0x9aa278,0,.1+th+.36,0,8);
   b.dyn({type:'spin',axis:'z',speed:.9},s=>{s.ball(.07,P.timber,0,0,0);for(let i=0;i<4;i++)s.at(0,0,0,{rz:i*H},()=>{s.box(.04,.82,.04,P.timber,0,.42,0);s.box(.2,.6,.015,0xf3ead2,.12,.52,0);for(let k=0;k<4;k++)s.box(.21,.012,.02,P.timber,.12,.26+k*.16,0);});},0,.1+th*.88,.34);});
  // haystack & barn
  b.at(.7,0,.55,()=>{b.cyl(.2,.22,.24,P.straw,0,.12,0,10);b.cone(.21,.2,P.straw,0,.34,0,10);b.cyl(.205,.205,.02,0xd0b05a,0,.18,0,10);});
  if(lv>=3)b.at(.3,0,.68,()=>{sack(b,0,0,0);sack(b,.15,0,.05);});
  if(lv>=2)fenceRun(b,-.38,.92,1.05);
  if(lv>=5){b.at(-.85,0,-.75,()=>{b.cyl(.015,.015,.6,P.timber,0,.3,0);b.box(.32,.03,.03,P.timber,0,.45,0);b.ball(.08,P.straw,0,.48,0,{sy:1.3});b.cone(.1,.1,0xc9a95a,0,.62,0,6);});flag(b,.85,0,-.85,0xe4b750,.6);}
  stars(b,lv,.06,.98);},
 observatory(b,lv){
  b.at(0,0,-.08,()=>{b.cyl(.8,.86,.16,P.plinth,0,.08,0,12);b.cyl(.68,.72,.9,0xe7e1cb,0,.61,0,12);for(const y of [.3,.95])b.cyl(.70,.70,.05,P.stone2,0,y+.08,0,12);
   for(let i=0;i<6;i++){const a=i/6*PI*2+.26;arched(b,Math.sin(a)*.7,.55,Math.cos(a)*.7,a,.13,.26);}
   door(b,0,.16,.72,0,.24,.38,0x5f6f8a);
   b.sph(.7,0x7f97a5,0,1.06,0,{ws:16,hs:8,tl:PI/2,mat:{metal:.3,rough:.5}});
   
   for(let i=0;i<4;i++)b.tor(.705,.012,shade(0x7f97a5,-.12),0,1.06,0,{ry:i*PI/4,arc:PI,m:16});b.box(.18,.6,.02,0x3b4a5c,0,1.36,.47,{rx:-.6});
   b.at(0,1.5,.32,{rx:-.75},()=>{b.cyl(.09,.13,.85,0xc9b27c,0,.25,0,10,{mat:{metal:.5,rough:.4}});b.cyl(.1,.1,.06,P.gold,0,.66,0,10);b.cyl(.075,.075,.02,0x334455,0,.69,0,10,{glow:1});});
   b.cyl(.012,.012,.3,P.dark,0,1.85,0,4);b.dyn({type:'spin',axis:'y',speed:.6},s=>{s.ball(.06,P.gold,0,0,0,{glow:1,detail:0});s.box(.2,.02,.02,P.gold,0,0,0);s.box(.02,.02,.2,P.gold,0,0,0);},0,2.02,0);});
  if(lv>=2)lantern(b,-.75,0,.72);
  if(lv>=3)b.at(-.72,0,-.6,()=>{b.box(.4,.36,.36,0xe7e1cb,0,.18,0);b.sph(.2,0x7f97a5,0,.36,0,{tl:PI/2});});
  if(lv>=4)b.at(.75,0,.6,()=>{b.cyl(.03,.03,.5,P.dark,0,.25,0,5);b.ball(.12,0x9bb4d8,0,.58,0,{glow:1,detail:1});b.tor(.18,.012,P.gold,0,.58,0,{rx:1.1,m:20});});
  if(lv>=5)flag(b,.8,0,-.8,0x9b8fd8,.8);
  stars(b,lv,.06,.95);},
 dock(b,lv){
  // boathouse on land, pier reaching over the water (+z)
  b.at(-.35,0,-.35,()=>{plinth(b,.95,.8,.1,0x9c8f7a);b.box(.86,.58,.72,0x9ec3d4,0,.39,0);for(let i=0;i<7;i++)b.box(.012,.56,.73,0x86adc0,-.36+i*.12,.39,0);frame(b,.86,.58,.72,.1);
   door(b,.15,.1,.37,0,.26,.38,0x6c5a46);win(b,-.22,.44,.37,0,.18,.18);gable(b,.86,.72,.42,P.roofB,.68,{wall:0x9ec3d4});
   b.box(.05,.05,.3,P.timber,.0,.9,.55);b.tor(.12,.02,0xe95f4a,-.32,.5,.39,{});});
  // pier
  b.at(.38,0,.35,()=>{for(let i=0;i<9;i++)b.box(.5,.04,.13,i%2?0xb98f5f:0xc7a06c,0,.12,-.55+i*.15);for(const x of [-.22,.22])for(let k=0;k<4;k++)b.cyl(.04,.045,1.2,0x7b5b3f,x,-.45,-.5+k*.36,6);
   for(const x of [-.25,.25])b.box(.03,.03,1.2,P.timber,x,.3,.05);for(const x of [-.25,.25])for(let k=0;k<4;k++)b.box(.03,.2,.03,P.timber,x,.22,-.5+k*.36);
   b.tor(.07,.012,P.rope,.25,.16,.4,{rx:H});});
  // nets, barrels, fish rack
  b.at(-.6,0,.45,()=>{for(const x of [-.2,.2])b.box(.03,.42,.03,P.timber,x,.21,0);b.box(.44,.025,.025,P.timber,0,.4,0);b.box(.38,.3,.01,0xd8cfb4,0,.25,0,{mat:{opacity:.85}});for(let i=0;i<3;i++)b.box(.03,.1,.04,0x8fb6c9,-.12+i*.12,.33,.02);});
  barrel(b,.0,0,.62);barrel(b,-.15,0,.75,.8);
  b.dyn({type:'bob'},s=>{s.box(.26,.08,.6,0xc87d55,0,0,0);s.box(.22,.04,.52,0xe0b388,0,.05,0);s.prism(.26,.15,.08,0xc87d55,0,-.04,.32,{rx:H,s:1});s.cyl(.012,.012,.5,P.timber,0,.28,0,4);s.prism(.28,.38,.01,P.white,.0,.08,0,{ry:H});},.85,.02,.78);
  if(lv>=3)lantern(b,.62,.12,.0,true);
  if(lv>=4)b.at(-.82,0,-.82,()=>{crate(b,0,0,0,.2);crate(b,.04,.2,.02,.16,.3);});
  if(lv>=5)flag(b,-.75,.95,-.35,0x5f9ec2,.5);
  stars(b,lv,.06,-.95);},
 bakery(b,lv){
  b.at(-.15,0,-.12,()=>{plinth(b,1.2,.98,.12,0xb39e86);b.box(1.1,.7,.88,0xf3dcbc,0,.47,0);for(let r=0;r<3;r++)for(let c=0;c<5;c++)b.box(.16,.06,.01,0xd9a77f,-.4+c*.2+(r%2)*.1,.24+r*.12,.445);
   frame(b,1.1,.7,.88,.12);win(b,-.3,.52,.45,0,.26,.26,lv>=2);door(b,.22,.12,.45,0,.26,.42,0x9a5f3d);win(b,.56,.52,0,H);
   // striped awning
   for(let i=0;i<6;i++)b.box(.12,.03,.32,i%2?0xf6efe0:0xd2614e,-.45+i*.12,.86,.6,{rx:.35});b.box(.74,.06,.04,P.timber,-.15,.81,.75);
   gable(b,1.1,.88,.5,0xb85c42,.82,{wall:0xf3dcbc});chimney(b,-.32,.95,-.2,.62,true);
   b.at(.25,.98,.5,()=>{b.box(.32,.2,.03,P.timber,0,0,0);b.ball(.07,0xd99a52,-.06,0,.03,{sx:1.5,sy:.8});b.ball(.06,0xc8843f,.08,0,.03,{sx:1.2,sy:.8});});});
  // brick oven
  b.at(.62,0,.5,()=>{b.box(.42,.18,.42,0xb39e86,0,.09,0);b.sph(.2,0xc7714c,0,.18,0,{tl:PI/2,ws:10,hs:5});b.box(.1,.1,.06,0xffb067,0,.24,.18,{glow:1});b.cyl(.04,.04,.24,P.brick,.08,.42,-.08,6);});
  b.at(-.65,0,.62,()=>{b.box(.36,.24,.22,0xc49a6b,0,.12,0);for(let i=0;i<3;i++)b.ball(.06,0xd9a052,-.11+i*.11,.27,0,{sx:1.4,sy:.7});});
  if(lv>=3)b.at(.68,0,-.65,()=>{sack(b,0,0,0);sack(b,-.18,0,.05);sack(b,-.08,0,-.14);});
  if(lv>=4)bench(b,-.15,0,.82);
  if(lv>=5){lantern(b,.85,0,.05);flag(b,-.85,0,-.85,0xd69a5b,.8);}
  stars(b,lv,.06,.98);},
 kiln(b,lv){
  b.at(-.3,0,-.25,()=>{b.cyl(.48,.52,.12,0xa58c76,0,.06,0,12);b.sph(.46,0xc27a5a,0,.12,0,{ws:12,hs:6,tl:PI/2});for(let i=0;i<4;i++)b.tor(.4-i*.08,.02,shade(0xc27a5a,-.08),0,.24+i*.09,0,{rx:H,m:16,s:1});
   b.at(0,.12,.42,()=>{b.box(.26,.22,.12,0x8a5b43,0,.11,0);b.box(.17,.15,.06,0xff9a4d,0,.1,.04,{glow:1});});
   b.cyl(.09,.12,.95,0xb26a4c,.12,.85,-.15,8);b.cyl(.13,.13,.05,0x8a5b43,.12,1.32,-.15,8);b.dyn({type:'smoke'},s=>{for(let i=0;i<3;i++)s.ball(.08,0xe9e5e0,0,0,0,{mat:{opacity:.75},noShadow:1,detail:1});},.12,1.38,-.15);});
  if(lv>=3)b.at(.5,0,-.55,()=>{b.cyl(.28,.3,.08,0xa58c76,0,.04,0,10);b.sph(.27,0xc98466,0,.08,0,{tl:PI/2,ws:10,hs:5});b.box(.12,.1,.06,0xff9a4d,0,.14,.25,{glow:1});});
  // pottery shelf & pots
  b.at(.45,0,.35,()=>{for(const x of [-.3,.3])b.box(.04,.5,.2,P.timber,x,.25,0);for(const y of [.18,.38])b.box(.64,.03,.22,0xb38a5d,0,y,0);const pots=[0xc27a5a,0x6f9cb3,0xe0c9a0,0x9c6b4f,0xc27a5a,0x8aa877];pots.forEach((c,i)=>{const x=-.2+(i%3)*.2,y=i<3?.2:.4;b.cyl(.045,.06,.1,c,x,y+.05,0,8);b.cyl(.035,.045,.03,c,x,y+.11,0,8);});});
  // clay pit
  b.at(-.55,0,.5,()=>{b.cyl(.28,.24,.06,0x9e6447,0,.03,0,10);b.cyl(.22,.22,.012,0xb27454,0,.065,0,10);b.box(.04,.25,.04,P.timber,.18,.15,.1,{rz:.6});});
  if(lv>=2)for(let i=0;i<(lv>=4?6:3);i++)b.box(.18,.06,.1,0xb8714f,-.1+(i%3)*.19,.03+Math.floor(i/3)*.06,.82);
  if(lv>=5){lantern(b,.85,0,-.85);flag(b,-.85,0,.85,0xc27a5a,.7);}
  stars(b,lv,.06,-.95);},
 lumber(b,lv){
  b.at(-.2,0,-.2,()=>{b.box(1.1,.08,.86,P.stone2,0,.04,0);for(let r=0;r<6;r++){b.cyl(.06,.06,1.08,r%2?0xa77d52:0x9a714a,0,.14+r*.11,.4,7,{rz:H});b.cyl(.06,.06,1.08,r%2?0xa77d52:0x9a714a,0,.14+r*.11,-.4,7,{rz:H});b.cyl(.06,.06,.84,r%2?0x9a714a:0xa77d52,-.52,.14+r*.11,0,7,{rx:H});b.cyl(.06,.06,.84,r%2?0x9a714a:0xa77d52,.52,.14+r*.11,0,7,{rx:H});}
   b.box(1.0,.64,.76,0x8e6b47,0,.44,0);door(b,.2,.08,.44,0,.24,.4,0x6a4d33);win(b,-.25,.45,.45,0,.2,.2,lv>=2);
   gable(b,1.1,.86,.5,0x5f7b4f,.78,{wall:0x9a714a});chimney(b,-.3,.95,-.15,.4,true);
   b.box(.36,.04,.1,0xe7d3a8,.2,.6,.46);});
  for(const [x,z,s,k] of [[.75,-.7,1,1],[.55,.05,.85,0],[.78,.55,.95,1],[-.8,.65,.8,1]])smallTree(b,x,0,z,s,k+(lv>=3?0:0));
  b.at(.2,0,.65,()=>{b.cyl(.13,.15,.18,0x9f7a50,0,.09,0,9);b.cyl(.12,.12,.012,0xd9b98a,0,.185,0,9);b.box(.03,.24,.03,P.timber,.04,.27,0,{rz:-.5});b.box(.1,.06,.02,0xc8d0d5,.1,.36,0,{rz:-.5});});
  logs(b,-.45,0,.65,lv>=4?6:3,.5,0.2);
  if(lv>=3)b.at(.5,0,-.1,()=>{b.box(.04,.04,.6,P.timber,0,.3,0);for(const z of [-.28,.28])b.box(.04,.3,.04,P.timber,0,.15,z);});
  if(lv>=5)flag(b,-.85,0,-.85,0x6f8f5a,.9);
  stars(b,lv,.06,.98);},
 teahouse(b,lv){
  // raised platform + double-eave roof + lanterns
  b.at(0,0,-.05,()=>{b.box(1.4,.16,1.2,0x9b8a72,0,.08,0);b.box(1.5,.05,1.3,0xb59a76,0,.18,0);for(const x of [-.6,.6])for(const z of [-.5,.5])b.box(.08,.62,.08,0x6b3f2e,x,.5,z);
   b.box(1.0,.5,.75,0xf3ead5,0,.45,0);for(let i=0;i<5;i++)b.box(.012,.48,.76,0xc9b28d,-.4+i*.2,.45,0);b.box(1.01,.012,.76,0xc9b28d,0,.45,0);
   b.box(.3,.42,.02,0xe8c49a,0,.42,.38,{glow:1});
   b.cyl(0,.707,.32,0x4f6e6a,0,.92,0,4,{ry:PI/4,sx:1.9,sz:1.7});b.box(1.55,.04,1.35,0x3f5b58,0,.77,0);
   for(const [x,z] of [[-.78,-.68],[.78,-.68],[-.78,.68],[.78,.68]])b.cone(.05,.14,0x3f5b58,x,.82,z,4,{rx:z>0?-.9:.9,rz:x>0?.9:-.9});
   b.box(.6,.25,.5,0xf3ead5,0,1.12,0);b.cyl(0,.707,.32,0x4f6e6a,0,1.38,0,4,{ry:PI/4,sx:1.1,sz:.95});b.ball(.06,P.gold,0,1.56,0);
   for(const x of [-.55,.55])b.at(x,.68,.62,()=>{b.cyl(.004,.004,.08,P.dark,0,.04,0,3);b.ball(.07,0xd94f3d,0,-.04,0,{sy:1.3,glow:1,detail:1});});
   for(let i=0;i<3;i++)b.box(.4,.05,.12,0xb59a76,0,.04+i*.05,.65-i*.07);});
  // tea table & bushes
  b.at(.62,0,.6,()=>{b.cyl(.16,.16,.03,0x8a5a3c,0,.2,0,10);b.cyl(.03,.03,.2,0x6b3f2e,0,.1,0,6);b.cyl(.035,.03,.04,P.white,0,.24,0,8);b.cyl(.025,.02,.03,P.white,.08,.23,.03,8);});
  for(const [x,z] of [[-.8,.75],[-.6,.85],[.85,-.7]])b.ball(.13,0x5f8f62,x,.1,z,{sy:.8});
  if(lv>=3)b.at(-.75,0,-.75,()=>{b.cyl(.2,.2,.04,0x7fb7b0,0,.03,0,10);b.ball(.06,P.stone,.15,.05,.1);b.ball(.04,0xe68a4f,0,.06,0,{sx:1.6,sy:.5});});
  if(lv>=4)flag(b,.85,0,.15,0x8fb39a,.7);
  if(lv>=5){b.dyn({type:'spin',axis:'y',speed:.3},s=>{for(let i=0;i<3;i++)s.ball(.03,0xfff2b0,Math.cos(i*2.1)*.25,i*.05,Math.sin(i*2.1)*.25,{glow:1});},0,1.7,0);}
  stars(b,lv,.24,.9);},
 lighthouse(b,lv){
  b.ball(.34,0x9c9a92,-.12,.06,.1,{sy:.5});b.ball(.26,0x8f8d86,.18,.05,-.15,{sy:.5});
  b.cyl(.36,.4,.16,P.stone2,0,.08,0,10);const segs=5,th=1.9+(lv>=4?.25:0);for(let i=0;i<segs;i++){const y0=.16+i*th/segs,r0=.3-i*.032,r1=.3-(i+1)*.032;b.cyl(r1,r0,th/segs,i%2?0xd45a46:0xf6f0e3,0,y0+th/segs/2,0,10);}
  const top=.16+th;door(b,0,.16,.29,0,.14,.26,0x5f6f8a);win(b,0,.16+th*.55,.24,0,.08,.12);
  b.cyl(.27,.27,.05,P.dark,0,top+.02,0,10);for(let i=0;i<10;i++){const a=i/10*PI*2;b.box(.02,.14,.02,P.dark,Math.cos(a)*.26,top+.1,Math.sin(a)*.26);}b.tor(.26,.01,P.dark,0,top+.17,0,{rx:H,m:20});
  b.cyl(.16,.16,.26,0xfff0b8,0,top+.18,0,8,{glow:1});for(let i=0;i<4;i++){const a=i*H;b.box(.02,.26,.02,P.dark,Math.cos(a)*.16,top+.18,Math.sin(a)*.16);}
  b.cyl(.02,.2,.18,0xd45a46,0,top+.4,0,8);b.ball(.04,P.gold,0,top+.52,0);
  b.dyn({type:'spin',axis:'y',speed:1.1},s=>{s.box(.5,.05,.06,0xfff3b0,.25,0,0,{glow:1,noShadow:1,mat:{opacity:.7}});s.box(.5,.05,.06,0xfff3b0,-.25,0,0,{glow:1,noShadow:1,mat:{opacity:.7}});},0,top+.18,0);
  if(lv>=3)b.at(.34,0,.3,()=>{b.cyl(.012,.012,.36,P.dark,0,.18,0,4);b.ball(.05,0xfff0b8,0,.38,0,{glow:1});});
  if(lv>=5)flag(b,0,top+.5,0,0xe07a5f,.3);
  },
 library(b,lv){
  b.at(0,0,-.15,()=>{b.box(2.6,.18,2.0,P.stone3,0,.09,0);b.box(2.7,.05,2.1,P.stone,0,.02,0);
   b.box(1.5,1.0,1.4,0xeae2cf,0,.68,0);b.box(1.56,.08,1.46,P.stone,0,1.2,0);
   for(const x of [-.98,.98])b.at(x,0,.1,()=>{b.box(.5,.75,1.1,0xe4dac4,0,.55,0);b.box(.56,.06,1.16,P.stone,0,.94,0);b.at(0,0,0,{ry:H},()=>gable(b,1.1,.5,.26,P.roofP,.96,{oh:.05,wall:0xe4dac4}));arched(b,0,.55,.56,0,.18,.38);});
   for(let i=0;i<4;i++)arched(b,-.54+i*.36,.78,.705,0,.16,.42);
   for(let i=0;i<2;i++)arched(b,.76,.78,-.35+i*.7,H,.16,.42);
   b.sph(.55,0x6f78b8,0,1.24,0,{ws:16,hs:8,tl:PI/2,mat:{metal:.25,rough:.5}});b.cyl(.57,.57,.08,P.stone,0,1.25,0,16);for(let i=0;i<6;i++)b.tor(.555,.012,shade(0x6f78b8,-.12),0,1.24,0,{ry:i*PI/6,arc:PI,m:16});
   b.cyl(.1,.12,.18,0xeae2cf,0,1.85,0,8);b.cone(.1,.25,P.gold,0,2.05,0,8);b.ball(.05,P.gold,0,2.2,0,{glow:1});
   // portico
   b.at(0,0,.88,()=>{for(let i=0;i<4;i++){const x=-.48+i*.32;b.cyl(.065,.07,.95,P.white,x,.65,0,10);b.box(.16,.06,.16,P.stone3,x,1.14,0);b.box(.16,.06,.16,P.stone3,x,.2,0);}b.box(1.2,.1,.36,P.stone3,0,1.2,0);b.prism(1.24,.3,.36,P.stone3,0,1.25,0);b.prism(1.0,.2,.37,0xe7dcc6,0,1.29,.0);b.cyl(.06,.06,.02,P.gold,0,1.36,.19,10,{rx:H,glow:1});
    door(b,0,.18,-.16,0,.3,.55,0x5d4d82);for(let i=0;i<3;i++)b.box(1.2-i*.1,.06,.16,P.stone3,0,.15-i*.05,.3+i*.12);});});
  for(const x of [-1.15,1.15])b.at(x,0,1.2,()=>{b.cyl(.04,.05,.6,P.dark,0,.3,0,6);b.ball(.08,0xfff0c0,0,.65,0,{glow:1,detail:1});});
  if(lv>=3)for(const x of [-.7,.7])b.at(x,0,1.25,()=>{b.box(.3,.12,.3,0x8a6448,0,.06,0);b.ball(.14,0x5f8f62,0,.2,0,{detail:1});});
  if(lv>=4)b.at(-1.25,0,-1.25,()=>{b.cyl(.2,.24,.1,P.stone3,0,.05,0,10);b.cyl(.04,.04,.4,P.stone3,0,.3,0,8);b.cyl(.18,.12,.08,P.stone3,0,.5,0,10);b.cyl(.15,.15,.02,0x8bc9c3,0,.54,0,10);});
  if(lv>=5){flag(b,1.25,0,-1.25,0x7d86c9,1.2);flag(b,-1.25,0,1.0,0x7d86c9,.8);}
  stars(b,lv,.24,1.4);},
 clocktower(b,lv){
  b.box(1.8,.12,1.8,P.stone3,0,.06,0);for(let i=0;i<4;i++)b.at(0,0,0,{ry:i*H},()=>{b.box(.5,.05,.25,P.stone,0,.03,.88);});
  b.box(.9,1.1,.9,0xd8cfb8,0,.67,0);for(let r=0;r<5;r++)for(const s of [-1,1])b.box(.92,.04,.02,shade(0xd8cfb8,-.06),0,.3+r*.22,s*.455);
  door(b,0,.12,.455,0,.3,.5,0x6a4f3a);arched(b,.455,.75,0,H,.16,.32);arched(b,-.455,.75,0,-H,.16,.32);
  b.box(.98,.08,.98,P.stone,0,1.25,0);const t2=1.3+(lv>=3?.25:0);
  b.box(.8,t2,.8,0xefe4c8,0,1.29+t2/2,0);frame(b,.8,t2,.8,1.29);
  for(let i=0;i<4;i++)b.at(0,1.29+t2*.62,0,{ry:i*H},()=>{b.cyl(.27,.27,.04,P.white,0,0,.41,20,{rx:H});b.tor(.28,.025,P.gold,0,0,.42,{m:24});for(let k=0;k<12;k++){const a=k/12*PI*2;b.box(.018,.05,.01,P.dark,Math.sin(a)*.22,Math.cos(a)*.22,.435,{rz:-a});}b.dyn({type:'clock',hand:'h'},s=>s.box(.035,.14,.012,P.dark,0,.06,0),0,0,.44);b.dyn({type:'clock',hand:'m'},s=>s.box(.025,.2,.012,P.dark,0,.09,0),0,0,.45);});
  const yb=1.29+t2;b.box(.94,.07,.94,P.stone,0,yb+.03,0);
  // open belfry
  for(const x of [-.36,.36])for(const z of [-.36,.36])b.box(.09,.5,.09,0xd8cfb8,x,yb+.32,z);b.cyl(.13,.17,.22,P.gold,0,yb+.42,0,10,{mat:{metal:.6,rough:.35}});b.box(.86,.06,.86,P.stone,0,yb+.6,0);
  b.cyl(0,.707,.85,0x4c5d86,0,yb+1.06,0,4,{ry:PI/4,sx:.95,sz:.95});b.cyl(.015,.015,.4,P.gold,0,yb+1.6,0,4);b.ball(.06,P.gold,0,yb+1.75,0,{glow:1});
  if(lv>=2)for(const [x,z] of [[-.7,.7],[.7,.7]])lantern(b,x,.12,z,true);
  if(lv>=3){bench(b,-.65,.12,-.55,H);bench(b,.65,.12,-.55,-H);}
  if(lv>=4)for(const [x,z] of [[-.75,-.75],[.75,-.75]])b.at(x,.12,z,()=>{b.box(.2,.12,.2,0x8a6448,0,.06,0);b.ball(.12,0x5f8f62,0,.2,0,{detail:1});b.ball(.03,P.pink,.05,.28,.05);});
  if(lv>=5)flag(b,0,yb+1.85,0,P.gold,.35);
  stars(b,lv,.18,.92);}
};
export function buildingModel(b,id,level=1){(BUILD[id]||BUILD.cottage)(b,Math.max(1,level));}

/* ---------- decorations (1×1, centred) ---------- */
const DEC={
 pine(b,v){const s=.85+(v%3)*.12;b.at(0,0,0,{s,ry:v},()=>{b.cyl(.05,.08,.4,P.trunk,0,.2,0,6);const cs=[[0x4f7d55,0x5f8f5e],[0x47704f,0x598a5a],[0x5a8a5c,0x6c9d66]][v%3];b.cone(.4,.55,cs[0],0,.55,0,7);b.cone(.32,.48,cs[1],0,.85,0,7);b.cone(.22,.4,cs[0],0,1.12,0,7);});},
 oak(b,v){const s=.85+(v%3)*.12;b.at(0,0,0,{s,ry:v},()=>{b.cyl(.06,.09,.5,P.trunk,0,.25,0,6);b.box(.04,.22,.04,P.trunk,.08,.48,0,{rz:-.6});const c=[0x76a35f,0x6b9a58,0x83ad69][v%3];b.ball(.36,c,0,.78,0);b.ball(.26,shade(c,.05),.22,.92,.05);b.ball(.24,shade(c,-.04),-.2,.88,-.08);b.ball(.2,shade(c,.08),.02,1.06,.1);if(v%2)b.ball(.04,0xe25b4a,.25,.72,.22);});},
 blossom(b,v){b.at(0,0,0,{ry:v},()=>{b.cyl(.05,.08,.45,0x7c5a4a,0,.22,0,6);b.box(.035,.3,.035,0x7c5a4a,.1,.5,0,{rz:-.7});b.box(.035,.26,.035,0x7c5a4a,-.08,.52,.04,{rz:.6});const cs=[0xf4bfcf,0xf7d2dd,0xeaa7bd];b.ball(.3,cs[0],0,.78,0);b.ball(.22,cs[1],.22,.82,.05);b.ball(.22,cs[2],-.2,.74,-.05);b.ball(.18,cs[1],0,.98,.06);for(let i=0;i<6;i++){const a=i*1.1;b.box(.05,.01,.04,cs[i%3],Math.cos(a)*(.25+i*.03),.012,Math.sin(a)*(.25+i*.03),{ry:a});}});},
 palm(b,v){b.at(0,0,0,{ry:v},()=>{let x=0,y=0;for(let i=0;i<5;i++){b.cyl(.055-i*.004,.065-i*.004,.24,i%2?0xa98a62:0x9a7b55,x,y+.12,0,6,{rz:-.12-i*.04});x+=.03+i*.012;y+=.235;}for(let i=0;i<6;i++){const a=i/6*PI*2;b.at(x,y+.04,0,{ry:a},()=>{b.box(.12,.02,.5,i%2?0x5f9a55:0x6fac5f,0,-.08,.22,{rx:.45});});}for(let i=0;i<3;i++)b.ball(.045,0x7a5a3a,x+Math.cos(i*2)*.07,y-.04,Math.sin(i*2)*.07);});},
 bush(b,v){b.ball(.24,0x5f8f55,-.06,.18,0,{sy:.8});b.ball(.2,0x6e9d5f,.14,.16,.08,{sy:.85});b.ball(.17,0x557f4e,.02,.15,-.15,{sy:.8});for(let i=0;i<5;i++)b.ball(.03,v%2?0xd84f5a:0x7d6bc4,Math.cos(i*1.3)*.2,.24+(i%2)*.06,Math.sin(i*1.3)*.16);},
 flowerbed(b,v){b.box(.78,.1,.78,0x8a6448,0,.05,0);b.box(.68,.11,.68,0x6b4d34,0,.06,0);const cs=[0xf08aa0,0xf5d36a,0xf7f2e6,0xc8a6e8,0xef8c5a];for(let i=0;i<16;i++){const x=-.24+(i%4)*.16,z=-.24+Math.floor(i/4)*.16;b.cyl(.008,.008,.12,0x5f8f55,x,.16,z,3);b.ball(.045,cs[(i+v)%5],x,.23,z);}b.ball(.06,0x6e9d5f,0,.14,0,{sx:4,sy:.5,sz:4});},
 rock(b,v){b.at(0,0,0,{ry:v},()=>{b.ball(.28,0xa3a59c,-.05,.16,0,{sy:.75,sx:1.1});b.ball(.18,0x94968e,.2,.1,.12,{sy:.8});b.ball(.12,0xb2b4ab,-.22,.08,.2);b.ball(.1,0x7fa463,-.02,.32,.02,{sy:.4,sx:1.4});});},
 fence(b,v){fenceRun(b,0,0,.98,0);},
 lamp(b,v){b.cyl(.08,.1,.08,P.stone2,0,.04,0,8);b.cyl(.025,.03,.8,0x3f4a4f,0,.44,0,6);b.box(.12,.02,.02,0x3f4a4f,0,.82,0);b.at(0,.92,0,()=>{b.box(.13,.16,.13,0xffe7a8,0,0,0,{glow:1});for(const x of [-.065,.065])for(const z of [-.065,.065])b.box(.015,.16,.015,0x3f4a4f,x,0,z);b.cone(.12,.1,0x3f4a4f,0,.13,0,4,{ry:PI/4});b.ball(.025,0x3f4a4f,0,.19,0);});},
 bench(b,v){bench(b,0,0,0,0);b.ball(.08,0x6e9d5f,.36,.08,-.1);},
 well(b,v){b.cyl(.32,.34,.32,P.stone,0,.16,0,10);b.cyl(.34,.34,.04,P.stone3,0,.33,0,10);b.cyl(.25,.25,.02,0x4f8fa0,0,.3,0,10);for(const x of [-.3,.3])b.box(.05,.6,.05,P.timber,x,.6,0);b.cyl(.04,.04,.62,P.timber,0,.75,0,6,{rz:H});gable(b,.4,.75,.22,P.roofR,.88,{oh:.03,wall:P.timber});b.cyl(.01,.01,.3,P.rope,0,.58,0,3);b.cyl(.06,.05,.09,0x9a7a52,0,.42,0,8);},
 scarecrow(b,v){b.cyl(.02,.02,.9,P.timber,0,.45,0,4);b.box(.6,.03,.03,P.timber,0,.62,0);b.box(.2,.3,.12,0x7c95b0,0,.58,0);for(const s of [-1,1])b.box(.2,.08,.08,0x7c95b0,s*.18,.62,0);for(const s of [-1,1])b.cone(.04,.08,P.straw,s*.31,.62,0,5,{rz:s*H});b.ball(.1,0xe9d6a4,0,.82,0);b.cyl(.04,.16,.1,0xa8854d,0,.95,0,8);b.cyl(.04,.04,.1,0xa8854d,0,1.0,0,8);b.ball(.04,0xd84f5a,0,.65,.07);},
 banner(b,v){const c=[0xd0614e,0x5f81a6,0xe8bd52,0x6c9070][v%4];b.cyl(.06,.08,.06,P.stone2,0,.03,0,8);b.cyl(.018,.018,1.1,0x6b5640,0,.55,0,5);b.ball(.035,P.gold,0,1.12,0);b.dyn({type:'flag'},s=>{s.box(.36,.24,.015,c,.18,0,0);s.box(.36,.04,.016,P.white,.18,-.07,0);s.prism(.24,.1,.015,c,.41,0,0,{rz:-H});},0,.96,0);},
 stonelantern(b,v){b.box(.36,.08,.36,P.stone2,0,.04,0);b.cyl(.08,.1,.32,P.stone,0,.24,0,6);b.box(.3,.06,.3,P.stone,0,.43,0);b.box(.2,.17,.2,0xffe2a0,0,.545,0,{glow:1});for(const x of [-.09,.09])for(const z of [-.09,.09])b.box(.03,.17,.03,P.stone,x,.545,z);b.cyl(0,.707,.16,P.stone,0,.71,0,4,{ry:PI/4,sx:.5,sz:.5});b.ball(.04,P.stone,0,.8,0);b.ball(.07,0x7fa463,.12,.47,.1,{sy:.3});},
 campfire(b,v){for(let i=0;i<8;i++){const a=i/8*PI*2;b.ball(.06,i%2?0x9a9c94:0x8a8c84,Math.cos(a)*.24,.04,Math.sin(a)*.24,{sy:.7});}for(let i=0;i<4;i++)b.cyl(.03,.03,.36,0x7b5b3f,0,.1,0,5,{ry:i*PI/4,rz:H*.7});b.dyn({type:'flicker'},s=>{s.cone(.12,.3,0xffa94d,0,.15,0,6,{glow:1,noShadow:1});s.cone(.07,.22,0xffe08a,0,.13,0,5,{glow:1,noShadow:1});},0,.08,0);for(const s of [-1,1])b.box(.25,.06,.08,0x9a7a52,s*.38,.04,.15,{ry:s*.3});},
 tent(b,v){const c=[0xe9a25b,0x8fb6c9,0xd77d6d][v%3];b.prism(.7,.55,.75,c,0,0,0,{ry:0});b.prism(.3,.4,.02,shade(c,-.15),0,0,.38);b.box(.02,.02,.85,shade(c,-.2),0,.55,0);b.cyl(.012,.012,.25,P.timber,0,.68,.35,3);b.box(.1,.06,.01,P.red,.05,.76,.35);b.cyl(.012,.012,.25,P.timber,-.45,.02,.3,3,{rz:-.8});},
 bridge(b,v){for(let i=0;i<7;i++){const x=-.45+i*.15,y=.06+Math.sin((i/6)*PI)*.14;b.box(.14,.04,.5,i%2?0xb98f5f:0xc7a06c,x,y,0,{rz:-Math.cos(i/6*PI)*.35});}for(const z of [-.24,.24]){for(let i=0;i<4;i++){const x=-.42+i*.28;b.box(.03,.25,.03,P.timber,x,.12+Math.sin((i/3)*PI)*.13+.08,z);}b.box(.9,.03,.03,P.timber,0,.38,z);}},
 boat(b,v){b.dyn({type:'bob'},s=>{const c=[0xc87d55,0x5f81a6,0xd0614e][v%3];s.box(.32,.1,.68,c,0,.0,0);s.box(.26,.04,.58,0xe7c896,0,.05,0);s.prism(.32,.2,.1,c,0,-.05,.38,{rx:H});s.cyl(.015,.015,.8,P.timber,0,.42,-.02,4);s.prism(.34,.62,.01,P.white,0,.12,.12,{ry:H,sz:1});s.box(.12,.06,.01,c,0,.82,-.02);},0,0,0);},
 statue(b,v){b.box(.5,.12,.5,P.stone2,0,.06,0);b.box(.38,.42,.38,P.stone3,0,.33,0);b.box(.44,.06,.44,P.stone,0,.57,0);b.cyl(.09,.12,.3,0xe7e3d6,0,.75,0,8);b.ball(.08,0xe7e3d6,0,.97,0);b.box(.16,.11,.03,0xe7e3d6,0,.82,.1,{rx:-.4});b.dyn({type:'spin',axis:'y',speed:.8},s=>{s.ball(.08,P.gold,0,0,0,{glow:1,detail:0,s:1});for(let i=0;i<5;i++){const a=i/5*PI*2;s.cone(.04,.12,P.gold,Math.cos(a)*.1,Math.sin(a)*.1,0,4,{rz:a-H,glow:1});}},0,1.2,0);},
 display(b,v,item){b.box(.42,.08,.42,P.stone2,0,.04,0);b.cyl(.12,.15,.36,0xe7e3d6,0,.26,0,8);b.cyl(.2,.17,.06,P.stone3,0,.47,0,10);b.tor(.19,.012,P.gold,0,.5,0,{rx:H,m:20});if(item)b.dyn({type:'spin',axis:'y',speed:.5,item},s=>itemModel(s,item,.36),0,.52,0);}
};
export function decorModel(b,type,v=0,item){(DEC[type]||DEC.rock)(b,v,item);}

/* ---------- villager ---------- */
export function villagerModel(b,i){const shirt=[0xe6a369,0x8799b7,0xe0cb83,0x91a771,0xd88a9a,0x9f8bc9][i%6],skin=[0xebc7a0,0xd9ad86,0xf1d3b5,0xc79a74][i%4],hair=[0x5a4330,0x2f2a26,0xa36b3f,0xe0c78f][(i>>1)%4];
 const legs=[];for(const s of [-1,1])legs.push(b.dyn({type:'leg',side:s},q=>q.box(.05,.13,.05,0x5f5648,0,-.065,0),s*.04,.15,0));
 b.cyl(.09,.11,.2,shirt,0,.25,0,7);for(const s of [-1,1])b.cyl(.025,.025,.16,shirt,s*.12,.27,0,4,{rz:s*.15});b.ball(.1,skin,0,.44,0,{detail:1});
 const style=i%4;if(style===0){b.cyl(.06,.17,.04,P.straw,0,.53,0,10);b.cyl(.07,.08,.07,P.straw,0,.57,0,8);}else if(style===1)b.sph(.105,hair,0,.45,-.01,{tl:PI/2.1});else if(style===2){b.sph(.105,0xd0614e,0,.46,0,{tl:PI/2});b.ball(.03,P.white,0,.57,0);}else{b.sph(.105,hair,0,.45,-.01,{tl:PI/2});b.ball(.05,hair,0,.42,-.09);}
 if(i%3===0)b.box(.09,.12,.03,[0xb5544a,0x4f7aa3,0xd8b04f][i%3],.0,.26,.11);
 return legs;}

/* ---------- collectibles (unit-ish size, standing on y=0) ---------- */
const M={gold:{metal:.85,rough:.28},silver:{metal:.9,rough:.25},brass:{metal:.75,rough:.35},glass:{opacity:.35,rough:.08,smooth:1},gem:{rough:.15,smooth:0},glow:{emissive:1},paper:{rough:.95}};
function leafShape(len=1,w=.45){const s=new THREE.Shape();s.moveTo(0,0);s.bezierCurveTo(w,len*.25,w*.9,len*.75,0,len);s.bezierCurveTo(-w*.9,len*.75,-w,len*.25,0,0);return s;}
const leafGeo=(len,w,depth=.03)=>cached(`leaf${len}:${w}:${depth}`,()=>{const g=new THREE.ExtrudeGeometry(leafShape(len,w),{depth,bevelEnabled:true,bevelThickness:.01,bevelSize:.01,bevelSegments:1,curveSegments:10});g.translate(0,0,-depth/2);return g;});
const latheGeo=(key,pts,n=18)=>cached('lathe'+key,()=>new THREE.LatheGeometry(pts.map(([x,y])=>new THREE.Vector2(x,y)),n));
const ITEMS={
 leaf(b){b.at(0,.08,0,{rz:-.25,rx:-.35},()=>{b.geo(leafGeo(1,.42,.04),0xe39a3b,0,0,0,{mat:{rough:.4,emissive:.18,smooth:0}});for(const z of [-.032,.032]){b.box(.022,.9,.012,0xa85a1e,0,.47,z);for(let i=0;i<4;i++)for(const s of [-1,1])b.box(.014,.24-i*.03,.012,0xb8682a,s*.085,.24+i*.17,z,{rz:-s*.95});}b.cyl(.018,.025,.22,0x8a5a2a,0,-.1,0,5);});},
 bottle(b){b.geo(latheGeo('bottle',[[0,0],[.2,0],[.24,.06],[.25,.42],[.2,.56],[.09,.64],[.08,.82],[.1,.86],[0,.86]]),0xbfe4ee,0,0,0,{mat:M.glass});b.cyl(.205,.215,.16,0x3f8fb8,0,.1,0,18,{mat:{rough:.2,opacity:.85}});b.cyl(.2,.2,.02,0x8fd6e8,0,.19,0,18,{mat:{emissive:.3}});b.cyl(.07,.06,.12,0xb98a5a,0,.88,0,10);b.tor(.09,.012,0xd9c79a,0,.78,0,{rx:H,m:16});b.at(0,.26,0,()=>{b.box(.12,.03,.05,0xf6efe0,0,0,0);b.prism(.06,.1,.005,P.white,0,.01,0);});b.box(.15,.1,.005,0xf3e7c8,.18,.62,.12,{ry:.6,rz:.3,mat:M.paper});},
 feather(b){b.at(0,.0,0,{rz:-.35},()=>{b.cyl(.012,.018,1.1,0xf2ead6,0,.55,0,6);b.geo(leafGeo(.95,.2,.012),0x5b8fc4,0,.18,0,{mat:{rough:.6,smooth:1}});b.geo(leafGeo(.55,.12,.016),0x7cc2c9,0,.55,.01,{mat:{rough:.6,smooth:1}});b.geo(leafGeo(.25,.07,.02),0xe9e2cf,0,.88,.015,{mat:{rough:.6}});for(let i=0;i<5;i++)b.box(.08,.006,.02,0x3f6f9e,i%2?.12:-.12,.3+i*.12,.015,{rz:i%2?-.5:.5});});},
 compass(b){b.at(0,.06,0,()=>{b.cyl(.42,.44,.12,0xc9a24f,0,0,0,32,{mat:M.brass});b.cyl(.37,.37,.02,0xf3ead2,0,.065,0,32,{mat:M.paper});for(let i=0;i<8;i++){const a=i/8*PI*2;b.box(i%2?.012:.02,.005,i%2?.06:.1,0x6b5a40,Math.sin(a)*.3,.08,Math.cos(a)*.3,{ry:a});}b.at(0,.09,0,{ry:.5},()=>{b.cone(.04,.28,0xd0503e,0,0,.14,4,{rx:H});b.cone(.04,.28,0xe9e5dc,0,0,-.14,4,{rx:-H});b.ball(.03,P.gold,0,.01,0,{mat:M.gold});});b.cyl(.38,.38,.012,0xd8eef0,0,.12,0,32,{mat:M.glass});b.tor(.4,.03,0xd9b562,0,.1,0,{rx:H,m:32,mat:M.brass});b.cyl(.05,.05,.1,0xd9b562,0,.02,-.47,10,{rx:H,mat:M.brass});b.tor(.07,.018,0xd9b562,0,.02,-.56,{mat:M.brass});});},
 moon(b){b.at(0,.5,0,{rx:-.25},()=>{b.cyl(.36,.36,.1,0xd7dbe2,0,0,0,32,{rx:H,mat:M.silver});b.cyl(.31,.31,.02,0x1f2d52,0,0,.052,32,{rx:H,mat:{emissive:.15}});b.cyl(.16,.16,.02,0xf3e7b5,-.04,.04,.064,24,{rx:H,mat:{emissive:.6}});b.cyl(.15,.15,.025,0x1f2d52,.04,.08,.066,24,{rx:H});for(let i=0;i<12;i++){const a=i/12*PI*2;b.ball(.012,0xf3e7b5,Math.sin(a)*.26,Math.cos(a)*.26,.07,{mat:{emissive:.8}});}b.box(.016,.18,.01,0xd7dbe2,0,.07,.08,{rz:-.4,mat:M.silver});b.box(.016,.12,.01,0xd7dbe2,0,.05,.085,{rz:1.3,mat:M.silver});b.tor(.37,.02,0xc4c9d2,0,0,0,{m:32,mat:M.silver});b.cyl(.04,.05,.08,0xc4c9d2,0,.4,0,10,{mat:M.silver});b.tor(.07,.018,0xc4c9d2,0,.49,0,{mat:M.silver});for(let i=0;i<4;i++)b.tor(.04,.012,0xc4c9d2,.06+i*.06,.58+i*.04,0,{ry:i%2?H:0,mat:M.silver});});},
 crystal(b){b.ball(.32,0x6c6a78,0,.05,0,{sy:.45,sx:1.3,detail:0,mat:{rough:.9}});const cs=[0x7ee0c3,0x9b8cf0,0x6fc2f0,0xc59af0,0x8ff0d0];[[0,.42,0,.13,.65,0],[.18,.3,.08,.09,.42,-.4],[-.17,.3,.05,.1,.5,.45],[.05,.26,-.17,.08,.38,.4],[-.06,.22,.19,.07,.3,-.3]].forEach(([x,y,z,r,h,rz],i)=>b.at(x,y,z,{rz,rx:i%2?.2:-.15},()=>{b.cyl(r,r*.9,h,cs[i],0,0,0,6,{mat:{rough:.12,emissive:.45,opacity:.88}});b.cone(r,r*1.6,shade(cs[i],.1),0,h/2+r*.8,0,6,{mat:{rough:.12,emissive:.55,opacity:.9}});}));},
 whale(b){b.at(0,.42,0,()=>{b.ball(.38,0x2f4f8f,0,0,0,{sx:1.5,sy:.85,sz:.9,detail:2,mat:{rough:.4,smooth:1}});b.ball(.3,0xd7e3ef,.05,-.12,0,{sx:1.45,sy:.5,sz:.85,detail:2,mat:{smooth:1}});b.at(-.62,.08,0,{rz:.35},()=>{b.cone(.1,.32,0x2f4f8f,-.12,0,0,8,{rz:H,mat:{smooth:1}});b.geo(leafGeo(.32,.14,.04),0x2f4f8f,-.25,0,0,{rz:H*.6,mat:{smooth:1}});b.geo(leafGeo(.32,.14,.04),0x2f4f8f,-.25,0,0,{rz:H*1.4,mat:{smooth:1}});});for(const s of [-1,1])b.geo(leafGeo(.26,.1,.03),0x2a477f,.1,-.15,s*.3,{rx:s*1.2,rz:2.4});b.ball(.035,0x10182c,.42,.04,.22);b.ball(.035,0x10182c,.42,.04,-.22);const st=[[.1,.25,.2],[-.2,.2,-.25],[.3,.15,-.15],[-.35,.18,.12],[0,.3,0],[.2,.28,-.05]];for(const [x,y,z] of st)b.ball(.03,0xfff1a8,x,y,z,{mat:{emissive:1}});});b.dyn({type:'spin',axis:'y',speed:.6},s=>{for(let i=0;i<5;i++){const a=i/5*PI*2;s.ball(.035,0xfff1a8,Math.cos(a)*.75,.1+Math.sin(a*2)*.08,Math.sin(a)*.75,{mat:{emissive:1}});}},0,.45,0);},
 crown(b){b.at(0,.0,0,()=>{b.cyl(.4,.38,.22,0xe8bd52,0,.11,0,24,{open:1,mat:M.gold});b.tor(.4,.03,0xd9a93e,0,.02,0,{rx:H,m:32,mat:M.gold});b.tor(.4,.025,0xd9a93e,0,.22,0,{rx:H,m:32,mat:M.gold});for(let i=0;i<8;i++){const a=i/8*PI*2,big=i%2===0;b.cone(.07,big?.32:.2,0xe8bd52,Math.cos(a)*.39,.22+(big?.16:.1),Math.sin(a)*.39,4,{mat:M.gold});b.ball(big?.045:.03,big?0xff8a5c:0xfff1c4,Math.cos(a)*.39,.22+(big?.34:.22),Math.sin(a)*.39,{mat:{emissive:.6,rough:.15}});b.ball(.035,[0xd0503e,0x4f7ad0,0x4fae7a][i%3],Math.cos(a)*.41,.11,Math.sin(a)*.41,{mat:{rough:.1,emissive:.25}});}b.ball(.1,0xffcf5c,0,.42,.38,{detail:1,mat:{emissive:.9}});for(let i=0;i<8;i++){const a=i/8*PI*2;b.box(.02,.1,.01,0xffe08a,Math.cos(a)*.16,.42+Math.sin(a)*.16,.38,{rz:a-H,mat:{emissive:.8}});}});},
 acorn(b){b.box(.7,.05,.05,0x8a5a2a,0,.95,0);b.cyl(.004,.004,.32,P.rope,0,.78,0,3);b.at(0,.5,0,()=>{b.ball(.17,0xc98b4a,0,0,0,{sy:1.25,detail:2,mat:{rough:.45,smooth:1}});b.sph(.185,0x7a5232,0,.1,0,{tl:PI/2.2,mat:{rough:.95}});for(let i=0;i<10;i++){const a=i/10*PI*2;b.ball(.03,0x8d6440,Math.cos(a)*.15,.14,Math.sin(a)*.15);}b.cyl(.015,.02,.08,0x5f3d22,0,.31,0,5);b.cone(.03,.06,0xf1d58a,0,-.24,0,5,{rx:PI});});for(const s of [-1,1])b.at(s*.26,.65,0,()=>{b.cyl(.003,.003,.26,P.rope,0,.15,0,3);b.sph(.07,0xd9b562,0,-.02,0,{tl:PI/1.6,mat:M.brass});b.ball(.02,0xd9b562,0,-.07,0,{mat:M.brass});});},
 shell(b){b.at(0,.02,0,{rz:-.42,rx:.15},()=>{const c1=0xf3dcc8,c2=0xe8c4ae;b.ball(.24,c1,0,.3,0,{sy:1.35,detail:2,mat:{rough:.35,smooth:1}});for(let i=0;i<5;i++){const y=.5+i*.1,r=.2*Math.pow(.74,i);b.tor(r,r*.38,i%2?c2:c1,0,y,0,{rx:H,n:8,m:18,mat:{rough:.35,smooth:1}});for(let k=0;k<6;k++){const a=k/6*PI*2+i;b.cone(r*.22,r*.5,c2,Math.cos(a)*r,y+.02,Math.sin(a)*r,4,{rz:-Math.cos(a)*.9,rx:Math.sin(a)*.9});}}b.cone(.05,.16,c1,0,1.04,0,8,{mat:{rough:.35}});b.at(.06,.28,.12,{ry:.5,rz:.2},()=>{b.sph(.25,0xf6b4a6,0,0,0,{tl:PI*.55,sx:.7,sz:.5,mat:{rough:.3,smooth:1}});b.ball(.13,0xe0857c,0,-.02,.03,{sx:.8,sy:1.4,sz:.3,mat:{rough:.25,emissive:.12,smooth:1}});});b.cone(.07,.22,c2,.02,.0,0,6,{rx:PI});});},
 teacup(b){b.geo(latheGeo('saucer',[[0,0],[.42,0],[.46,.04],[.44,.05],[0,.03]],24),0xf6f0e4,0,0,0,{mat:{rough:.25,smooth:1}});b.tor(.38,.015,0x6f9cc9,0,.045,0,{rx:H,m:32});b.geo(latheGeo('cup',[[0,.04],[.13,.04],[.2,.1],[.27,.3],[.28,.42],[.265,.42],[.255,.32],[.19,.13],[0,.13]],24),0xf6f0e4,0,0,0,{mat:{rough:.25,smooth:1}});b.tor(.272,.012,0x6f9cc9,0,.36,0,{rx:H,m:32});b.cyl(.255,.255,.01,0xc77f3c,0,.38,0,24,{mat:{rough:.1}});b.tor(.09,.025,0xf6f0e4,.3,.27,0,{arc:PI*1.3,rz:-.6,mat:{rough:.25}});for(let i=0;i<3;i++)b.tor(.06,.008,0xffffff,-.05+i*.05,.55+i*.12,0,{arc:PI,rz:i%2?0:PI,mat:{opacity:.45,emissive:.4}});},
 lantern(b){b.at(0,.0,0,()=>{b.cyl(.2,.24,.06,0xa07a42,0,.03,0,6,{mat:M.brass});b.cyl(.18,.18,.5,0xfff1c0,0,.31,0,6,{mat:{opacity:.45,rough:.05,emissive:.55}});for(let i=0;i<6;i++){const a=i/6*PI*2;b.box(.025,.52,.025,0xa07a42,Math.cos(a)*.18,.31,Math.sin(a)*.18,{mat:M.brass});}b.cyl(.06,.24,.16,0xa07a42,0,.64,0,6,{mat:M.brass});b.tor(.1,.018,0xa07a42,0,.82,0,{mat:M.brass});for(let i=0;i<9;i++)b.ball(.025,0xd8ff8a,Math.cos(i*2.4)*.1,.15+i*.04,Math.sin(i*2.4)*.1,{mat:{emissive:1}});b.ball(.06,0xfff0a0,0,.3,0,{mat:{emissive:1}});});},
 hourglass(b){for(const y of [0,.92]){b.cyl(.28,.28,.06,0x8a5a3a,0,y+.03,0,16,{mat:{rough:.5}});b.tor(.28,.015,0xd9b562,0,y+(y?.0:.06),0,{rx:H,m:24,mat:M.brass});}for(let i=0;i<3;i++){const a=i/3*PI*2;b.cyl(.025,.025,.86,0x8a5a3a,Math.cos(a)*.24,.49,Math.sin(a)*.24,8);}b.geo(latheGeo('hg',[[0,.06],[.18,.08],[.2,.22],[.12,.38],[.035,.49],[.12,.6],[.2,.76],[.18,.9],[0,.92]],18),0xe5f3f6,0,0,0,{mat:M.glass});b.cone(.15,.16,0xf5c96a,0,.15,0,14,{mat:{emissive:.55,rough:.3}});b.cyl(.13,.04,.12,0xf5c96a,0,.68,0,14,{mat:{emissive:.55}});b.cyl(.006,.006,.3,0xffe39a,0,.33,0,3,{mat:{emissive:1}});for(let i=0;i<5;i++)b.ball(.012,0xfff3b0,Math.cos(i)*.08,.25+i*.05,Math.sin(i)*.08,{mat:{emissive:1}});},
 scroll(b){b.at(0,.06,0,()=>{b.box(.8,.006,.56,0xeedfb8,0,0,0,{mat:M.paper});b.ball(.12,0x8fbf88,-.05,.006,.02,{sx:1.6,sy:.02,sz:1.1});b.ball(.06,0x5f8fb8,.2,.008,-.12,{sx:1.5,sy:.02});b.box(.3,.004,.02,0xc0533e,.02,.01,.05,{ry:.6});b.ball(.025,0xc0533e,.18,.012,.15);for(let i=0;i<4;i++)b.box(.08,.004,.008,0x8a7a5a,-.3+i*.05,.01,-.22);b.cyl(.06,.06,.6,0xeedfb8,.4,.05,0,14,{rx:H,mat:M.paper});b.cyl(.065,.065,.012,0xc0533e,.4,.05,.12,14,{rx:H});for(const z of [-.32,.32])b.cyl(.035,.035,.06,0x8a5a3a,.4,.05,z,8,{rx:H});b.cyl(.04,.04,.6,0xe6d4a8,-.4,.03,0,12,{rx:H,mat:M.paper});});},
 globe(b){b.cyl(.22,.28,.08,0x6b4a35,0,.04,0,16,{mat:{rough:.4}});b.cyl(.03,.05,.3,0xd9b562,0,.22,0,8,{mat:M.gold});b.at(0,.68,0,()=>{b.ball(.17,0x2d4f8f,0,0,0,{detail:3,mat:{rough:.3,smooth:1,emissive:.2}});for(let i=0;i<8;i++)b.ball(.015,0xfff1a8,Math.cos(i*2.3)*.16,Math.sin(i*1.7)*.12,Math.sin(i*2.3)*.12,{mat:{emissive:1}});b.tor(.38,.012,0xd9b562,0,0,0,{m:40,mat:M.gold});b.tor(.38,.012,0xd9b562,0,0,0,{rx:H,m:40,mat:M.gold});b.tor(.32,.014,0xe8bd52,0,0,0,{rx:H,ry:.41,rz:.4,m:40,mat:M.gold});b.tor(.3,.01,0xe8bd52,0,0,0,{ry:H,m:40,mat:M.gold});b.cyl(.008,.008,.9,0xd9b562,0,0,0,4,{rz:.4,mat:M.gold});b.ball(.05,0xffcf5c,.2,.42,0,{mat:{emissive:1}});});b.tor(.26,.02,0xd9b562,0,.38,0,{rx:H,m:24,arc:PI,mat:M.gold,rz:0});},
 koi(b){b.cyl(.015,.015,1.0,0x6b3f2e,-.3,.5,0,5,{rz:-.5});b.cyl(.003,.003,.18,P.rope,.0,.82,0,3);b.at(.05,.55,0,{rz:.2},()=>{b.ball(.22,0xfff6ec,0,0,0,{sx:1.6,sy:.85,sz:.8,detail:2,mat:{emissive:.55,rough:.5,smooth:1}});for(const [x,y,z,r] of [[.12,.1,.08,.1],[-.12,.06,-.1,.12],[-.02,.15,0,.09],[.22,0,.1,.06]])b.ball(r,0xe8553c,x,y,z,{sy:.5,detail:1,mat:{emissive:.45,smooth:1}});b.geo(leafGeo(.3,.16,.02),0xf08a5a,-.38,0,0,{rz:H,mat:{emissive:.4,opacity:.85}});b.geo(leafGeo(.3,.16,.02),0xf08a5a,-.38,0,0,{rz:H*1.6,mat:{emissive:.4,opacity:.85}});b.geo(leafGeo(.16,.08,.02),0xf3b07a,.05,.17,0,{rz:.3,mat:{emissive:.4}});for(const s of [-1,1])b.geo(leafGeo(.14,.07,.02),0xf3b07a,.12,-.12,s*.14,{rx:s*1.1,rz:2.6,mat:{emissive:.4}});for(const s of [-1,1])b.ball(.025,0x1f2229,.3,.04,s*.1);b.tor(.06,.008,0xd9b562,.36,-.02,0,{ry:H,mat:M.gold});b.cyl(.06,.08,.03,0xd9b562,0,-.19,0,10,{mat:M.gold});b.cyl(.004,.004,.14,0xd0503e,0,-.28,0,3);b.ball(.025,0xd0503e,0,-.36,0);});},
 bonsai(b){b.box(.8,.18,.5,0x3f6f9e,0,.09,0,{mat:{rough:.2}});b.box(.86,.04,.56,0x2f5a86,0,.19,0,{mat:{rough:.2}});b.box(.74,.02,.44,0x5a4632,0,.2,0);b.ball(.05,0x9a9c94,.25,.22,.1);b.ball(.04,0x7fa463,-.2,.22,.12,{sy:.4});const tr=0x6b4a35;b.at(0,.2,0,()=>{b.cyl(.06,.1,.38,tr,-.05,.18,0,7,{rz:.35});b.cyl(.05,.065,.34,tr,-.07,.48,0,7,{rz:-.5});b.cyl(.035,.05,.32,tr,.12,.66,0,6,{rz:.9});b.cyl(.03,.04,.3,tr,-.2,.62,.05,6,{rz:-1.0});for(const [x,y,z,r] of [[.32,.82,0,.22],[-.36,.78,.05,.2],[-.02,.9,-.05,.24],[.1,1.02,.08,.15]]){b.ball(r,0x5f9a5a,x,y,z,{sy:.45,detail:1,mat:{smooth:1}});b.ball(r*.7,0x7fb86a,x+.03,y+.05,z,{sy:.4,detail:1});}});for(let i=0;i<10;i++)b.ball(.025,0xffd46a,Math.cos(i*2.4)*.35,.95+Math.sin(i*1.3)*.15,Math.sin(i*2.4)*.2,{mat:{emissive:1}});b.dyn({type:'spin',axis:'y',speed:.4},s=>{for(let i=0;i<6;i++){const a=i/6*PI*2;s.ball(.02,0xfff1a8,Math.cos(a)*.6,Math.sin(a*3)*.08,Math.sin(a)*.6,{mat:{emissive:1}});}},0,.9,0);},
 phoenix(b){b.at(0,.0,0,{rz:-.2},()=>{b.cyl(.014,.02,1.15,0xffe2a0,0,.57,0,6,{mat:{emissive:.6}});b.geo(leafGeo(1.0,.26,.014),0xd8402e,0,.15,0,{mat:{emissive:.55,smooth:1}});b.geo(leafGeo(.8,.2,.02),0xf07a2e,0,.25,.006,{mat:{emissive:.7,smooth:1}});b.geo(leafGeo(.55,.13,.026),0xffbe3d,0,.38,.012,{mat:{emissive:.85,smooth:1}});b.geo(leafGeo(.3,.07,.032),0xfff1a8,0,.5,.016,{mat:{emissive:1}});});b.dyn({type:'spin',axis:'y',speed:.9},s=>{for(let i=0;i<8;i++){const a=i/8*PI*2;s.ball(.02+(i%3)*.008,[0xffbe3d,0xf07a2e,0xfff1a8][i%3],Math.cos(a)*(.3+(i%2)*.1),.3+i*.08,Math.sin(a)*(.3+(i%2)*.1),{mat:{emissive:1}});}},0,0,0);b.cyl(.2,.24,.05,0x3a2c2a,0,.025,0,12,{mat:{rough:.4}});}
};
export function itemModel(b,id,scale=1){b.at(0,0,0,{s:scale},()=>(ITEMS[id]||ITEMS.leaf)(b));}
export const ITEM_IDS=Object.keys(ITEMS);
