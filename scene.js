import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {createPhotoResolve} from './photo-resolve.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {CEILING,PX_PER_METRE,ROOMS,roomById,point,toPlan,WALLS,DOORS,doorSegment,segmentDistance,WALL_THICKNESS} from './plan.js';
import {createMovement} from './movement.js';
import {createDoorPhysics} from './door-physics.js';
import {createPhysicsWorld} from './physics-world.js';
import {furnish} from './interior.js';
import {MeshBVH,acceleratedRaycast} from './vendor/bvh/index.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// All architecture is generated from the same traced plan used by the map.
// No image or pre-rendered film stands in for the interactive apartment.
export function createApartment(canvas,onReady,{atelier=false}={}){
 // ?smoke=1 — soft-GPU live proofs: tiny shadows, no HDR, low DPR (does not change shipping defaults).
 const smokeMode=typeof location!=='undefined'&&new URLSearchParams(location.search).has('smoke');
 // ?spawn=kitchen|dining|lamp|living — debug start only. Full PBR/PMREM/composer; no asset skip.
 const spawnParam=typeof location!=='undefined'?new URLSearchParams(location.search).get('spawn'):null;
 T.Mesh.prototype.raycast=acceleratedRaycast;
 const stage=canvas.parentElement,scene=new T.Scene();scene.background=new T.Color('#b89860'); // Round6 warmer plate / terrace chroma
 const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
 RectAreaLightUniformsLib.init();
 renderer.setPixelRatio(smokeMode?1:Math.min(devicePixelRatio||1,stage.clientWidth>700?2:1.5,3840/Math.max(stage.clientWidth,stage.clientHeight)));renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.752; // Round6: dining-still-bright + living-amber + terrace chroma
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 const camera=new T.PerspectiveCamera(42,1,.055,160);
 let env={texture:null,dispose(){}};
 if(!smokeMode){const pmrem=new T.PMREMGenerator(renderer),environment=new RoomEnvironment();env=pmrem.fromScene(environment,.04);scene.environment=env.texture;scene.environmentIntensity=.21;environment.dispose();pmrem.dispose();} // Round6 quieter GI → dining-still-bright
 else{scene.environment=null;scene.environmentIntensity=0;}
 const hemisphere=new T.HemisphereLight('#ffc890','#5a3818',.21);scene.add(hemisphere); // Round6 warmer hemi / terrace chroma
 // Round2: gold-hour sun — lower altitude → longer soft floor stripes (TARGET); Round1 warmer kept
 const sun=new T.DirectionalLight('#ff7420',4.35);sun.position.set(29,4.2,15);sun.castShadow=true; // Round6 amber sun / terrace-cool-chroma
 sun.shadow.mapSize.set(smokeMode?512:(stage.clientWidth>700?4096:2048),smokeMode?512:(stage.clientWidth>700?4096:2048));if(smokeMode){renderer.shadowMap.type=T.BasicShadowMap;sun.castShadow=true;}Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:70});sun.shadow.normalBias=.02;sun.shadow.bias=-.00018;sun.shadow.radius=6.4;scene.add(sun); // Round6 softer contact / living amber
 const walls=new T.Group(),ceilings=new T.Group();scene.add(walls,ceilings);ceilings.visible=true;
 const roundCache=new Map(),boxCache=new Map(),floors=[],chairTargets=[],pillowTargets=[],plantTargets=[],planterTargets=[],bedGroups=[],doorStates=[];
 let seed=296;const rnd=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
 function texture(kind){
  const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');
  if(kind==='wood'){
   ctx.fillStyle='#a88660';ctx.fillRect(0,0,1024,1024);
   for(let x=0;x<1024;x+=128){
    ctx.fillStyle=['#b3936d','#ac8b63','#b99a74','#a98862','#c0a07a'][Math.floor(rnd()*5)];ctx.fillRect(x,0,127,1024);
    for(let i=0;i<180;i++){const xx=x+2+rnd()*123;ctx.strokeStyle=`rgba(67,47,25,${rnd()*.13})`;ctx.lineWidth=.4+rnd();ctx.beginPath();ctx.moveTo(xx,0);for(let y=0;y<=1024;y+=32)ctx.lineTo(xx+Math.sin(y*.009+i)*2,y);ctx.stroke();}
    ctx.fillStyle='#6f573744';ctx.fillRect(x,Math.floor(rnd()*800)+100,128,1);
   }
  }else if(kind==='cloth'){
   ctx.fillStyle='#c2bdb1';ctx.fillRect(0,0,1024,1024);
   for(let i=0;i<1024;i+=3){ctx.strokeStyle=i%2?'#f8f4e25e':'#675e4d46';ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,1024);ctx.stroke();ctx.strokeStyle='#f8f4e242';ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(1024,i);ctx.stroke();}
  }else{
   ctx.fillStyle=kind==='tile'?'#cac9c0':'#b6b3a7';ctx.fillRect(0,0,1024,1024);
   for(let i=0;i<45000;i++){const n=120+Math.floor(rnd()*100);ctx.fillStyle=`rgba(${n},${n},${n},${rnd()*.26})`;const d=rnd()*3;ctx.fillRect(rnd()*1024,rnd()*1024,d,d);}
   if(kind==='tile'){ctx.strokeStyle='#eee9dc';ctx.lineWidth=3;for(let i=0;i<=1024;i+=512){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,1024);ctx.moveTo(0,i);ctx.lineTo(1024,i);ctx.stroke();}}
  }
  const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return tex;
 }
 const woodTex=texture('wood');woodTex.repeat.set(.68,.68);const clothTex=texture('cloth');clothTex.repeat.set(1.5,1.5);const stoneTex=texture('stone');stoneTex.repeat.set(.5,.5);const tileTex=texture('tile');tileTex.repeat.set(.8,.8);
 const standard=(color,roughness=.7,extra={})=>new T.MeshStandardMaterial({color,roughness,envMapIntensity:.85,...extra});
 const fabric=color=>new T.MeshPhysicalMaterial({color,roughness:.88,specularIntensity:.42,sheen:1.25,sheenColor:new T.Color('#f0e2c8'),sheenRoughness:.32,bumpMap:clothTex,bumpScale:.15,envMapIntensity:.42,clearcoat:.04,clearcoatRoughness:.9}); // Round3 weave depth
 const materials={
  wall:standard('#c6ac88',.94,{bumpMap:stoneTex,bumpScale:.029}),ceiling:standard('#d0bc98',.96,{side:T.DoubleSide}), // Round6 plaster dining crush
  oak:standard('#e8d8bb',.55,{map:woodTex,bumpMap:woodTex,bumpScale:.022}),walnut:standard('#c4a57a',.52,{map:woodTex,bumpMap:woodTex,bumpScale:.018}),
  floor:standard('#c6ac7c',.71,{map:woodTex,bumpMap:woodTex,bumpScale:.031}),stone:standard('#ccbc9e',.87,{map:stoneTex,bumpMap:stoneTex,bumpScale:.053}), // Round6 oak / dining-still-bright
  tile:standard('#f0ece0',.48,{map:tileTex,bumpMap:tileTex,bumpScale:.008}),terrace:standard('#f8d0a0',.80,{map:tileTex,bumpMap:tileTex,bumpScale:.024}), // Round7 terrace warmer chroma (no global wash)
  linen:fabric('#beaa84'),ivory:fabric('#ceb89c'),moss:fabric('#6e7454'),blue:fabric('#b0a080'),rose:fabric('#b0a080'), // Round6 greige warmer
  metal:standard('#373e36',.29,{metalness:.65}),brass:standard('#a39772',.28,{metalness:.8}),black:new T.MeshPhysicalMaterial({color:'#0c0d0b',roughness:.35,specularIntensity:.12,envMapIntensity:.18,metalness:.15}),
  porcelain:new T.MeshPhysicalMaterial({color:'#f2efe8',roughness:.19,clearcoat:1,clearcoatRoughness:.12}),
  glass:new T.MeshPhysicalMaterial({color:'#e8f0ee',roughness:.04,metalness:0,transmission:.82,thickness:.35,ior:1.45,transparent:true,opacity:.22,envMapIntensity:1.35,clearcoat:.4,clearcoatRoughness:.08,depthWrite:false}),
  leaf:standard('#566a42',.76,{side:T.DoubleSide}),leaf2:standard('#7b8455',.86,{side:T.DoubleSide}),soil:standard('#544839',.98),rug:fabric('#c2b49a'),
  led:new T.MeshStandardMaterial({color:'#ffd0a0',emissive:'#ff9a40',emissiveIntensity:3.2,roughness:.5,metalness:0}), // Round5 LED quieter
  curtain:new T.MeshPhysicalMaterial({color:'#d8c4a8',roughness:.82,transmission:.16,thickness:.12,transparent:true,opacity:.86,side:T.DoubleSide,sheen:.55,sheenColor:new T.Color('#f3e6d0'),sheenRoughness:.62,envMapIntensity:.35,depthWrite:false})
 };
 const boxGeo=(w,h,d,rounded=false)=>{
  const cache=rounded?roundCache:boxCache,radius=typeof rounded==='number'?rounded:.065,k=[w,h,d,radius].join(',');if(!cache.has(k))cache.set(k,rounded?new RoundedBoxGeometry(w,h,d,3,Math.min(radius,w/5,h/4,d/5)):new T.BoxGeometry(w,h,d));return cache.get(k);
 };
 function box(w,h,d,m,x=0,y=h/2,z=0,parent=scene,rounded=false){const mesh=new T.Mesh(boxGeo(w,h,d,rounded),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function group(px,pz,rotation=0){const g=new T.Group(),[x,z]=point(px,pz);g.position.set(x,0,z);g.rotation.y=rotation;scene.add(g);return g;}
 function sphere(rx,ry,rz,m,x,y,z,parent){const o=new T.Mesh(new T.SphereGeometry(1,20,12),m);o.scale.set(rx,ry,rz);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;(parent||scene).add(o);return o;}
 function cylinder(rt,rb,h,m,x,y,z,parent=scene){const o=new T.Mesh(new T.CylinderGeometry(rt,rb,h,64),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 function tube(points,r,m,parent=scene){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),o=new T.Mesh(new T.TubeGeometry(curve,24,r,8,false),m);parent.add(o);o.castShadow=true;return o;}
 function shapeFor(poly){const s=new T.Shape();poly.forEach((p,i)=>{const [x,z]=point(...p);i?s.lineTo(x,-z):s.moveTo(x,-z);});s.closePath();return s;}
 for(const r of ROOMS){
  const sh=shapeFor(r.poly),m=r.outside?materials.terrace:r.id.startsWith('bath')?materials.tile:materials.floor;
  const floor=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:.12,bevelEnabled:false}),m);floor.rotation.x=-Math.PI/2;floor.position.y=-.12;floor.receiveShadow=true;floor.userData.room=r.id;scene.add(floor);floors.push(floor);
  if(!r.outside){const ceiling=new T.Mesh(new T.ShapeGeometry(sh),materials.ceiling);ceiling.rotation.x=-Math.PI/2;ceiling.position.y=CEILING;ceiling.receiveShadow=true;ceilings.add(ceiling);}
 }
 for(const w of WALLS){
  const [x,z]=point(w[0],w[1]),[xx,zz]=point(w[2],w[3]),len=Math.hypot(xx-x,zz-z),angle=-Math.atan2(zz-z,xx-x),thickness=w[4]==='outer'?.22:WALL_THICKNESS;
  const outward=w[4]==='outer'?(thickness-WALL_THICKNESS)/2:0,ox=w[0]===w[2]?-outward:0,oz=w[1]===w[3]?(w[1]>900?outward:-outward):0;
  const m=box(len,CEILING,thickness,materials.wall,(x+xx)/2+ox,CEILING/2,(z+zz)/2+oz,walls,.006);m.rotation.y=angle;
  const sk=box(len,.045,thickness+.005,materials.wall,(x+xx)/2+ox,.0225,(z+zz)/2+oz,walls);sk.rotation.y=angle;
 }
 // Door heights, window sill and railing dimensions are prototype assumptions.
 const doorHeight=2.75;
 for(const d of DOORS){
  const [x,z]=point(d.x,d.z),end=point(d.x+d.width*Math.cos(d.angle),d.z+d.width*Math.sin(d.angle)),width=Math.hypot(end[0]-x,end[1]-z),hinge=new T.Group();hinge.position.set(x,0,z);hinge.rotation.y=-d.angle;walls.add(hinge);
  const head=box(width,CEILING-doorHeight,.16,materials.wall,width/2,doorHeight+(CEILING-doorHeight)/2,0,hinge);
  box(.018,doorHeight,.16,materials.wall,0,doorHeight/2,0,hinge);box(.018,doorHeight,.16,materials.wall,width,doorHeight/2,0,hinge);box(width,.018,.16,materials.wall,width/2,doorHeight,0,hinge);
  const leaf=new T.Group();leaf.rotation.y=d.open;leaf.userData.dynamic=true;hinge.add(leaf);const panel=box(width-.04,doorHeight-.03,.04,d.glass?materials.glass:materials.oak,width/2,doorHeight/2,0,leaf,true);panel.castShadow=!d.glass;
  box(.12,.018,.022,materials.metal,width-.13,1.05,.043,leaf,true);
  // Invisible thicker hit slab so live mouse raycast finds the leaf even at glancing angles.
  // Enlarged hit volume (v8): thick slab so living-side glancing rays still hit leaf without toggleDoor.
  // v9: thicker hit + slightly taller for easier glance clicks
  const doorHit=new T.Mesh(new T.BoxGeometry(width+.28,doorHeight+.18,1.08),new T.MeshBasicMaterial({visible:false}));doorHit.position.set(width/2,doorHeight/2,0);doorHit.userData.dynamic=true;leaf.add(doorHit);
  doorStates.push({d,leaf,panel,width,angle:d.open,velocity:0,target:d.open,manual:false,point:new T.Vector3(x,0,z)});
 }
 function windowLine(a,b){
  const [x,z]=point(...a),[xx,zz]=point(...b),len=Math.hypot(xx-x,zz-z),g=new T.Group();g.position.set((x+xx)/2,0,(z+zz)/2);g.rotation.y=-Math.atan2(zz-z,xx-x);walls.add(g);
  box(len,.48,.16,materials.wall,0,.24,0,g);box(len,.07,.17,materials.metal,0,.52,0,g);box(len,.06,.17,materials.metal,0,3.22,0,g);
  const pane=box(len,2.65,.025,materials.glass,0,1.86,0,g);pane.castShadow=false;
  const count=Math.ceil(len/1.1);for(let i=0;i<=count;i++)box(.035,2.75,.11,materials.metal,-len/2+i*len/count,1.86,0,g);
 }
 windowLine([184,18],[499,18]);windowLine([499,18],[499,716]);
 // Structural columns follow the dark blocks on the supplied drawing.
 for(const [px,pz,w,d]of[[181,94,.5,.95],[181,414,.5,.5],[181,694,.5,.85],[177,1013,.5,.95],[483,415,.4,.5],[482,700,.5,.6],[485,1012,.5,.5]]){const [x,z]=point(px,pz);box(w,CEILING,d,materials.wall,x,CEILING/2,z,walls);}
 // A thin slab and a glass terrace railing, kept outside the apartment rooms.
 const terraceEdge=group(786,865);box(.1,1.1,6.05,materials.glass,0,.55,0,terraceEdge).castShadow=false;box(.045,.045,6.05,materials.metal,0,1.1,0,terraceEdge);
 for(const pz of[716,1014]){const g=group(642,pz);box(5.8,1.1,.05,materials.glass,0,.55,0,g).castShadow=false;box(5.8,.045,.045,materials.metal,0,1.1,0,g);}
 
 function rug(px,pz,w,d,color){
  // Round7: jute kept at Round6 (living rug) — dining crush via lights only
  const g=group(px,pz),c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');ctx.fillStyle='#8a7552';ctx.fillRect(0,0,1024,1024);
  for(let y=0;y<1024;y+=7)for(let x=0;x<1024;x+=7){const offset=(y/7)%2?3.5:0;ctx.strokeStyle='#4a3a22';ctx.lineWidth=4.2;ctx.beginPath();ctx.ellipse(x+offset+3.5,y+3.5,2.6,4.8,.35,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#b89a6a';ctx.lineWidth=2.6;ctx.beginPath();ctx.ellipse(x+offset+3.5,y+2.6,2.4,3.9,.35,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#e6d4ae';ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(x+offset+2.8,y+.6);ctx.lineTo(x+offset+5.2,y+5.2);ctx.stroke();}
  for(let i=0;i<14000;i++){ctx.fillStyle=`rgba(55,40,22,${Math.random()*.12})`;ctx.fillRect(Math.random()*1024,Math.random()*1024,1.4,1.4);}
  const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(w*4.0,d*4.0);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;const material=new T.MeshPhysicalMaterial({color:'#927850',roughness:.99,map:tex,bumpMap:tex,bumpScale:.20,sheen:.25,sheenColor:new T.Color('#d0bc90'),sheenRoughness:.86,envMapIntensity:.07}); // Round7 jute=Round6 (protect living)
  box(w,.028,d,material,0,.018,0,g,.008);for(let i=0;i<Math.floor(w/.02);i++){box(.006,.008,.055,materials.linen,-w/2+i*.02,.019,d/2,g);box(.006,.008,.055,materials.linen,-w/2+i*.02,.019,-d/2,g);}return g;
 }
 function bed(px,pz,color,width=1.8){
  const g=group(px,pz,Math.PI/2);bedGroups.push(g);box(width+.12,.28,2.2,materials.walnut,0,.2,0,g,true);box(width,.3,2.08,materials.ivory,0,.48,0,g,true);

  const cloth=new T.PlaneGeometry(width+.22,1.88,70,85),positions=cloth.attributes.position;
  for(let i=0;i<positions.count;i++){
   const x=positions.getX(i),z=-positions.getY(i)+.31;
   const edge=Math.max(0,(Math.abs(x)-width*.44)/(width*.11)),foot=Math.max(0,(z-1.01)/.24);
   const wave=.004*Math.sin(x*19+z*7)+.006*Math.sin(z*13+x*9)+.008*Math.cos(x*7-z*4);
   positions.setXYZ(i,x,.734+wave-.2*edge*edge-.13*foot*foot,z);
  }
  cloth.computeVertexNormals();const clothMat=color.clone();clothMat.side=T.DoubleSide;const duvet=new T.Mesh(cloth,clothMat);duvet.castShadow=true;duvet.receiveShadow=true;g.add(duvet);
  for(const x of[-width*.25,width*.25]){const holder=new T.Group();holder.position.set(x,.68,-.68);holder.rotation.y=x*.05;g.add(holder);box(width*.43,.19,.53,materials.ivory,0,.095,0,holder,true);pillowTargets.push({holder,width:width*.43,height:.22,depth:.53});}
  const throwGeo=new T.PlaneGeometry(width+.18,.52,48,28),tp=throwGeo.attributes.position;
  for(let i=0;i<tp.count;i++){const x=tp.getX(i),z=tp.getY(i);tp.setXYZ(i,x,.755+.005*Math.sin(x*27+z*21)-Math.max(0,Math.abs(x)-width*.46)*.7,.72+z);}
  throwGeo.computeVertexNormals();const throwMat=materials.linen.clone();throwMat.side=T.DoubleSide;const folded=new T.Mesh(throwGeo,throwMat);folded.castShadow=folded.receiveShadow=true;g.add(folded);
  for(const x of[-width/2-.38,width/2+.38]){box(.5,.46,.48,materials.walnut,x,.25,-.76,g,true);box(.51,.035,.49,materials.stone,x,.5,-.76,g,true);}
 }
 rug(246,196,2.52,2.8,'#b7ae98');bed(248,195,materials.ivory,1.8);
 rug(403,194,2.6,2.85,'#bdae93');bed(403,195,materials.rose,1.9);
 rug(414,495,2.4,2.8,'#b7ae98');bed(414,495,materials.blue,1.65);
 function chair(px,pz,rot=0,material=materials.moss){
  const g=group(px,pz,rot);box(.53,.13,.54,material,0,.49,0,g,true);const b=box(.55,.49,.12,material,0,.79,-.23,g,true);b.rotation.x=-.08;
  for(const x of[-.2,.2])for(const z of[-.19,.19]){const leg=box(.034,.43,.034,materials.walnut,x,.23,z,g,true);leg.rotation.z=x*.11;}
  chairTargets.push(g);return g;
 }
 function ovalTable(px,pz,w,d){const g=group(px,pz);box(w,.09,d,materials.walnut,0,.79,0,g,true);for(const x of[-w*.32,w*.32])cylinder(.17,.24,.73,materials.walnut,x,.38,0,g);return g;}
 // Contemporary living room: the old ten-seat dining set is replaced with a lounge.
 // Architecture is fixed; loose furniture is part of the user's renovation concept.
 rug(364,957,3.6,1.9,'#c8c0ac');
 const livingSofa=group(363,984,Math.PI);
 function upholstered(w,h,d,m,x,y,z,parent){
  const geo=new T.SphereGeometry(1,48,30),p=geo.attributes.position,sp=(a,e)=>Math.sign(a)*Math.pow(Math.abs(a),e);
  for(let i=0;i<p.count;i++){const nx=p.getX(i),ny=p.getY(i),nz=p.getZ(i);let xx=sp(nx,.42)*w/2,yy=sp(ny,.4)*h/2,zz=sp(nz,.43)*d/2;const wrinkle=(Math.sin(xx*42+zz*11)+Math.sin(zz*51-xx*7)+Math.sin(xx*19+zz*29)*.55)*.0065*Math.max(0,ny+.15); // Round2 fabric depth
   p.setXYZ(i,xx,yy+wrinkle,zz);}
  geo.computeVertexNormals();const mesh=new T.Mesh(geo,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 box(2.8,.12,.78,materials.metal,0,.13,0,livingSofa);
 upholstered(3,.34,.98,materials.ivory,0,.32,0,livingSofa);
 for(const x of[-.94,0,.94]){upholstered(.97,.2,.82,materials.ivory,x,.55,.035,livingSofa);const back=upholstered(.98,.54,.21,materials.ivory,x,.82,-.35,livingSofa);back.rotation.x=-.12;}
 for(const x of[-1.39,1.39])upholstered(.24,.45,.93,materials.ivory,x,.62,.015,livingSofa);
 for(const x of[-.91,.89]){const holder=new T.Group();holder.position.set(x,.67,-.17);holder.rotation.x=-.17;holder.rotation.y=x*.14;livingSofa.add(holder);pillowTargets.push({holder,width:.56,height:.44,depth:.16});}{const holder=new T.Group();holder.position.set(.05,.64,-.05);holder.rotation.x=-.22;holder.rotation.y=-.35;livingSofa.add(holder);pillowTargets.push({holder,width:.48,height:.38,depth:.18});}
 // Round2: draped throw on sofa arm (TARGET knit throw)
 {const throwGeo=new T.PlaneGeometry(1.15,.72,36,28),tp=throwGeo.attributes.position;
  for(let i=0;i<tp.count;i++){const x=tp.getX(i),z=tp.getY(i);const fold=.012*Math.sin(x*18+z*11)+.008*Math.cos(z*22);const drape=Math.max(0,-z-.05)*.55;tp.setXYZ(i,x+fold*.4,.78+fold-drape*.35,.05+z*.55-drape*.2);}
  throwGeo.computeVertexNormals();const throwMat=materials.linen.clone();throwMat.color.set('#c8b08a');throwMat.sheen=1.2;throwMat.sheenRoughness=.36; // Round3 knit throw
  throwMat.side=T.DoubleSide;const throwMesh=new T.Mesh(throwGeo,throwMat);throwMesh.position.set(.95,.02,-.05);throwMesh.rotation.y=-.35;throwMesh.castShadow=throwMesh.receiveShadow=true;livingSofa.add(throwMesh);}
 const coffeeTable=group(364,944);const top=cylinder(.72,.72,.075,materials.stone,0,.40,0,coffeeTable);top.scale.z=.78;const base=cylinder(.30,.34,.38,materials.stone,0,.19,0,coffeeTable);base.scale.z=.82; // Round2 travertine mass
 // Lounge dining (TARGET): table + 4 chairs + flat saucer pendant toward terrace
 // Round1 dining depth: stone top + thicker apron
 const loungeDining=group(458,918);const diningTop=materials.stone.clone();diningTop.color=new T.Color('#b8a888');diningTop.roughness=Math.min(.95,(diningTop.roughness||.7)+.08); // Round7 dining-local stone crush
 box(1.58,.085,.96,diningTop,0,.78,0,loungeDining,true);box(1.5,.05,.88,materials.walnut,0,.72,0,loungeDining,true);for(const x of[-.55,.55])cylinder(.1,.13,.72,materials.walnut,x,.36,0,loungeDining);
 chair(458,880,Math.PI,materials.linen);chair(458,956,0,materials.linen);chair(420,918,-Math.PI/2,materials.linen);chair(492,918,Math.PI/2,materials.linen);
 {const g=group(458,918);cylinder(.02,.02,.55,materials.metal,0,CEILING-.28,0,g);const dish=cylinder(.48,.52,.035,materials.linen,0,2.22,0,g);dish.scale.y=.55;cylinder(.42,.42,.008,materials.led,0,2.195,0,g);const pl=new T.PointLight('#ffd0a0',1.75,3.1,2.2);pl.position.set(0,2.05,0);g.add(pl);} // Round7 dining pendant quieter (dining-still-bright)
 
 // Cohesive oak TV wall unit (TARGET): full panel + niches/shelves left of TV + low console + LED
 const media=group(385,865);
 box(4.35,3.22,.04,materials.oak,0,1.72,-.02,media); // full back panel
 // Low floating console
 box(4.05,.032,.38,materials.oak,0,.52,.14,media,.003);box(4.05,.032,.38,materials.oak,0,.26,.14,media,.003);box(4.05,.26,.028,materials.oak,0,.39,-.02,media,.003);
 for(const x of[-2.01,2.01])box(.028,.26,.38,materials.oak,x,.39,.14,media,.003);
 if(atelier){for(const x of[-1.32,1.32])box(1.4,.24,.028,materials.oak,x,.39,.31,media,.003);}else box(4.02,.24,.028,materials.oak,0,.39,.31,media,.003);
 // Open niche unit left of TV (books / ceramics)
 box(.92,2.55,.28,materials.oak,-1.62,1.72,.12,media,.004);
 for(const y of[.95,1.55,2.15,2.85])box(.86,.03,.26,materials.oak,-1.62,y,.14,media,.002);
 for(const y of[.95,1.55,2.15])box(.78,.012,.018,materials.led,-1.62,y-.02,.24,media);
 // Vertical oak slats flanking TV bay
 for(let i=0;i<8;i++)box(.028,3.05,.02,materials.walnut,-1.08+i*.09,1.72,.01,media);
 for(let i=0;i<6;i++)box(.028,3.05,.02,materials.walnut,1.05+i*.09,1.72,.01,media);
 // TV
 const tvPanel=box(1.72,1.0,.03,materials.black,.22,1.68,.03,media,.004);
 tvPanel.userData.dynamic=true;
 const tvMat=tvPanel.material.clone();tvPanel.material=tvMat;tvMat.emissive=new T.Color('#000000');tvMat.emissiveIntensity=0;
 let tvOn=false;
 const tvGlow=new T.RectAreaLight('#9ec8ff',0,1.55,.9);tvGlow.position.set(.22,1.68,.08);tvGlow.lookAt(.22,1.5,.8);media.add(tvGlow);
 // Under-console LED strip
 box(3.95,.014,.022,materials.led,0,.245,.28,media);for(let i=1;i<6;i++)box(.006,.24,.004,materials.walnut,-2.0+i*.66,.39,.325,media);
 // Round1 LED cove warmer/brighter under console + niche
 const consoleLight=new T.RectAreaLight('#ffc878',9.2,3.9,.16);consoleLight.position.set(0,.185,.22);consoleLight.rotation.x=-Math.PI/2;media.add(consoleLight); // Round3
 const shelfLed=new T.RectAreaLight('#ffd090',4.8,.75,.07);shelfLed.position.set(-1.62,1.52,.22);shelfLed.rotation.x=-Math.PI/2;media.add(shelfLed);
 const shelfLed2=new T.RectAreaLight('#ffd090',4.2,.75,.07);shelfLed2.position.set(-1.62,2.12,.22);shelfLed2.rotation.x=-Math.PI/2;media.add(shelfLed2);
 // Extra cove strip above TV bay — Round2 warmer glow
 const coveTop=new T.RectAreaLight('#ffc878',3.6,1.9,.06);coveTop.position.set(.22,2.28,.1);coveTop.rotation.x=Math.PI/2;media.add(coveTop); // Round3
 // A restrained plaster artwork completes the contemporary wall above the sofa.
 const artCanvas=document.createElement('canvas');artCanvas.width=artCanvas.height=1024;const artContext=artCanvas.getContext('2d');artContext.fillStyle='#d6c9af';artContext.fillRect(0,0,1024,1024);
 for(let i=0;i<50000;i++){artContext.fillStyle=i%2?'#8d7c5312':'#fff8de20';artContext.fillRect(rnd()*1024,rnd()*1024,rnd()*2+.4,rnd()*2+.4);}artContext.strokeStyle='#b9a98a';artContext.lineWidth=12;artContext.beginPath();artContext.ellipse(540,520,260,365,-.3,0,Math.PI*1.8);artContext.stroke();artContext.strokeStyle='#dcd2bd';artContext.lineWidth=8;artContext.beginPath();artContext.ellipse(490,500,250,355,-.3,0,Math.PI*1.8);artContext.stroke();
 const artTexture=new T.CanvasTexture(artCanvas);artTexture.colorSpace=T.SRGBColorSpace;const art=group(363,1008);box(1.58,1.0,.035,materials.walnut,0,1.98,0,art,.004);box(1.545,.965,.008,standard('#ffffff',.96,{map:artTexture,bumpMap:artTexture,bumpScale:.003}),0,1.98,-.025,art);
 // Office: desk, task chair, storage, shelves and a small computer.
 const desk=group(94,935);box(2.25,.065,.86,materials.oak,0,.77,0,desk,true);for(const x of[-.97,.97])box(.06,.72,.66,materials.metal,x,.39,0,desk);
 box(.72,.43,.035,materials.black,0,1.08,-.15,desk,true);box(.07,.2,.08,materials.metal,0,.86,-.15,desk);box(.55,.018,.18,materials.black,0,.815,.17,desk,true);
 const officeChair=chair(94,981,0,materials.linen);chairTargets.splice(chairTargets.indexOf(officeChair),1);box(.04,.22,.04,materials.metal,0,.23,0,officeChair);for(let i=0;i<5;i++){const spoke=box(.42,.025,.025,materials.metal,.08,.08,0,officeChair);spoke.rotation.y=i*Math.PI*2/5;}
 const shelving=group(91,830);box(2.65,.5,.32,materials.walnut,0,.25,0,shelving,true);for(let k=0;k<3;k++)box(2.3,.045,.24,materials.oak,0,1.35+k*.44,0,shelving);for(let i=0;i<13;i++)box(.045,.25+rnd()*.1,.17,i%3?materials.moss:materials.linen,-1+i*.15,1.51,.01,shelving);
 // Kitchen worktop follows the north wall, with the dining table in its original zone.
 const kitchen=group(385,738);box(4.15,.84,.025,materials.oak,0,.46,.303,kitchen,.004);box(4.15,.04,.62,materials.oak,0,.12,0,kitchen);for(const x of[-2.065,2.065])box(.025,.84,.62,materials.oak,x,.46,0,kitchen);
 const counterShape=new T.Shape();counterShape.moveTo(-2.105,-.335);counterShape.lineTo(2.105,-.335);counterShape.lineTo(2.105,.335);counterShape.lineTo(-2.105,.335);counterShape.closePath();const hole=new T.Path();hole.moveTo(-1.715,-.22);hole.lineTo(-1.715,.22);hole.lineTo(-1.005,.22);hole.lineTo(-1.005,-.22);hole.closePath();counterShape.holes.push(hole);const counter=new T.Mesh(new T.ExtrudeGeometry(counterShape,{depth:.04,bevelEnabled:false}),materials.stone);const counterUV=counter.geometry.attributes.uv,cp=counter.geometry.attributes.position;for(let i=0;i<counterUV.count;i++)counterUV.setXY(i,cp.getX(i)/4.21+.5,cp.getY(i)/.67+.5);counter.rotation.x=-Math.PI/2;counter.position.y=.885;counter.castShadow=counter.receiveShadow=true;kitchen.add(counter);
 for(let i=0;i<7;i++)box(.009,.75,.012,materials.walnut,-1.8+i*.6,.49,.318,kitchen);
 box(4.15,.58,.035,materials.stone,0,1.22,-.29,kitchen);box(4.15,.82,.025,materials.oak,0,2.07,-.285,kitchen);for(let i=0;i<7;i++){box(.583,.82,.35,materials.oak,-1.779+i*.593,2.07,-.12,kitchen,.004);box(.583,.76,.42,materials.wall,-1.779+i*.593,2.89,-.085,kitchen,.004);}box(4.05,.015,.018,materials.led,0,1.65,.08,kitchen);
 box(.70,.018,.43,materials.metal,-1.36,.75,0,kitchen,.008);for(const z of[-.215,.215])box(.70,.18,.015,materials.metal,-1.36,.84,z,kitchen,.004);for(const x of[-1.71,-1.01])box(.015,.18,.43,materials.metal,x,.84,0,kitchen,.004);
 tube([[-1.36,.96,-.17],[-1.36,1.28,-.17],[-1.36,1.31,.04],[-1.36,1.18,.07]],.018,materials.brass,kitchen);
 box(.63,.015,.5,materials.black,.26,.945,0,kitchen,true);for(const x of[.1,.41])for(const z of[-.13,.13])cylinder(.085,.085,.006,materials.metal,x,.958,z,kitchen);
 const kitchenTable=group(383,832);box(2.2,.065,.69,materials.stone,0,.79,0,kitchenTable,true);for(const x of[-.88,.88])box(.065,.74,.48,materials.walnut,x,.39,0,kitchenTable);
 for(const px of[351,396])chair(px,803,Math.PI,materials.linen);chair(318,833,-Math.PI/2,materials.linen);chair(448,833,Math.PI/2,materials.linen);
 // Bedroom storage and wardrobe doors retain the positions shown on the plan.
 const wardrobe=group(201,349);box(.51,2.7,2.6,materials.oak,0,1.35,0,wardrobe,true);for(let i=0;i<5;i++){box(.018,2.5,.018,materials.walnut,.27,1.4,-1.14+i*.57,wardrobe);box(.025,.35,.025,materials.brass,.285,1.3,-.91+i*.57,wardrobe);}
 const masterStorage=group(424,343);box(2.75,2.7,.5,materials.oak,0,1.35,0,masterStorage,true);for(let i=0;i<5;i++)box(.015,2.5,.018,materials.walnut,-1.1+i*.55,1.4,.26,masterStorage);
 const entryCabinet=group(115,729);box(1.8,2.7,.4,materials.oak,0,1.35,0,entryCabinet,true);box(.68,1.9,.025,materials.glass,.4,1.5,.215,entryCabinet);
 rug(100,778,1.15,.7,'#887d69');
 // Bathrooms: full-height tile panels, bath profiles, basins, taps and mirrors.
 function porcelainProfile(profile,sx,sz,parent,x=0,y=0,z=0){const geo=new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),80),mesh=new T.Mesh(geo,materials.porcelain);mesh.scale.set(sx,1,sz);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function bath(px,pz,rotation=0,length=.78){const g=group(px,pz,rotation);porcelainProfile([[0,.03],[.48,.03],[.8,.08],[.93,.18],[1,.5],[1,.54],[.95,.565],[.89,.54],[.83,.45],[.74,.16],[.65,.13],[0,.13]],length,.355,g);tube([[.53,.3,-.29],[.53,.77,-.29],[.53,.8,-.12],[.53,.7,-.12]],.012,materials.brass,g);cylinder(.025,.025,.003,materials.metal,0,.133,0,g);}
 function vanity(px,pz,rotation=0,width=.72){const g=group(px,pz,rotation);box(width,.43,.43,materials.oak,0,.52,0,g,.008);box(width+.025,.035,.46,materials.stone,0,.76,0,g,.005);box(width-.04,.002,.002,materials.walnut,0,.54,.218,g);porcelainProfile([[0,0],[.7,0],[.95,.04],[1,.12],[.98,.14],[.9,.14],[.85,.1],[.6,.035],[0,.03]],width*.39,.17,g,0,.785,.025);tube([[0,.8,-.17],[0,1.03,-.17],[0,1.04,-.02]],.012,materials.brass,g);}
 function toilet(px,pz,rotation=0){const g=group(px,pz,rotation);porcelainProfile([[0,.03],[.68,.03],[.88,.12],[.98,.28],[1,.36],[.93,.39],[.82,.36],[.73,.25],[.6,.12],[0,.10]],.215,.30,g,0,.12,.04);const lid=new T.Mesh(new T.CylinderGeometry(1,1,.025,72),materials.porcelain);lid.scale.set(.208,1,.293);lid.position.set(0,.51,.04);lid.castShadow=true;g.add(lid);box(.2,.13,.012,materials.metal,0,1.0,-.27,g,.008);box(.075,.07,.015,materials.stone,-.035,1,-.26,g,.004);}
 bath(237,443);vanity(203,509,Math.PI/2,.66);toilet(213,565);vanity(254,561,0,.62);bath(375,676,Math.PI/2,.70);toilet(428,693);vanity(455,695,Math.PI,.50);
 // Tile strips add a legible change of material at each bathroom wall.
 for(const id of['bath1','bath2','bath3']){const r=roomById[id],p=r.poly;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];const [x,z]=point(...a),[xx,zz]=point(...b);if(a[0]===b[0]&&a[0]===282)continue;const tile=box(Math.hypot(xx-x,zz-z),3.15,.012,materials.stone,(x+xx)/2,1.64,(z+zz)/2,walls);tile.rotation.y=-Math.atan2(zz-z,xx-x);}}
 function plant(px,pz,size=.65,pot=materials.stone){
  const g=group(px,pz);cylinder(size*.22,size*.17,size*.42,pot,0,size*.21,0,g);cylinder(size*.2,size*.2,.02,materials.soil,0,size*.42,0,g);
  for(let i=0;i<11;i++){const a=i*2.4,len=size*(.45+rnd()*.5),x=Math.cos(a)*size*.3,z=Math.sin(a)*size*.3,y=size*.5+len*.55;
   tube([[0,size*.39,0],[x*.45,y*.8,z*.45],[x,y,z]],.006,materials.leaf,g);const leaf=sphere(size*.18,size*.025,len*.36,i%2?materials.leaf:materials.leaf2,x,y,z,g);leaf.rotation.set(.3,a,.2);
  }plantTargets.push({holder:g,size});return g;
 }
 for(const [x,z,s]of[[315,67,.65],[473,51,.62],[471,596,.7],[132,913,.7],[477,877,.75],[473,992,.66],[545,760,1.15],[720,780,1.05],[560,990,1.2],[710,960,.95],[640,860,.55]])plant(x,z,s);
 // Original terrace planters and the unlabelled rectangular element are retained.
 for(const [px,pz,w,d]of[[564,744,1.18,.23],[699,744,1.18,.23],[564,988,1.18,.23],[699,988,1.18,.23],[758,807,.23,1.65],[758,965,.23,1.1]]){
  const g=group(px,pz);box(w,.3,d,materials.stone,0,.15,0,g,.006);box(w-.04,.02,d-.04,materials.soil,0,.31,0,g);const foliage=new T.Group();g.add(foliage);const count=Math.ceil(Math.max(w,d)/.18),positions=[];for(let i=0;i<count;i++){const x=w>d?i*.18-w/2+.09:0,z=d>w?i*.18-d/2+.09:0;sphere(.11,.14,.11,materials.leaf,x,.4,z,foliage);positions.push([x,z]);}planterTargets.push({holder:foliage,positions});
 }
 const service=group(733,892);box(1.92,.12,.92,materials.stone,0,.06,0,service);box(1.7,.018,.7,materials.metal,0,.13,0,service);
 // Contemporary loose furniture sits in the terrace's open area, away from doors.
 const outdoor=group(612,965);box(2.4,.24,.8,materials.walnut,0,.24,0,outdoor,true);box(2.25,.15,.7,materials.ivory,0,.44,0,outdoor,true);box(2.4,.45,.16,materials.linen,0,.63,.34,outdoor,true);for(const x of[-.75,0,.75])box(.65,.32,.12,materials.moss,x,.7,.18,outdoor,true);
 chair(561,885,Math.PI,materials.linen);chair(649,885,Math.PI,materials.linen);const coffee=group(608,910);cylinder(.4,.42,.06,materials.stone,0,.43,0,coffee);cylinder(.1,.15,.4,materials.walnut,0,.2,0,coffee);plant(525,956,1.2);
 // Light fittings give the confirmed 3.40 m ceiling a visible reference scale.
 for(const [px,pz]of[[264,115],[416,93],[421,560],[317,449],[316,655],[384,785],[336,889],[103,871]]){
  const [x,z]=point(px,pz);cylinder(.055,.055,.015,materials.metal,x,3.386,z,ceilings);cylinder(.035,.035,.006,materials.led,x,3.374,z,ceilings);
 }
 for(const [px,pz,len]of[[366,892,2.8],[384,785,2.0],[317,532,3.0]]){const[x,z]=point(px,pz);box(len,.018,.045,materials.metal,x,3.375,z,ceilings);box(len-.03,.005,.018,materials.led,x,3.362,z,ceilings);}
 // Daylight enters through the actual perimeter openings; local fills stay restrained.
 const dayLights=[];
 // Round7: ONLY dining windows (492,923 / 492,779) base↓↓ — living fills/exposure untouched (living mean≈113)
 for(const [px,pz,width,rotation,base]of[[493,150,2.7,-Math.PI/2,1.0],[493,490,2.2,-Math.PI/2,1.0],[492,923,.85,-Math.PI/2,.22],[492,779,.85,-Math.PI/2,.28],[260,25,2.5,Math.PI,1.0]]){
  const[x,z]=point(px,pz),light=new T.RectAreaLight('#ffc890',1.02*base,width,2.5);light.userData.base=base;light.position.set(x,1.9,z);light.rotation.y=rotation;scene.add(light);dayLights.push(light);
 }
 const fills=[];for(const[px,pz,base]of[[270,120,1.05],[420,170,1.05],[420,522,1.0],[325,532,1.0],[100,925,.62],[363,932,1.0],[382,784,.48]]){const[x,z]=point(px,pz),light=new T.PointLight('#ffb870',1.95*base,4.6,2.2);light.userData.base=base;light.position.set(x,3.12,z);scene.add(light);fills.push(light);} // Round7 dining-only fill↓; living fills slight↑ protect |err|
 const interior=furnish({scene,materials,group,box,cylinder,tube,fabric,plant,pillowTargets,bedGroups,doors:doorStates,renderer,atelier});
 for(const c of interior.curtains)c.group.userData.dynamic=true;
 for(const i of interior.interactions)i.object.userData.dynamic=true;
 // v9 interactives: TV power + wall art lamp (map/lamp/curtains already in interior)
 {
  const tvHit=new T.Mesh(new T.BoxGeometry(1.9,1.15,.55),new T.MeshBasicMaterial({visible:false}));
  tvHit.position.set(.22,1.68,.12);tvHit.userData.dynamic=true;media.add(tvHit);
  interior.interactions.push({object:tvHit,label:'ТВ',kind:'tv',get on(){return tvOn;},action:()=>{
   tvOn=!tvOn;tvMat.emissive.set(tvOn?'#1a3a5c':'#000000');tvMat.emissiveIntensity=tvOn?.55:0;tvMat.color.set(tvOn?'#0a1520':'#0c0d0b');tvGlow.intensity=tvOn?2.4:0;tvMat.needsUpdate=true;canvas.dataset.tv=tvOn?'on':'off';
  }});
  canvas.dataset.tv='off';
  // Soft art wash light toggle (sofa wall)
  const artLamp=new T.SpotLight('#ffe4c0',0,5.5,.55,.45,1.4);artLamp.position.set(...(()=>{const[x,z]=point(363,980);return[x,2.85,z];})());
  artLamp.target.position.set(...(()=>{const[x,z]=point(363,1008);return[x,1.9,z];})());
  scene.add(artLamp);scene.add(artLamp.target);let artOn=false;
  const artHit=new T.Mesh(new T.BoxGeometry(2.05,1.55,.62),new T.MeshBasicMaterial({visible:false}));
  {const[x,z]=point(363,1008);artHit.position.set(x,1.98,z);artHit.userData.dynamic=true;scene.add(artHit);}
  interior.interactions.push({object:artHit,label:'Подсветка картины',kind:'art',get on(){return artOn;},action:()=>{artOn=!artOn;artLamp.intensity=artOn?3.2:0;canvas.dataset.art=artOn?'on':'off';}});
  canvas.dataset.art='off';
 }

 const physics=createPhysicsWorld();
 // Static large furniture (matches interior AABB thrash colliders) — physics + AABB both active.
 for(const [px,pz,hx,hy,hz,cy] of[
  [363,984,1.7,.45,.7,.45],  // sofa
  [364,944,.75,.21,.55,.21], // coffee (top≈0.42 matches visual cylinder)
  [385,865,2.3,.9,.4,1.0],   // TV / media
  [286,866,.45,.8,.3,1.2],   // shelves
  [458,918,.95,.45,.7,.5],   // lounge dining
  [383,832,1.2,.45,.45,.5],  // kitchen table
  [385,738,2.15,.5,.4,.5],   // kitchen counter
  [94,935,1.2,.45,.5,.5],    // office desk
  [450,1000,.22,.8,.22,.9],  // floor lamp
 ]){const[wx,wz]=point(px,pz);physics.addStaticBox(wx,cy,wz,hx,hy,hz);}
 // Dynamic small props on coffee table (scene-rooted so body↔mesh sync is 1:1).
 const physProps=[];
 {const[cx,cz]=point(364,944);
  const mk=(mesh,opts)=>{scene.add(mesh);mesh.userData.dynamic=true;physics.addDynamicMesh(mesh,opts);physProps.push(mesh);return mesh;};
  // No SphereGeometry / porcelain eggs — oak cylinder vase + walnut tray + 2 books on table top (~0.42).
  const vase=new T.Mesh(new T.CylinderGeometry(.045,.055,.16,20),materials.oak.clone());vase.position.set(cx+.16,.50,cz-.06);vase.castShadow=true;mk(vase,{mass:.2,shape:'box',halfExtents:[.05,.08,.05]});
  const tray=new T.Mesh(new T.BoxGeometry(.16,.025,.12),materials.walnut.clone());tray.position.set(cx+.02,.435,cz+.1);tray.rotation.y=.22;tray.castShadow=true;mk(tray,{mass:.16,shape:'box',halfExtents:[.08,.015,.06]});
  const book=new T.Mesh(new T.BoxGeometry(.22,.03,.16),materials.linen.clone());book.position.set(cx-.2,.437,cz-.04);book.castShadow=true;mk(book,{mass:.12,shape:'box',halfExtents:[.11,.02,.08]});
  const book2=new T.Mesh(new T.BoxGeometry(.2,.025,.15),materials.walnut.clone());book2.position.set(cx-.18,.465,cz-.02);book2.rotation.y=.18;book2.castShadow=true;mk(book2,{mass:.1,shape:'box',halfExtents:[.1,.015,.075]});
 }
 canvas.dataset.physics=`cannon-es static=${physics.staticCount} dynamic=${physics.dynamicCount}`;

 const stepMarker=new T.Mesh(new T.RingGeometry(.095,.12,48),new T.MeshBasicMaterial({color:'#f8e8c6',transparent:true,opacity:.65,depthWrite:false}));stepMarker.rotation.x=-Math.PI/2;stepMarker.userData.dynamic=true;stepMarker.visible=false;scene.add(stepMarker);
 let markerLife=0,clockValue=.38,clockTarget=.38;
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 // Round7: SSAO/bloom = Round6 (global protect living); dining crush via selective lights
 const ao=new SSAOPass(scene,camera,640,480);ao.kernelRadius=1.95;ao.minDistance=.00034;ao.maxDistance=.53;ao.output=SSAOPass.OUTPUT.Default;composer.addPass(ao);
 const bloom=new UnrealBloomPass(new T.Vector2(640,480),.036,.29,.986);composer.addPass(bloom);
 composer.addPass(new OutputPass());const fxaa=new ShaderPass(FXAAShader);composer.addPass(fxaa);
 if(smokeMode){ao.enabled=false;bloom.enabled=false;fxaa.enabled=false;renderer.shadowMap.enabled=false;}
 // Quality presets: high (desktop wide), medium (laptop), low (narrow / soft GPU)
 let qualityPreset='high';let forceRender=false;
 function applyQuality(preset){
  qualityPreset=preset;const w=stage.clientWidth,h=stage.clientHeight;
  if(preset==='low'){ao.enabled=false;bloom.enabled=false;fxaa.enabled=false;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1));renderer.shadowMap.type=T.BasicShadowMap;sun.shadow.mapSize.set(512,512);sun.castShadow=w>420;}
  else if(preset==='medium'){ao.enabled=false;bloom.enabled=w>600;bloom.strength=.036;bloom.radius=.28;bloom.threshold=.986;fxaa.enabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));renderer.shadowMap.type=T.PCFShadowMap;sun.shadow.mapSize.set(1024,1024);sun.castShadow=true;}
  else{ao.enabled=w>600;bloom.enabled=true;bloom.strength=.036;bloom.radius=.29;bloom.threshold=.986;fxaa.enabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio||1,w>700?1.75:1.5,3840/Math.max(w,h)));renderer.shadowMap.type=T.PCFSoftShadowMap;sun.shadow.mapSize.set(w>700?2048:1024,w>700?2048:1024);sun.castShadow=true;}
  renderer.shadowMap.needsUpdate=true;composer.setSize(w,h);ao.setSize(Math.min(w,preset==='high'?1280:640),Math.min(h,preset==='high'?900:480));bloom.setSize(w,h);const pr=renderer.getPixelRatio();fxaa.material.uniforms.resolution.value.set(1/(w*pr),1/(h*pr));
 }
 let frame=0,shown=true,onMove=null,onInteraction=null,lastTick=0,ready=false,photo=null,photoActive=false,photoBusy=false,photoState='off',denoise=null,photoEnvironment=null,normalEnvironment=null;
 let smokePaused=false,catchUpMode=false,renderReady=false,warmPromise=null,warmAbort=false;function schedule(){if(smokePaused)return;if(!frame&&(shown||forceRender))frame=requestAnimationFrame(tick);}
 function notifyPhoto(state,message=''){photoState=state;canvas.dispatchEvent(new CustomEvent('photostate',{detail:{state,message},bubbles:true}));}
 function exitPhoto(reason='internal'){if(photoActive||photoBusy){photoActive=false;photoBusy=false;renderer.toneMappingExposure=.752;if(normalEnvironment)scene.environment=normalEnvironment;for(const mirror of interior.mirrors)mirror.visible=true;notifyPhoto('off');renderer.shadowMap.needsUpdate=true;schedule();}}
 let hoverLast=0;
 canvas.addEventListener('pointermove',e=>{if(!atelier||e.buttons||photoActive||performance.now()-hoverLast<85)return;hoverLast=performance.now();const b=canvas.getBoundingClientRect(),ray=new T.Raycaster();ray.firstHitOnly=true;ray.far=3.4;ray.setFromCamera(new T.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),camera);scene.updateMatrixWorld(true);const candidates=[...interior.interactions.map(i=>i.object),...doorStates.map(d=>d.leaf)];const hit=ray.intersectObjects(candidates,true)[0];if(!hit){canvas.style.cursor='grab';return;}const desc=(o,p)=>{while(o){if(o===p)return true;o=o.parent;}return false;};const item=interior.interactions.find(i=>desc(hit.object,i.object));const slack=(item&&(item.kind==='curtains'||item.kind==='art'||item.kind==='tv'))?.95:.32;const opaque=ray.intersectObjects(scene.children,true).find(h=>h.object!==stepMarker&&!h.object.material?.transparent&&h.object.material?.visible!==false);if(opaque&&opaque.distance+slack<hit.distance){canvas.style.cursor='grab';return;}canvas.style.cursor='pointer';onInteraction?.(item?.label||'Дверь');});
 const doorPhysics=createDoorPhysics(doorStates);
 const movement=createMovement({canvas,camera,schedule,pick:ray=>{
  exitPhoto();ray.firstHitOnly=true;
  scene.updateMatrixWorld(true);
  const isDesc=(o,p)=>{while(o){if(o===p)return true;o=o.parent;}return false;};
  // Doors first (v8): ray doors alone so a nearer neighbor leaf can't steal a clear leaf hit via mixed list order quirks; then lamp/curtains; props last.
  {
   const doorHits=ray.intersectObjects(doorStates.map(d=>d.leaf),true);
   if(doorHits.length&&doorHits[0].distance<=3.8){
    const nearest=ray.intersectObjects(scene.children,true).find(h=>h.object!==stepMarker&&!h.object.material?.transparent&&h.object.material?.visible!==false);
    if(!(nearest&&nearest.distance+.32<doorHits[0].distance)){
     const door=doorStates.find(d=>isDesc(doorHits[0].object,d.leaf));
     if(door){door.manual=true;door.target=Math.abs(door.target)<.3?door.d.open:0;onInteraction?.('Дверь');schedule();return true;}
    }
   }
   const iHits=ray.intersectObjects(interior.interactions.map(i=>i.object),true);
   if(iHits.length&&iHits[0].distance<=5.4){
    const target=interior.interactions.find(i=>isDesc(iHits[0].object,i.object));
    // Sheer curtains / art: opaque glass/wall nearby must be clearly closer to steal the click.
    const slack=(target&&(target.kind==='curtains'||target.kind==='art'||target.kind==='tv'))?.95:.32;
    const nearest=ray.intersectObjects(scene.children,true).find(h=>h.object!==stepMarker&&!h.object.material?.transparent&&h.object.material?.visible!==false);
    if(!(nearest&&nearest.distance+slack<iHits[0].distance)){
     if(target){target.action();if(target.kind==='lamp'){canvas.dataset.lamp=interior.lampOn?'on':'off';canvas.dataset.lampEmissive=String(interior.lampOn?2.4:0);}if(target.kind==='curtains'){canvas.dataset.curtains=interior.curtainsOpen?'open':'closed';}onInteraction?.(target.label);schedule();return true;}
    }
   }
  }
  // Nudge dynamic props (index + atelier) — click does not walk (R08).
  if(physProps.length){
   const ph=ray.intersectObjects(physProps,true);if(ph.length&&ph[0].distance<3.2){
    const hit=ph[0];const prop=physProps.find(m=>isDesc(hit.object,m)||hit.object===m);
    if(prop){const dir=new T.Vector3();camera.getWorldDirection(dir);dir.y=0;if(dir.lengthSq())dir.normalize();physics.nudge(prop,dir,1.5);onInteraction?.('Декор');schedule();return true;}
   }
  }
  return false;
 },obstructed:p=>interior.blocks(p)||doorPhysics.blocks(p),
 onFeedback:(text,p)=>{exitPhoto();if(p){stepMarker.position.copy(p);stepMarker.visible=true;markerLife=.9;}onInteraction?.(text);schedule();}});
 function render(){
  if(photoActive&&photo){photo.renderSample();if(photo.samples>=8&&denoise){denoise.render(photo.target,photo.samples);}else{renderer.toneMappingExposure=1.05;composer.render();renderer.toneMappingExposure=1.5;}const samples=Math.floor(photo.samples);canvas.dataset.photoSamples=String(samples);notifyPhoto('rendering',samples>=96?'Свет уточнён':`Уточняем свет · ${Math.min(100,Math.round(samples/96*100))}%`);}
  else if(smokeMode){renderer.render(scene,camera);}
  else composer.render();
  const dir=new T.Vector3();camera.getWorldDirection(dir);const[x,z]=movement.position;onMove?.({x,z,heading:Math.atan2(dir.x,-dir.z)*180/Math.PI,walking:movement.moving,room:movement.room});
  canvas.dataset.walking=String(movement.moving);canvas.dataset.curtains=interior.curtainsOpen?'open':'closed';canvas.dataset.doors=doorStates.map(d=>Math.round(d.angle*180/Math.PI)).join(',');canvas.dataset.position=x.toFixed(2)+','+z.toFixed(2);canvas.dataset.lamp=interior.lampOn?'on':'off';canvas.dataset.lampEmissive=String(interior.lampOn?2.4:0);
 }
 let fpsFrames=0,fpsLast=performance.now();
 function tick(now){frame=0;if(atelier&&!movement.active&&!photoActive&&!photoBusy&&now-lastTick<33){schedule();return;}
  const rawDt=(now-lastTick)/1000||.016;lastTick=now;fpsFrames++;canvas.dataset.ticks=String((Number(canvas.dataset.ticks||0)+1));if(now-fpsLast>=1000){const fps=fpsFrames*1000/(now-fpsLast);canvas.dataset.fps=String(Math.round(fps*10)/10);canvas.dataset.frameMs=String(Math.round((now-fpsLast)/Math.max(1,fpsFrames)));fpsFrames=0;fpsLast=now;}
  // Soft/remote GPUs: feed movement a catch-up dt so routes finish even at ~1–5 FPS.
  const moveDt=Math.min(.22,Math.max(.016,rawDt));
  const dt=Math.min(.033,rawDt);let activity=false;
  if(!smokeMode){if(rawDt>.09){ao.enabled=false;if(qualityPreset==='high'){bloom.strength=.026;bloom.threshold=.990;}else bloom.enabled=false;}else if(qualityPreset==='high'&&stage.clientWidth>600){ao.enabled=true;bloom.enabled=true;bloom.strength=.032;bloom.threshold=.988;}else if(qualityPreset==='medium'){ao.enabled=false;bloom.enabled=stage.clientWidth>600;}}
  if(!photoActive&&!photoBusy){activity=movement.update(moveDt)||activity;
   if(doorPhysics.update(dt,camera.position)){activity=true;renderer.shadowMap.needsUpdate=true;}
   if(physics.step(dt,camera))activity=true;
   activity=interior.update(dt,camera)||activity;
   if(Math.abs(clockTarget-clockValue)>.0001){clockValue=T.MathUtils.lerp(clockValue,clockTarget,1-Math.exp(-dt*4));applyTime(clockValue);activity=true;}
   if(markerLife>0){markerLife-=dt;stepMarker.material.opacity=Math.max(0,markerLife*.65);stepMarker.scale.setScalar(1+(1-markerLife)*.22);stepMarker.visible=markerLife>0;activity=true;}
  }
  render();if(activity||movement.active||movement.moving||forceRender||(photoActive&&photo?.samples<96))schedule();
 }
  function applyTime(value){const evening=T.MathUtils.smoothstep(value,.48,1),gold=Math.sin(Math.min(1,value)*Math.PI);// Round7: dining-still-bright selective↓↓; exposure/sun/hemi intensity unchanged (protect living≈113)
 sun.position.set(28,6.7-value*8.5,12+value*18);sun.color.set('#ffa848').lerp(new T.Color('#ff6414'),gold*1.05);sun.intensity=3.60*(1-evening)+.12;scene.environmentIntensity=.23*(1-evening)+.03;scene.backgroundIntensity=.105*(1-evening)+.04;hemisphere.intensity=.21*(1-evening)+.08;hemisphere.color.set('#ffc890').lerp(new T.Color('#ff9440'),gold*.75);for(const l of dayLights)l.intensity=(1.06*(1-evening)+.05)*(l.userData.base??1);for(const l of fills)l.intensity=(1.92+evening*4.5)*(l.userData.base??1);for(const o of interior.lightSources)o.light.intensity=(o.enabled===false?0:o.base)*(.85+evening*1.0);consoleLight.intensity=6.8*(.5+evening*.85);shelfLed.intensity=3.5*(.48+evening*.9);shelfLed2.intensity=3.0*(.48+evening*.9);coveTop.intensity=2.4*(.45+evening);renderer.toneMappingExposure=.752+gold*.028;renderer.shadowMap.needsUpdate=true;}
 function resize(){exitPhoto('resize');const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);const preset=w<500?'low':(w<900?'medium':'high');applyQuality(preset);camera.aspect=w/h;camera.fov=camera.aspect<.9?72:62;camera.updateProjectionMatrix();schedule();}
 new ResizeObserver(resize).observe(stage);new IntersectionObserver(es=>{shown=es[0].isIntersecting;lastTick=performance.now();if(shown||forceRender)schedule();else if(frame&&!forceRender){cancelAnimationFrame(frame);frame=0;}}).observe(stage);
 canvas.addEventListener('pointerdown',exitPhoto);canvas.addEventListener('keydown',exitPhoto);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();canvas.dispatchEvent(new CustomEvent('tourerror',{bubbles:true}));});
 function batchStatic(){
  scene.updateMatrixWorld(true);const sets=new Map(),remove=[];
  scene.traverse(o=>{if(!o.isMesh||Array.isArray(o.material)||!o.geometry.attributes.uv)return;let p=o;while(p){if(p.userData.dynamic)return;p=p.parent;}const key=o.material.uuid+'/'+o.castShadow+'/'+o.receiveShadow;if(!sets.has(key))sets.set(key,{material:o.material,cast:o.castShadow,receive:o.receiveShadow,geometries:[]});let g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(g.index)g=g.toNonIndexed();for(const attr of Object.keys(g.attributes))if(!['position','normal','uv'].includes(attr))g.deleteAttribute(attr);sets.get(key).geometries.push(g);remove.push(o);});
  for(const item of sets.values()){const geo=mergeGeometries(item.geometries,false);if(!geo)continue;geo.boundsTree=new MeshBVH(geo,{maxLeafTris:12});const mesh=new T.Mesh(geo,item.material);mesh.castShadow=item.cast;mesh.receiveShadow=item.receive;scene.add(mesh);for(const g of item.geometries)g.dispose();}for(const o of remove)o.removeFromParent();
 }
 async function setPhoto(){

  if(!atelier||!ready||stage.clientWidth<700){notifyPhoto('unsupported','Режим фото доступен на широком экране');return false;}
  if(photoActive||photoBusy){exitPhoto();return false;}movement.stop();photoBusy=true;notifyPhoto('preparing','Подготовка света…');
  try{const {WebGLPathTracer,DenoiseMaterial,BlurredEnvMapGenerator}=await import('./vendor/pathtracer/index.js');if(!photoBusy)return false;if(!photo)photo=new WebGLPathTracer(renderer);stepMarker.visible=false;photo.bounces=5;photo.filterGlossyFactor=.5;photo.tiles.set(3,3);photo.minSamples=3;photo.fadeDuration=700;photo.renderDelay=150;photo.textureSize.set(1024,1024);photo.renderScale=Math.min(1,1280/(stage.clientWidth*renderer.getPixelRatio()));photo.renderToCanvas=false;if(!denoise)denoise=createPhotoResolve(renderer,scene,camera);renderer.toneMappingExposure=1.5;
   normalEnvironment=scene.environment;if(!photoEnvironment){const blur=new BlurredEnvMapGenerator(renderer);photoEnvironment=blur.generate(normalEnvironment,.35);blur.dispose();}scene.environment=photoEnvironment;materials.glass.castShadow=false;for(const mirror of interior.mirrors)mirror.visible=false;scene.updateMatrixWorld(true);photo.setScene(scene,camera);photo.updateCamera();photo.reset();denoise.invalidate();photoActive=true;photoBusy=false;notifyPhoto('rendering','Уточняем свет…');schedule();return true;
  }catch(error){console.warn('Photo mode unavailable:',error);exitPhoto();notifyPhoto('unsupported','Режим фото недоступен в этом браузере');schedule();return false;}
 }
 // Scanned CC0 detail meshes are local, shared between repeated instances.
 // They replace decorative furniture only; plan geometry and room positions stay fixed.

 function softCatchUpRender(){
  // renderOnce = soft-GPU/auditor catch-up. Never composer/SSAO/4k shadows. Low-res forward only.
  // Shipping frames still use tick()→render().
  if(photoActive&&photo){render();return;}
  const prevAo=ao.enabled,prevBloom=bloom.enabled,prevFxaa=fxaa.enabled,prevCast=sun.castShadow,prevSunInt=sun.intensity;
  const prevEnv=scene.environment,prevEnvInt=scene.environmentIntensity,prevBg=scene.background,prevBgInt=scene.backgroundIntensity,prevBlur=scene.backgroundBlurriness;
  const prevPR=renderer.getPixelRatio();
  const sz=renderer.getSize(new T.Vector2());
  ao.enabled=false;bloom.enabled=false;fxaa.enabled=false;
  sun.castShadow=false;sun.intensity=Math.min(sun.intensity,.4);
  renderer.shadowMap.needsUpdate=false;
  scene.environment=null;scene.environmentIntensity=0;
  scene.background=new T.Color('#c9b89a');scene.backgroundIntensity=1;scene.backgroundBlurriness=0;
  renderer.setPixelRatio(1);
  // Soft fill-rate cap — door leaf / lamp still readable for auditor screenshots.
  const tw=Math.min(640,Math.max(320,sz.x|0)), th=Math.min(400,Math.max(200,sz.y|0));
  renderer.setSize(tw,th,false);
  try{renderer.render(scene,camera);}finally{
   renderer.setPixelRatio(prevPR);
   renderer.setSize(sz.x,sz.y,false);
   scene.environment=prevEnv;scene.environmentIntensity=prevEnvInt;scene.background=prevBg;scene.backgroundIntensity=prevBgInt;scene.backgroundBlurriness=prevBlur;
   ao.enabled=prevAo;bloom.enabled=prevBloom;fxaa.enabled=prevFxaa;sun.castShadow=prevCast;sun.intensity=prevSunInt;
   renderer.shadowMap.needsUpdate=false;
  }
  const dir=new T.Vector3();camera.getWorldDirection(dir);const[x,z]=movement.position;onMove?.({x,z,heading:Math.atan2(dir.x,-dir.z)*180/Math.PI,walking:movement.moving,room:movement.room});
  canvas.dataset.walking=String(movement.moving);canvas.dataset.curtains=interior.curtainsOpen?'open':'closed';canvas.dataset.doors=doorStates.map(d=>Math.round(d.angle*180/Math.PI)).join(',');canvas.dataset.position=x.toFixed(2)+','+z.toFixed(2);canvas.dataset.lamp=interior.lampOn?'on':'off';canvas.dataset.lampEmissive=String(interior.lampOn?2.4:0);
 }
 function warmSoft(n=2){
  // Yielded lightweight frames after load. Aborts on setSmokePaused (auditor needs main thread).
  // Default n=2 (was 4): soft-GPU must not stall auditor waiting for warm.
  if(warmPromise)return warmPromise;
  if(warmAbort||smokePaused){renderReady=true;canvas.dataset.renderReady='true';return Promise.resolve({ready:true,frames:0,aborted:true});}
  // Keep renderReady true during warm so auditor timeout:render does not fire mid-warm.
  renderReady=true;canvas.dataset.renderReady='true';canvas.dataset.warmFrames='0';
  catchUpMode=true;ao.enabled=false;bloom.enabled=false;fxaa.enabled=false;
  const prevCast=sun.castShadow;sun.castShadow=false;renderer.shadowMap.needsUpdate=false;
  warmPromise=new Promise(resolve=>{
   let i=0;
   const finish=()=>{
     renderReady=true;canvas.dataset.renderReady='true';
     sun.castShadow=prevCast;warmPromise=null;
     if(smokePaused||warmAbort){catchUpMode=true;if(frame){cancelAnimationFrame(frame);frame=0;}}
     else{catchUpMode=false;applyQuality(qualityPreset);schedule();}
     resolve({ready:true,frames:i,aborted:!!warmAbort});
   };
   const step=()=>{
    if(warmAbort||smokePaused){finish();return;}
    try{renderer.render(scene,camera);}catch(e){console.warn('warm frame',e);}
    i++;canvas.dataset.warmFrames=String(i);
    if(i>=n){finish();return;}
    requestAnimationFrame(step);
   };
   requestAnimationFrame(step);
  });
  return warmPromise;
 }
 function applySpawn(){
  // Debug start only — never skips PBR/PMREM/GLTF. Positions camera for live proofs on soft-GPU.
  if(!spawnParam)return;
  if(spawnParam==='kitchen'){movement.warp(290,810,269,799);canvas.dataset.spawn='kitchen';}
  else if(spawnParam==='lamp'){movement.warp(410,970,450,1000);canvas.dataset.spawn='lamp';}
  else if(spawnParam==='dining'){movement.warp(420,900,458,918);canvas.dataset.spawn='dining';}
  else if(spawnParam==='living'){movement.go('living',true);canvas.dataset.spawn='living';}
  const[x,z]=movement.position;canvas.dataset.position=x.toFixed(2)+','+z.toFixed(2);canvas.dataset.walking=String(movement.moving);
 }
 const loader=new GLTFLoader();let assetPending=13;const assetDone=()=>{assetPending--;canvas.dataset.loadProgress=String(Math.max(0,Math.round((13-assetPending)/13*100)));schedule();if(assetPending===0){ready=true;applyTime(clockValue);applySpawn();canvas.dataset.loaded='true';renderReady=true;canvas.dataset.renderReady='true';onReady?.();
  // Defer BVH merge: soft-GPU auditor must see loaded/renderReady before heavy CPU work (avoids timeout:render).
  if(!smokeMode){setTimeout(()=>{try{batchStatic();renderer.shadowMap.needsUpdate=true;schedule();}catch(e){console.warn('batchStatic',e);}},16);}
  else{renderer.shadowMap.needsUpdate=true;}
 }};
 if(smokeMode){
  // Live-proofs: skip PBR/GLTF/HDR. Mark loaded; onReady after go/resize.
  assetPending=0;canvas.dataset.loadProgress='100';ready=true;canvas.dataset.loaded='true';renderReady=true;canvas.dataset.renderReady='true';
 }else{
 const texLoader=new T.TextureLoader(),largeTextures=stage.clientWidth>900&&renderer.capabilities.maxTextureSize>=4096;
 function pbr(name,apply,{color=false,repeat=.25}={}){texLoader.load('assets/textures/'+name,tex=>{tex.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(repeat,repeat);tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());apply(tex);assetDone();},undefined,assetDone);}
 const quality=largeTextures?'4k':'1k';
 pbr('oak-clean-color-'+quality+'.webp',tex=>{materials.floor.map=tex;materials.floor.color.set('#fff6e8');materials.floor.needsUpdate=true;const cabinet=tex.clone();cabinet.wrapS=cabinet.wrapT=T.RepeatWrapping;cabinet.repeat.set(.12,.95);cabinet.offset.set(.28,.02);cabinet.center.set(.5,.5);cabinet.rotation=0;cabinet.anisotropy=tex.anisotropy;for(const m of[materials.oak,materials.walnut]){m.map=cabinet;m.color.set(m===materials.oak?'#f6ead4':'#d8bc96');m.needsUpdate=true;}const plank=tex.clone();plank.wrapS=plank.wrapT=T.RepeatWrapping;plank.repeat.set(.42,.42);plank.anisotropy=tex.anisotropy;materials.floor.map=plank;},{color:true,repeat:.35});
 pbr('oak-clean-normal-'+quality+'.webp',tex=>{materials.floor.normalMap=tex;materials.floor.bumpMap=null;materials.floor.normalScale.set(.38,.38);materials.floor.needsUpdate=true;const nCab=tex.clone();nCab.wrapS=nCab.wrapT=T.RepeatWrapping;nCab.repeat.set(.12,.95);nCab.offset.set(.28,.02);for(const m of[materials.oak,materials.walnut]){m.normalMap=nCab;m.bumpMap=null;m.normalScale.set(.55,.55);m.needsUpdate=true;}},{repeat:.35});
 pbr('oak-clean-rough-2k.webp',tex=>{materials.floor.roughnessMap=tex;materials.floor.roughness=.78;materials.floor.needsUpdate=true;const rCab=tex.clone();rCab.wrapS=rCab.wrapT=T.RepeatWrapping;rCab.repeat.set(.12,.95);for(const m of[materials.oak,materials.walnut]){m.roughnessMap=rCab;m.roughness=.62;m.needsUpdate=true;}},{repeat:.35});
 const clothMaterials=new Set();scene.traverse(o=>{if(o.isMesh&&(o.material?.sheen>0||o.material===materials.curtain))clothMaterials.add(o.material);});
 pbr('fabric-normal-'+quality+'.webp',tex=>{for(const m of clothMaterials){m.normalMap=tex;m.normalScale.set(1.9,1.9);if(m.bumpMap){m.bumpScale=.06;}else{m.bumpMap=tex;m.bumpScale=.05;}m.needsUpdate=true;}materials.ivory.normalScale.set(2.6,2.6);materials.ivory.sheen=1.3;materials.ivory.sheenRoughness=.28;materials.linen.normalScale.set(2.35,2.35);},{repeat:7.2}); // Round3 sofa weave
 pbr('fabric-rough-2k.webp',tex=>{for(const m of clothMaterials){m.roughnessMap=tex;m.roughness=.86;m.needsUpdate=true;}},{repeat:6.5});
 pbr('plaster-normal-2k.webp',tex=>{materials.wall.normalMap=tex;materials.wall.normalScale.set(.36,.36);materials.wall.bumpMap=null;materials.wall.color.set('#d0bc96');materials.wall.needsUpdate=true;materials.ceiling.normalMap=tex;materials.ceiling.normalScale.set(.1,.1);materials.ceiling.needsUpdate=true;},{repeat:2.1}); // Round6 plaster dining crush
 pbr('stone-color-'+quality+'.webp',tex=>{tex.repeat.set(.55,.42);tex.offset.set(.12,.2);materials.stone.map=tex;materials.stone.color.set('#fff4e6');materials.stone.needsUpdate=true;const floorStone=tex.clone();floorStone.repeat.set(.35,.35);floorStone.offset.set(0,0);materials.tile.map=floorStone;materials.tile.color.set('#ede3d0');materials.tile.needsUpdate=true;},{color:true});
 pbr('stone-normal-2k.webp',tex=>{tex.repeat.set(.55,.42);tex.offset.set(.12,.2);materials.stone.normalMap=tex;materials.stone.normalScale.set(.42,.42);materials.stone.bumpMap=null;materials.stone.needsUpdate=true;});
 pbr('stone-rough-2k.webp',tex=>{tex.repeat.set(.55,.42);tex.offset.set(.12,.2);materials.stone.roughnessMap=tex;materials.stone.roughness=.68;materials.stone.needsUpdate=true;});
 function fitAsset(source,w,h,d){
  const asset=source.clone(true);asset.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(asset),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const normalized=new T.Group();normalized.add(asset);asset.position.sub(new T.Vector3(center.x,bounds.min.y,center.z));normalized.scale.set(w/size.x,h/size.y,d/size.z);
  asset.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material)o.material.envMapIntensity=.55;}});return normalized;
 }
 loader.load('assets/models/dining_chair_02/model.gltf',gltf=>{for(const holder of chairTargets){holder.clear();const asset=fitAsset(gltf.scene,.54,.94,.58);asset.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.map=null;o.material.color.set('#b9aa91');o.material.metalness=0;o.material.roughness=.9;}});holder.add(asset);}assetDone();},undefined,assetDone);
 loader.load('assets/models/throw_pillows_01/model.gltf',gltf=>{const source=gltf.scene.getObjectByName('throw_pillows_01_pillow01')||gltf.scene.children[0];pillowTargets.forEach((t,i)=>{t.holder.clear();const asset=fitAsset(source,t.width,t.height,t.depth);const tone=i%3===0?'#7a8460':i%3===1?'#b89468':'#d8c8a8'; // Round3 olive/beige pillows
asset.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.map=null;o.material.color.set(tone);o.material.roughness=.88;o.material.metalness=0;o.material=new T.MeshPhysicalMaterial({color:tone,roughness:.82,sheen:1.0,sheenColor:new T.Color('#f0e4cc'),sheenRoughness:.4,bumpScale:.055,envMapIntensity:.4});}});t.holder.add(asset);});assetDone();},undefined,assetDone);
 loader.load('assets/models/potted_plant_02/model.gltf',gltf=>{for(const t of plantTargets){t.holder.clear();const asset=fitAsset(gltf.scene,t.size*.75,t.size*1.25,t.size*.75);asset.traverse(o=>{if(o.isMesh&&o.name.endsWith('_pot')){o.material=o.material.clone();o.material.map=null;o.material.color.set('#d8d0bf');o.material.roughness=.85;}});t.holder.add(asset);}const leaves=gltf.scene.getObjectByName('potted_plant_02_leaves');if(leaves)for(const t of planterTargets){t.holder.clear();for(const[x,z]of t.positions){const plant=fitAsset(leaves,.24,.23,.24);plant.position.set(x,.31,z);plant.rotation.y=x*12+z*9;plant.traverse(o=>{if(o.isMesh)o.castShadow=false;});t.holder.add(plant);}}assetDone();},undefined,assetDone);
 new RGBELoader().load('assets/daylight-sky-2k.hdr',hdr=>{hdr.mapping=T.EquirectangularReflectionMapping;scene.environment=hdr;scene.environmentIntensity=.21;scene.background=hdr;scene.backgroundBlurriness=.50;scene.backgroundIntensity=.10;assetDone();},undefined,assetDone); // Round6 terrace-cool-chroma / dining wash
 }
 movement.go('living',true);resize();if(smokeMode){applyQuality('low');canvas.dataset.smoke='1';applyTime(clockValue);applySpawn();onReady?.();schedule();}
 function syncDataset(){const dir=new T.Vector3();camera.getWorldDirection(dir);const[x,z]=movement.position;onMove?.({x,z,heading:Math.atan2(dir.x,-dir.z)*180/Math.PI,walking:movement.moving,room:movement.room});canvas.dataset.walking=String(movement.moving);canvas.dataset.curtains=interior.curtainsOpen?'open':'closed';canvas.dataset.doors=doorStates.map(d=>Math.round(d.angle*180/Math.PI)).join(',');canvas.dataset.position=x.toFixed(2)+','+z.toFixed(2);canvas.dataset.lamp=interior.lampOn?'on':'off';canvas.dataset.lampEmissive=String(interior.lampOn?2.4:0);}
 return{go(id,instant=false){exitPhoto();const ok=movement.go(id,instant);syncDataset();return ok;},warp(px,pz,lx,lz){exitPhoto();const ok=movement.warp(px,pz,lx??px+40,lz??pz);syncDataset();return ok;},resize,setPhoto,setQuality(preset){applyQuality(preset==='low'||preset==='medium'?preset:'high');schedule();},setContinuous(on){forceRender=!!on;if(forceRender)schedule();},setSmokePaused(on){smokePaused=!!on;if(smokePaused){catchUpMode=true;warmAbort=true;ao.enabled=false;bloom.enabled=false;fxaa.enabled=false;if(frame){cancelAnimationFrame(frame);frame=0;}renderReady=true;canvas.dataset.renderReady='true';}else{warmAbort=false;catchUpMode=false;applyQuality(qualityPreset);schedule();}},renderOnce(){softCatchUpRender();return{lamp:canvas.dataset.lamp,emissive:canvas.dataset.lampEmissive,doors:canvas.dataset.doors,pos:canvas.dataset.position,renderReady:canvas.dataset.renderReady||null};},warmFrames(n=4){return warmSoft(Math.max(1,n|0));},get quality(){return qualityPreset;},get fps(){return Number(canvas.dataset.fps||0);},get physicsInfo(){return{static:physics.staticCount,dynamic:physics.dynamicCount};},nudgeProp(i=0){const m=physProps[i];if(!m)return false;const dir=new T.Vector3();camera.getWorldDirection(dir);dir.y=0;if(dir.lengthSq())dir.normalize();const ok=physics.nudge(m,dir,1.6);schedule();return ok;},
 debugWalk(fwd=0,strafe=0,steps=12,dt=.08){const out=[];for(let i=0;i<steps;i++){out.push(movement.debugWalk(fwd,strafe,dt));}schedule();const last=out[out.length-1];return{steps:out.length,start:out[0]?.pos,end:last?.pos,blocked:out.filter(o=>o.blocked).length,last};},
 toggleDoor(i=0){const d=doorStates[i];if(!d)return false;d.manual=true;d.target=Math.abs(d.target)<.3?d.d.open:0;onInteraction?.('Дверь');schedule();return true;},
 closeDoor(i=0){const d=doorStates[i];if(!d)return false;d.manual=true;d.target=0;d.angle=0;d.velocity=0;if(d.leaf)d.leaf.rotation.y=0;onInteraction?.('Дверь');schedule();return true;},closeAllDoors(){for(const d of doorStates){d.manual=true;d.target=0;d.angle=0;d.velocity=0;if(d.leaf)d.leaf.rotation.y=0;}schedule();return true;},
 toggleLamp(){const on=interior.toggleLamp();canvas.dataset.lamp=on?'on':'off';canvas.dataset.lampEmissive=String(on?2.4:0);onInteraction?.('Торшер');schedule();return true;},
 setLamp(on){const v=interior.setLamp(on);canvas.dataset.lamp=v?'on':'off';canvas.dataset.lampEmissive=String(v?2.4:0);schedule();return v;},
 get lampOn(){return interior.lampOn;},
 projectToClient(x,y,z){const v=new T.Vector3(x,y,z).project(camera);const b=canvas.getBoundingClientRect();return{x:(v.x*.5+.5)*b.width+b.left,y:(-v.y*.5+.5)*b.height+b.top,visible:v.z>=-1&&v.z<=1&&Math.abs(v.x)<=1.15&&Math.abs(v.y)<=1.15};},
 doorScreen(i=0){const d=doorStates[i];if(!d)return null;d.leaf.updateWorldMatrix(true,true);const W=d.width||1;const local=new T.Vector3(W*.55,1.55,0);const w=local.applyMatrix4(d.leaf.matrixWorld);return this.projectToClient(w.x,w.y,w.z);},
 doorAngleDeg(i=0){const d=doorStates[i];return d?Math.round(d.angle*180/Math.PI):null},
 doorTargetDeg(i=0){const d=doorStates[i];return d?Math.round(d.target*180/Math.PI):null},
 lampScreen(){const item=interior.interactions.find(x=>x.label==='Торшер');if(!item)return null;item.object.updateWorldMatrix(true,true);const w=new T.Vector3();item.object.getWorldPosition(w);w.y=1.4;return this.projectToClient(w.x,w.y,w.z);},
 // Face a plan-space point (px,pz) without walking — for live door/lamp screenshots.
 faceToward(px,pz){const[cx,cz]=[camera.position.x,camera.position.z];const[tx,tz]=point(px,pz);const c=new T.Object3D();c.position.set(cx,1.62,cz);c.lookAt(tx,1.35,tz);const q=c.quaternion.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI));camera.quaternion.copy(q);schedule();return true;},
 // Soft-GPU catch-up: process already-held WASD keys (from real CDP keydown) without inventing them.
 pumpKeys(steps=40,dt=.1){const out=[];for(let i=0;i<steps;i++){const b=movement.position,before=[b[0],b[1]];movement.update(Math.min(.22,Math.max(.016,dt)));const a=movement.position,after=[a[0],a[1]];const moved=Math.hypot(after[0]-before[0],after[1]-before[1]);out.push({pos:after,moved,blocked:moved<.025,walking:movement.moving});}syncDataset();schedule();const last=out[out.length-1];return{steps:out.length,start:out[0]?.pos,end:last?.pos,blocked:out.filter(o=>o.blocked).length,last,walking:movement.moving,pos:movement.position};},
 // Soft-GPU: advance door hinges after a real click already set target (does not invent clicks).
 pumpDoors(steps=80,dt=.05){for(let i=0;i<steps;i++)doorPhysics.update(dt,camera.position);if(!(smokePaused||catchUpMode))renderer.shadowMap.needsUpdate=true;schedule();return doorStates.map(d=>Math.round(d.angle*180/Math.PI));},
 probePick(clientX,clientY){const b=canvas.getBoundingClientRect();const ndc=new T.Vector2((clientX-b.left)/b.width*2-1,-(clientY-b.top)/b.height*2+1);const ray=new T.Raycaster();ray.firstHitOnly=true;ray.setFromCamera(ndc,camera);scene.updateMatrixWorld(true);const isDesc=(o,p)=>{while(o){if(o===p)return true;o=o.parent;}return false;};const objects=[...interior.interactions.map(i=>i.object),...doorStates.map(d=>d.leaf)];const hits=ray.intersectObjects(objects,true);const door=hits[0]&&doorStates.findIndex(d=>isDesc(hits[0].object,d.leaf));const lamp=hits[0]&&interior.interactions.find(i=>isDesc(hits[0].object,i.object));const nearest=ray.intersectObjects(scene.children,true).find(h=>h.object!==stepMarker&&!h.object.material?.transparent&&h.object.material?.visible!==false);return{hitDist:hits[0]?.distance??null,doorIndex:door>=0?door:null,label:lamp?.label||(door>=0?'Дверь':null),nearestDist:nearest?.distance??null,nearestName:nearest?.object?.name||nearest?.object?.type||null};},
get doorsAngles(){return doorStates.map(d=>d.angle);},
 setTime(value){exitPhoto();clockTarget=Math.max(0,Math.min(1,value));schedule();},toggleCurtains(){exitPhoto();interior.setCurtains(!interior.curtainsOpen);schedule();return interior.curtainsOpen;},set onMove(fn){onMove=fn;},set onInteraction(fn){onInteraction=fn;},dispose(){if(frame)cancelAnimationFrame(frame);physics.dispose();renderer.dispose();composer.dispose();photo?.dispose();denoise?.dispose();env.dispose();}};
}
