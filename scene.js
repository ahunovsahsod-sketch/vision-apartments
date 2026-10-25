import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {attachDynamicProbes} from './dynamic-probes.js?v=20261025-gesture12';
import {createOliveTree} from './olive-tree.js?v=20261025-gesture12';
import {chooseQuality} from './quality.js?v=20261025-gesture13';
import {loadPremiumMaterials,metricUV} from './premium-materials.js?v=20261025-gesture12';
import {loadBakedLighting} from './baked-lighting.js?v=20261025-gesture12';
import {prepareBakeExport} from './bake-export.js?v=20261025-gesture12';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {CEILING,PX_PER_METRE,ROOMS,roomById,inside,point,toPlan,WALLS,DOORS,doorSegment,segmentDistance,WALL_THICKNESS} from './plan.js?v=20261025-gesture12';
import {createMovement} from './movement.js?v=20261025-gesture12';
import {createDoorPhysics} from './door-physics.js?v=20261025-gesture12';
import {furnish} from './interior.js?v=20261025-gesture12';
import {MeshBVH,acceleratedRaycast} from './vendor/bvh/index.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// All architecture is generated from the same traced plan used by the map.
// No image or pre-rendered film stands in for the interactive apartment.
export function createApartment(canvas,onReady,{atelier=false,quality:requestedQuality=null}={}){
 const quality=requestedQuality||chooseQuality(),meshQuality=new URLSearchParams(location.search).get('mesh')==='full'?'high':'low';let fpsWindow=[],lastFrameStamp=0;
 T.Mesh.prototype.raycast=acceleratedRaycast;
 const stage=canvas.parentElement,scene=new T.Scene();scene.background=new T.Color('#d9e2e6');
 const renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
 RectAreaLightUniformsLib.init();
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,quality.dpr,quality.maxPixels/Math.max(stage.clientWidth,stage.clientHeight)));renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 const camera=new T.PerspectiveCamera(42,1,.055,160);
 const pmrem=new T.PMREMGenerator(renderer),environment=new RoomEnvironment();
 const env=pmrem.fromScene(environment,.04);scene.environment=env.texture;scene.environmentIntensity=.38;environment.dispose();pmrem.dispose();
 const hemisphere=new T.HemisphereLight('#eaf1f7','#b79b77',.38);scene.add(hemisphere);
 const sun=new T.DirectionalLight('#fff2d9',3.3);sun.position.set(24,12,-7);sun.castShadow=true;
 sun.shadow.mapSize.set(quality.shadow,quality.shadow);Object.assign(sun.shadow.camera,{left:-13,right:13,top:13,bottom:-13,near:1,far:65});sun.shadow.normalBias=.025;sun.shadow.bias=-.00008;sun.shadow.radius=quality.id==='high'?4:2;scene.add(sun);
 const walls=new T.Group(),ceilings=new T.Group();scene.add(walls,ceilings);ceilings.visible=true;
 const roundCache=new Map(),boxCache=new Map(),floors=[],chairTargets=[],pillowTargets=[],plantTargets=[],planterTargets=[],bedGroups=[],doorStates=[],physicalTargets=[],probeTargets=[];
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
 const standard=(color,roughness=.7,extra={})=>new T.MeshStandardMaterial({color,roughness,...extra});
 const fabric=color=>new T.MeshPhysicalMaterial({color,roughness:.98,specularIntensity:.18,sheen:.4,sheenColor:new T.Color(color),sheenRoughness:.8,bumpMap:clothTex,bumpScale:.022});
 const materials={
  wall:standard('#dcd0b9',.92,{bumpMap:stoneTex,bumpScale:.006}),ceiling:standard('#ebe2d0',.95,{side:T.DoubleSide}),
  oak:standard('#d7cbb4',.68,{map:woodTex,bumpMap:woodTex,bumpScale:.008}),walnut:standard('#ae9575',.64,{map:woodTex,bumpMap:woodTex,bumpScale:.008}),
  floor:standard('#f2e0bf',.72,{map:woodTex,bumpMap:woodTex,bumpScale:.009}),stone:standard('#d9d5c9',.68,{map:stoneTex,bumpMap:stoneTex,bumpScale:.015}),
  tile:standard('#f1eee4',.48,{map:tileTex,bumpMap:tileTex,bumpScale:.008}),terrace:standard('#ded9cb',.85,{map:tileTex,bumpMap:tileTex,bumpScale:.018}),
  linen:fabric('#c7b89e'),ivory:fabric('#d8cab2'),moss:fabric('#8c8d71'),blue:fabric('#c6b99e'),rose:fabric('#c6b99e'),
  metal:standard('#191b18',.52,{metalness:.8}),brass:standard('#a39772',.28,{metalness:.8}),black:new T.MeshPhysicalMaterial({color:'#10110f',roughness:.48,specularIntensity:.08,envMapIntensity:.05}),
  porcelain:new T.MeshPhysicalMaterial({color:'#f2efe8',roughness:.19,clearcoat:1,clearcoatRoughness:.12}),
  glass:new T.MeshPhysicalMaterial({color:'#edf3f1',roughness:.06,transparent:true,opacity:.075,metalness:0,clearcoat:1,depthWrite:false}),
  leaf:standard('#566a42',.76,{side:T.DoubleSide}),leaf2:standard('#7b8455',.86,{side:T.DoubleSide}),soil:standard('#544839',.98),rug:fabric('#b9b09c')
 };
 materials.glass.ior=1.5;materials.glass.specularIntensity=1;materials.glass.envMapIntensity=.85; // Thin architectural glass: alpha + environment reflections avoid a second full scene pass.
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
  doorStates.push({d,leaf,angle:d.open,velocity:0,target:d.open,manual:false,point:new T.Vector3(x,0,z)});
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
  const g=group(px,pz),c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#8e7c5c';ctx.fillRect(0,0,512,512);
  for(let y=0;y<512;y+=16)for(let x=0;x<512;x+=16){const offset=(y/16)%2?8:0;ctx.strokeStyle='#6e5b3e';ctx.lineWidth=6;ctx.beginPath();ctx.ellipse(x+offset+8,y+8,4.5,7.5,.38,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#d9c7a6';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(x+offset+8,y+6,4.2,6,.38,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#eadbc3';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x+offset+7,y+2);ctx.lineTo(x+offset+10,y+8);ctx.stroke();}
  const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(w*1.8,d*1.8);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;const material=standard('#eee0c8',.98,{map:tex,bumpMap:tex,bumpScale:.006});material.name='rug_'+px+'_'+pz;material.userData.rug=true;
  box(w,.016,d,material,0,.014,0,g,.008);for(let i=0;i<Math.floor(w/.024);i++){box(.007,.006,.045,materials.linen,-w/2+i*.024,.015,d/2,g);box(.007,.006,.045,materials.linen,-w/2+i*.024,.015,-d/2,g);}return g;
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
  for(const x of[-width*.25,width*.25]){const holder=new T.Group();holder.position.set(x,.68,-.68);holder.rotation.y=x*.05;g.add(holder);box(width*.43,.19,.53,materials.ivory,0,.095,0,holder,true);holder.userData.dynamic=true;pillowTargets.push({holder,width:width*.43,height:.22,depth:.53});}
  const throwGeo=new T.PlaneGeometry(width+.18,.52,48,28),tp=throwGeo.attributes.position;
  for(let i=0;i<tp.count;i++){const x=tp.getX(i),z=tp.getY(i);tp.setXYZ(i,x,.755+.005*Math.sin(x*27+z*21)-Math.max(0,Math.abs(x)-width*.46)*.7,.72+z);}
  throwGeo.computeVertexNormals();const throwMat=materials.linen.clone();throwMat.side=T.DoubleSide;const folded=new T.Mesh(throwGeo,throwMat);folded.castShadow=folded.receiveShadow=true;g.add(folded);
  for(const x of[-width/2-.38,width/2+.38]){box(.5,.46,.48,materials.walnut,x,.25,-.76,g,true);box(.51,.035,.49,materials.stone,x,.5,-.76,g,true);}
 }
 rug(246,196,2.52,2.8,'#b7ae98');bed(248,195,materials.ivory,1.8);
 rug(403,194,2.6,2.85,'#bdae93');bed(403,195,materials.rose,1.9);
 rug(414,495,2.4,2.8,'#b7ae98');bed(414,495,materials.blue,1.65);
 function chair(px,pz,rot=0,material=materials.moss){
  const g=group(px,pz,rot);g.userData.dynamic=true;physicalTargets.push({object:g,options:{label:'Стул',mass:6,friction:.65,restitution:.035}});box(.53,.13,.54,material,0,.49,0,g,true);const b=box(.55,.49,.12,material,0,.79,-.23,g,true);b.rotation.x=-.08;
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
  for(let i=0;i<p.count;i++){const nx=p.getX(i),ny=p.getY(i),nz=p.getZ(i);let xx=sp(nx,.42)*w/2,yy=sp(ny,.4)*h/2,zz=sp(nz,.43)*d/2;const wrinkle=(Math.sin(xx*35+zz*8)+Math.sin(zz*43-xx*5))*.0016*Math.max(0,ny);p.setXYZ(i,xx,yy+wrinkle,zz);}
  geo.computeVertexNormals();const mesh=new T.Mesh(geo,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 box(2.8,.12,.78,materials.metal,0,.13,0,livingSofa);
 upholstered(3,.34,.98,materials.ivory,0,.32,0,livingSofa);
 for(const x of[-.94,0,.94]){upholstered(.97,.2,.82,materials.ivory,x,.55,.035,livingSofa);const back=upholstered(.98,.54,.21,materials.ivory,x,.82,-.35,livingSofa);back.rotation.x=-.12;}
 for(const x of[-1.39,1.39])upholstered(.24,.45,.93,materials.ivory,x,.62,.015,livingSofa);
 for(const x of[-.91,.89]){const holder=new T.Group();holder.position.set(x,.67,-.17);holder.rotation.x=-.17;holder.rotation.y=x*.14;livingSofa.add(holder);holder.userData.dynamic=true;pillowTargets.push({holder,width:.56,height:.44,depth:.16});}
 const coffeeTable=group(364,944);const top=cylinder(.69,.69,.065,materials.stone,0,.39,0,coffeeTable);top.scale.z=1;const base=cylinder(.27,.31,.35,materials.stone,0,.18,0,coffeeTable);base.scale.z=1;
 
 const media=group(385,865);box(4.18,3.16,.035,materials.oak,0,1.72,-.015,media);box(3.75,.03,.34,materials.oak,0,.515,.13,media,.003);box(3.75,.03,.34,materials.oak,0,.265,.13,media,.003);box(3.75,.25,.025,materials.oak,0,.39,-.025,media,.003);for(const x of[-1.865,1.865])box(.025,.25,.34,materials.oak,x,.39,.13,media,.003);for(const x of[-1.21,1.21]){const front=box(1.31,.23,.025,materials.oak,x,.39,.29,media,.003);front.userData.dynamic=true;probeTargets.push(front);}box(1.65,.96,.028,materials.black,0,1.65,.028,media,.004);box(3.65,.012,.018,new T.MeshBasicMaterial({color:'#ffe5b6'}),0,.249,.25,media);for(let i=1;i<5;i++)box(.006,.24,.004,materials.walnut,-1.875+i*.75,.39,.303,media);
 const consoleLight=new T.RectAreaLight('#ffe6bc',4.5,3.6,.08);consoleLight.position.set(0,.205,.15);consoleLight.rotation.x=-Math.PI/2;media.add(consoleLight);
 for(let i=0;i<10;i++)box(.025,3.1,.016,materials.walnut,-1.91+i*.085,1.72,.014,media);
 // A restrained plaster artwork completes the contemporary wall above the sofa.
 const artCanvas=document.createElement('canvas');artCanvas.width=artCanvas.height=1024;const artContext=artCanvas.getContext('2d');artContext.fillStyle='#d6c9af';artContext.fillRect(0,0,1024,1024);
 for(let i=0;i<50000;i++){artContext.fillStyle=i%2?'#8d7c5312':'#fff8de20';artContext.fillRect(rnd()*1024,rnd()*1024,rnd()*2+.4,rnd()*2+.4);}artContext.strokeStyle='#b9a98a';artContext.lineWidth=12;artContext.beginPath();artContext.ellipse(540,520,260,365,-.3,0,Math.PI*1.8);artContext.stroke();artContext.strokeStyle='#dcd2bd';artContext.lineWidth=8;artContext.beginPath();artContext.ellipse(490,500,250,355,-.3,0,Math.PI*1.8);artContext.stroke();
 const artTexture=new T.CanvasTexture(artCanvas);artTexture.colorSpace=T.SRGBColorSpace;const art=group(363,1008);box(1.58,1.0,.035,materials.walnut,0,1.98,0,art,.004);box(1.545,.965,.008,standard('#ffffff',.96,{map:artTexture,bumpMap:artTexture,bumpScale:.003}),0,1.98,-.025,art);
 // Office: desk, task chair, storage, shelves and a small computer.
 const desk=group(94,935);box(2.25,.065,.86,materials.oak,0,.77,0,desk,true);for(const x of[-.97,.97])box(.06,.72,.66,materials.metal,x,.39,0,desk);
 box(.72,.43,.035,materials.black,0,1.08,-.15,desk,true);box(.07,.2,.08,materials.metal,0,.86,-.15,desk);box(.55,.018,.18,materials.black,0,.815,.17,desk,true);
 const officeChair=chair(94,981,0,materials.linen);chairTargets.splice(chairTargets.indexOf(officeChair),1);box(.04,.22,.04,materials.metal,0,.23,0,officeChair);for(let i=0;i<5;i++){const spoke=box(.42,.025,.025,materials.metal,.08,.08,0,officeChair);spoke.rotation.y=i*Math.PI*2/5;}
 const shelving=group(64,830);shelving.userData.dynamic=true;box(1.55,.5,.32,materials.walnut,0,.25,0,shelving,true);for(let k=0;k<3;k++)box(1.42,.045,.24,materials.oak,0,1.35+k*.44,0,shelving);for(let i=0;i<9;i++)box(.045,.25+rnd()*.1,.17,i%3?materials.moss:materials.linen,-.6+i*.14,1.51,.01,shelving);
 // Kitchen worktop follows the north wall, with the dining table in its original zone.
 const kitchen=group(385,738);box(4.15,.84,.025,materials.oak,0,.46,.303,kitchen,.004);box(4.15,.04,.62,materials.oak,0,.12,0,kitchen);for(const x of[-2.065,2.065])box(.025,.84,.62,materials.oak,x,.46,0,kitchen);
 const counterShape=new T.Shape();counterShape.moveTo(-2.105,-.335);counterShape.lineTo(2.105,-.335);counterShape.lineTo(2.105,.335);counterShape.lineTo(-2.105,.335);counterShape.closePath();const hole=new T.Path();hole.moveTo(-1.715,-.22);hole.lineTo(-1.715,.22);hole.lineTo(-1.005,.22);hole.lineTo(-1.005,-.22);hole.closePath();counterShape.holes.push(hole);const counter=new T.Mesh(new T.ExtrudeGeometry(counterShape,{depth:.04,bevelEnabled:false}),materials.stone);const counterUV=counter.geometry.attributes.uv,cp=counter.geometry.attributes.position;for(let i=0;i<counterUV.count;i++)counterUV.setXY(i,cp.getX(i)/4.21+.5,cp.getY(i)/.67+.5);counter.rotation.x=-Math.PI/2;counter.position.y=.885;counter.castShadow=counter.receiveShadow=true;kitchen.add(counter);
 for(let i=0;i<7;i++)box(.009,.75,.012,materials.walnut,-1.8+i*.6,.49,.318,kitchen);
 box(4.15,.58,.035,materials.stone,0,1.22,-.29,kitchen);box(4.15,.82,.025,materials.oak,0,2.07,-.285,kitchen);for(let i=0;i<7;i++){box(.583,.82,.35,materials.oak,-1.779+i*.593,2.07,-.12,kitchen,.004);box(.583,.76,.42,materials.wall,-1.779+i*.593,2.89,-.085,kitchen,.004);}box(4.05,.015,.018,new T.MeshBasicMaterial({color:'#ffe2aa'}),0,1.65,.08,kitchen);
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
  const g=group(px,pz);g.userData.dynamic=true;physicalTargets.push({object:g,options:{label:'Растение',mass:12,shape:'cylinder',friction:.8,restitution:.025,collisionSize:[size*.5,size*.5,size*.5],collisionCenter:[0,size*.25,0]}});cylinder(size*.22,size*.17,size*.42,pot,0,size*.21,0,g);cylinder(size*.2,size*.2,.02,materials.soil,0,size*.42,0,g);
  for(let i=0;i<11;i++){const a=i*2.4,len=size*(.45+rnd()*.5),x=Math.cos(a)*size*.3,z=Math.sin(a)*size*.3,y=size*.5+len*.55;
   tube([[0,size*.39,0],[x*.45,y*.8,z*.45],[x,y,z]],.006,materials.leaf,g);const leaf=sphere(size*.18,size*.025,len*.36,i%2?materials.leaf:materials.leaf2,x,y,z,g);leaf.rotation.set(.3,a,.2);
  }plantTargets.push({holder:g,size});return g;
 }
 for(const [x,z,s]of[[315,67,.65],[473,51,.62],[471,596,.7],[52,975,.7],[477,890,.75],[477,980,.66]])plant(x,z,s);
 // Original terrace planters and the unlabelled rectangular element are retained.
 for(const [px,pz,w,d]of[[564,744,1.18,.23],[699,744,1.18,.23],[564,988,1.18,.23],[699,988,1.18,.23],[758,807,.23,1.65],[758,965,.23,1.1]]){
  const g=group(px,pz);box(w,.3,d,materials.stone,0,.15,0,g,.006);box(w-.04,.02,d-.04,materials.soil,0,.31,0,g);const foliage=new T.Group();g.add(foliage);const count=Math.ceil(Math.max(w,d)/.18),positions=[];for(let i=0;i<count;i++){const x=w>d?i*.18-w/2+.09:0,z=d>w?i*.18-d/2+.09:0;sphere(.11,.14,.11,materials.leaf,x,.4,z,foliage);positions.push([x,z]);}planterTargets.push({holder:foliage,positions});
 }
 const service=group(733,892);box(1.92,.12,.92,materials.stone,0,.06,0,service);box(1.7,.018,.7,materials.metal,0,.13,0,service);
 // Contemporary loose furniture sits in the terrace's open area, away from doors.
 const outdoor=group(612,965);box(2.4,.24,.8,materials.walnut,0,.24,0,outdoor,true);box(2.25,.15,.7,materials.ivory,0,.44,0,outdoor,true);box(2.4,.45,.16,materials.linen,0,.63,.34,outdoor,true);for(const x of[-.75,0,.75])box(.65,.32,.12,materials.moss,x,.7,.18,outdoor,true);
 chair(561,885,Math.PI,materials.linen);chair(649,885,Math.PI,materials.linen);const coffee=group(608,910);cylinder(.4,.42,.06,materials.stone,0,.43,0,coffee);cylinder(.1,.15,.4,materials.walnut,0,.2,0,coffee);plant(525,956,1.2);plant(713,964,1.2);
 // Light fittings give the confirmed 3.40 m ceiling a visible reference scale.
 for(const [px,pz]of[[264,115],[416,93],[421,560],[317,449],[316,655],[384,785],[336,889],[103,871]]){
  const [x,z]=point(px,pz);cylinder(.055,.055,.015,materials.metal,x,3.386,z,ceilings);cylinder(.035,.035,.006,new T.MeshBasicMaterial({color:'#fff0ca'}),x,3.374,z,ceilings);
 }
 for(const [px,pz,len]of[[366,892,2.8],[384,785,2.0],[317,532,3.0]]){const[x,z]=point(px,pz);box(len,.018,.045,materials.metal,x,3.375,z,ceilings);box(len-.03,.005,.018,new T.MeshBasicMaterial({color:'#fff0cf'}),x,3.362,z,ceilings);}
 // Daylight enters through the actual perimeter openings; local fills stay restrained.
 const dayLights=[];
 for(const [px,pz,width,rotation]of[[493,150,2.7,Math.PI/2],[493,490,2.2,Math.PI/2],[492,923,.85,Math.PI/2],[492,779,.85,Math.PI/2],[260,25,2.5,Math.PI]]){
  const[x,z]=point(px,pz),light=new T.RectAreaLight('#f0eadc',2.8,width,2.5);light.position.set(x,1.9,z);light.rotation.y=rotation;scene.add(light);dayLights.push(light);
 }
 const fills=[];for(const[px,pz]of[[270,120],[420,170],[420,522],[325,532],[100,925],[363,932],[382,784]]){const[x,z]=point(px,pz),light=new T.PointLight('#ffe9c6',5,4.6,2);light.position.set(x,3.12,z);scene.add(light);fills.push(light);}
 const interior=furnish({scene,materials,group,box,cylinder,tube,fabric,plant,pillowTargets,bedGroups,doors:doorStates,renderer,atelier:true});
 for(const c of interior.curtains)c.group.userData.dynamic=true;
 for(const i of interior.interactions)i.object.userData.dynamic=true;
 const stepMarker=new T.Mesh(new T.RingGeometry(.095,.12,48),new T.MeshBasicMaterial({color:'#f8e8c6',transparent:true,opacity:.65,depthWrite:false}));stepMarker.rotation.x=-Math.PI/2;stepMarker.userData.dynamic=true;stepMarker.visible=false;scene.add(stepMarker);
 let markerLife=0,clockValue=.27,clockTarget=.27;
 const composer=new EffectComposer(renderer),renderPass=new RenderPass(scene,camera);composer.addPass(renderPass);
 const ao=new SSAOPass(scene,camera,640,480,16);ao.kernelRadius=.33;ao.minDistance=.002;ao.maxDistance=.08;composer.addPass(ao);const bloom=new UnrealBloomPass(new T.Vector2(640,480),.13,.45,1.25);bloom.enabled=quality.bloom;composer.addPass(bloom);composer.addPass(new OutputPass());const fxaa=new ShaderPass(FXAAShader);composer.addPass(fxaa);
 const bakedGroup=new T.Group();bakedGroup.name="Baked static architecture";scene.add(bakedGroup);let bakeMaterials=new Map(),bakedController=null,dynamicProbes=null,physics=null,physicsReady=false,assetsFinished=false,finalising=false,lastShadowUpdate=0;
 let frame=0,shown=true,onMove=null,onInteraction=null,lastTick=0,ready=false,photo=null,photoActive=false,photoBusy=false,photoState='off';
 function schedule(){if(!frame&&shown)frame=requestAnimationFrame(tick);}
 function notifyPhoto(state,message=''){photoState=state;canvas.dispatchEvent(new CustomEvent('photostate',{detail:{state,message},bubbles:true}));}
 function restorePhotoResolution(){const w=stage.clientWidth,h=stage.clientHeight,pr=renderer.getPixelRatio();composer.setPixelRatio(pr);composer.setSize(w,h);ao.setSize(Math.min(w*quality.aoScale,1280),Math.min(h*quality.aoScale,900));fxaa.material.uniforms.resolution.value.set(1/(w*pr),1/(h*pr));}
 function exitPhoto(reason='internal'){if(photoActive||photoBusy){photoActive=false;photoBusy=false;if(photo)photo.enabled=false;renderPass.enabled=true;restorePhotoResolution();notifyPhoto('off');renderer.shadowMap.needsUpdate=true;schedule();}}
 let hoverLast=0;
 canvas.addEventListener('pointermove',e=>{if(e.buttons||photoActive||performance.now()-hoverLast<85)return;hoverLast=performance.now();const b=canvas.getBoundingClientRect(),ray=new T.Raycaster();ray.firstHitOnly=true;ray.far=3.4;ray.setFromCamera(new T.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),camera);scene.updateMatrixWorld(true);const candidates=[...interior.interactions.map(i=>i.object),...doorStates.map(d=>d.leaf)];const hit=ray.intersectObjects(candidates,true)[0];if(!hit){canvas.style.cursor='grab';return;}const opaque=ray.intersectObjects(scene.children,true).find(h=>h.object!==stepMarker&&!h.object.material?.transparent);if(opaque&&opaque.distance+.08<hit.distance){canvas.style.cursor='grab';return;}canvas.style.cursor='pointer';const desc=(o,p)=>{while(o){if(o===p)return true;o=o.parent;}return false;};const item=interior.interactions.find(i=>desc(hit.object,i.object));onInteraction?.(item?.label||'Дверь');});
 const doorPhysics=createDoorPhysics(doorStates);
 const adjacent={living:['entry','terrace'],kitchen:['entry','terrace'],terrace:['living','kitchen'],office:['entry'],entry:['living','kitchen','office','hall'],hall:['entry','master','bed3','wardrobe','bath1','bath2','bath3'],wardrobe:['hall','bed1'],bed1:['wardrobe'],master:['hall'],bed3:['hall'],bath1:['hall'],bath2:['hall'],bath3:['hall']};
 const localLights=[];scene.updateMatrixWorld(true);scene.traverse(o=>{if(o.isPointLight||o.isRectAreaLight){const p=o.getWorldPosition(new T.Vector3()),q=toPlan(p.x,p.z);o.userData.room=ROOMS.find(r=>inside(...q,r.poly))?.id;localLights.push(o);}});let litRoom=null,litPosition=new T.Vector3(Infinity,Infinity,Infinity);
 function updateLocalLighting(){const here=movement.room;if(here===litRoom&&litPosition.distanceToSquared(camera.position)<.64)return;litRoom=here;litPosition.copy(camera.position);const visible=new Set([here,...(adjacent[here]||[])]);for(const l of localLights){const p=l.getWorldPosition(new T.Vector3());l.visible=(!l.userData.room||visible.has(l.userData.room))&&p.distanceTo(camera.position)<8.5;}}

 const movement=createMovement({canvas,camera,schedule,pick:ray=>{
  exitPhoto();ray.firstHitOnly=true;const pushed=physics?.pushFromRay(ray.ray,.75);if(pushed){onInteraction?.(pushed.label);schedule();return true;}
  scene.updateMatrixWorld(true);const objects=[...interior.interactions.map(i=>i.object),...doorStates.map(d=>d.leaf)];
  const hits=ray.intersectObjects(objects,true);if(!hits.length||hits[0].distance>3.4)return false;
  // A wall or an opaque furnishing in front of the object blocks interaction.
  const nearest=ray.intersectObjects(scene.children,true).find(h=>h.object!==stepMarker&&!h.object.material?.transparent);
  if(nearest&&nearest.distance+.08<hits[0].distance)return false;
  const isDesc=(o,p)=>{while(o){if(o===p)return true;o=o.parent;}return false;};
  const target=interior.interactions.find(i=>isDesc(hits[0].object,i.object));if(target){target.action();onInteraction?.(target.label);schedule();return true;}
  const door=doorStates.find(d=>isDesc(hits[0].object,d.leaf));if(door){door.manual=true;door.target=Math.abs(door.target)<.3?door.d.open:0;onInteraction?.('Дверь');schedule();return true;}return false;
 },obstructed:p=>{return !physics&&(interior.blocks(p)||doorPhysics.blocks(p));
 },onFeedback:(text,p)=>{exitPhoto();if(p){stepMarker.position.copy(p);stepMarker.visible=true;markerLife=.9;}onInteraction?.(text);schedule();}});
 function render(){
  for(const mirror of interior.mirrors)mirror.visible=mirror.userData.room===movement.room;
  if(photoActive&&photo){if(photo.samples<16){const auto=renderer.autoClear,clear=new T.Color(),alpha=renderer.getClearAlpha();renderer.getClearColor(clear);try{composer.render();photo.samples=16;canvas.dataset.photoSamples='16';canvas.dataset.photoMode='ssaa';notifyPhoto('rendering','Снимок повышенной чёткости');}catch(error){console.warn('Photo supersampling unavailable:',error);exitPhoto();notifyPhoto('unsupported','Снимок недоступен в этом браузере');}finally{renderer.autoClear=auto;renderer.setClearColor(clear,alpha);camera.clearViewOffset();renderer.setRenderTarget(null);}}}
  else{updateLocalLighting();const begin=performance.now();composer.render();canvas.dataset.renderMs=(performance.now()-begin).toFixed(2);}
  const here=movement.room;const dir=new T.Vector3();camera.getWorldDirection(dir);const[x,z]=movement.position;onMove?.({x,z,heading:Math.atan2(dir.x,-dir.z)*180/Math.PI,walking:movement.moving,room:movement.room});
  canvas.dataset.physics=physics?'rapier':'loading';canvas.dataset.baked=String(Boolean(bakedController?.applied));canvas.dataset.quality=quality.id;canvas.dataset.activeBodies=String(physics?.activeBodies||0);canvas.dataset.walking=String(movement.moving);canvas.dataset.curtains=interior.curtainsOpen?'open':'closed';canvas.dataset.doors=doorStates.map(d=>Math.round(d.angle*180/Math.PI)).join(',');canvas.dataset.position=x.toFixed(2)+','+z.toFixed(2);
 }
 function tick(now){frame=0;if(lastFrameStamp&&now-lastFrameStamp<100){fpsWindow.push(now-lastFrameStamp);if(fpsWindow.length>90)fpsWindow.shift();if(fpsWindow.length>20)canvas.dataset.fps=(1000/(fpsWindow.reduce((a,b)=>a+b,0)/fpsWindow.length)).toFixed(1);}lastFrameStamp=now;if(quality.mobile&&!movement.active&&!photoActive&&!photoBusy&&now-lastTick<32){schedule();return;}const dt=Math.min(.033,(now-lastTick)/1000||.016);lastTick=now;let activity=false;
  if(!photoActive&&!photoBusy){activity=movement.update(dt)||activity;
   const doorBefore=doorStates.map(d=>d.angle);doorPhysics.update(dt,camera.position);const changedDoor=doorStates.some((d,i)=>Math.abs(d.angle-doorBefore[i])>.00001);if(changedDoor){activity=true;renderer.shadowMap.needsUpdate=true;}
   activity=interior.update(dt,camera)||activity;const physicsStart=performance.now(),physicalActivity=physics?.step(dt)||false;canvas.dataset.physicsMs=(performance.now()-physicsStart).toFixed(2);if(physicalActivity&&now-lastShadowUpdate>(quality.id==='high'?33:quality.id==='medium'?66:100)){renderer.shadowMap.needsUpdate=true;lastShadowUpdate=now;}activity=physicalActivity||activity;
   if(Math.abs(clockTarget-clockValue)>.0001){clockValue=T.MathUtils.lerp(clockValue,clockTarget,1-Math.exp(-dt*4));applyTime(clockValue);activity=true;}
   if(markerLife>0){markerLife-=dt;stepMarker.material.opacity=Math.max(0,markerLife*.65);stepMarker.scale.setScalar(1+(1-markerLife)*.22);stepMarker.visible=markerLife>0;activity=true;}
  }
  render();if(activity||movement.active||(photoActive&&photo?.samples<16))schedule();
 }
 function applyTime(value){const evening=T.MathUtils.smoothstep(value,.48,1),gold=Math.sin(Math.min(1,value)*Math.PI);sun.position.set(24,18-value*15,-12+value*34);sun.color.set('#fff3df').lerp(new T.Color('#ffc17b'),gold*.55);sun.intensity=3.3*(1-evening)+.08;scene.environmentIntensity=(bakedController?.applied?.12:.38)*(1-evening)+.025;scene.backgroundIntensity=.65*(1-evening)+.025;hemisphere.intensity=(bakedController?.applied?.10:.35)*(1-evening)+.05;for(const l of dayLights)l.intensity=2.8*(1-evening)+.05;for(const l of fills)l.intensity=(bakedController?.applied?1.2:4)+evening*6;for(const o of interior.lightSources)o.light.intensity=o.base*(.7+evening*.9);bakedController?.setMix(evening);dynamicProbes?.setMix(evening);bloom.enabled=quality.bloom&&evening>.02;renderer.shadowMap.needsUpdate=true;}
 function resize(){exitPhoto('resize');const w=stage.clientWidth,h=stage.clientHeight;renderer.setPixelRatio(Math.min(devicePixelRatio||1,quality.dpr,quality.maxPixels/Math.max(w,h)));renderer.setSize(w,h,false);composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(w,h);ao.setSize(Math.min(w*quality.aoScale,1280),Math.min(h*quality.aoScale,900));ao.enabled=quality.ao;const pr=renderer.getPixelRatio();fxaa.material.uniforms.resolution.value.set(1/(w*pr),1/(h*pr));camera.aspect=w/h;camera.fov=camera.aspect<.9?72:62;camera.updateProjectionMatrix();renderer.shadowMap.needsUpdate=true;schedule();}
 new ResizeObserver(resize).observe(stage);new IntersectionObserver(es=>{shown=es[0].isIntersecting;lastTick=performance.now();if(shown)schedule();else if(frame){cancelAnimationFrame(frame);frame=0;}}).observe(stage);
 canvas.addEventListener('pointerdown',exitPhoto);canvas.addEventListener('keydown',exitPhoto);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();canvas.dispatchEvent(new CustomEvent('tourerror',{bubbles:true}));});
 function batchStatic(){
  scene.updateMatrixWorld(true);const sets=new Map(),remove=[];
  scene.traverse(o=>{if(!o.isMesh||Array.isArray(o.material)||!o.geometry.attributes.uv)return;let p=o;while(p){if(p.userData.dynamic)return;p=p.parent;}const key=o.material.uuid+'/'+o.castShadow+'/'+o.receiveShadow+'/'+Boolean(o.userData.bakeCandidate);if(!sets.has(key))sets.set(key,{material:o.material,cast:o.castShadow,receive:o.receiveShadow,bake:Boolean(o.userData.bakeCandidate),geometries:[]});let g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(g.index)g=g.toNonIndexed();for(const attr of Object.keys(g.attributes))if(!['position','normal','uv'].includes(attr))g.deleteAttribute(attr);sets.get(key).geometries.push(g);remove.push(o);});
  for(const item of sets.values()){const geo=mergeGeometries(item.geometries,false);if(!geo)continue;geo.boundsTree=new MeshBVH(geo,{maxLeafTris:12});const mesh=new T.Mesh(geo,item.material);mesh.castShadow=item.cast;mesh.receiveShadow=item.receive;(item.bake?bakedGroup:scene).add(mesh);for(const g of item.geometries)g.dispose();}for(const o of remove)o.removeFromParent();
  const retained=new Set();scene.traverse(o=>{if(o.isMesh)retained.add(o.geometry);});for(const geometry of new Set(remove.map(o=>o.geometry)))if(!retained.has(geometry))geometry.dispose();
  floors.length=chairTargets.length=plantTargets.length=planterTargets.length=bedGroups.length=0;boxCache.clear();roundCache.clear();
 }
 async function setPhoto(){
  if(!atelier||!ready||stage.clientWidth<700){notifyPhoto('unsupported','Режим фото доступен на широком экране');return false;}
  if(photoActive||photoBusy){exitPhoto();return false;}movement.stop();photoBusy=true;notifyPhoto('preparing','Готовим снимок…');
  try{if(!photo){const {SSAARenderPass}=await import('./vendor/three/addons/postprocessing/SSAARenderPass.js');if(!photoBusy)return false;photo=new SSAARenderPass(scene,camera);photo.sampleLevel=4;photo.unbiased=true;photo.enabled=false;composer.insertPass(photo,1);}
   stepMarker.visible=false;const w=stage.clientWidth,h=stage.clientHeight,ratio=Math.max(renderer.getPixelRatio(),Math.min(renderer.getPixelRatio()*2,2560/Math.max(w,h)));composer.setPixelRatio(ratio);composer.setSize(w,h);ao.setSize(Math.min(w*ratio,1600),Math.min(h*ratio,1000));fxaa.material.uniforms.resolution.value.set(1/(w*ratio),1/(h*ratio));updateLocalLighting();renderPass.enabled=false;photo.enabled=true;photo.samples=0;photoActive=true;photoBusy=false;notifyPhoto('preparing','Готовим снимок…');schedule();return true;
  }catch(error){console.warn('Photo supersampling unavailable:',error);exitPhoto();notifyPhoto('unsupported','Снимок недоступен в этом браузере');schedule();return false;}
 }
 // Scanned CC0 detail meshes are local, shared between repeated instances.
 // They replace decorative furniture only; plan geometry and room positions stay fixed.
 async function finaliseScene(){
  if(!physicsReady||!assetsFinished||finalising)return;finalising=true;
  canvas.dispatchEvent(new CustomEvent('loadprogress',{detail:{progress:.68,label:'Физика предметов'},bubbles:true}));
  scene.updateMatrixWorld(true);
  for(const target of[...physicalTargets,...interior.props])physics.addDynamicObject(target.object,target.options);
  let softCount=0;for(const target of pillowTargets){let actual=null;target.holder.traverse(o=>{if(o.isMesh&&!actual)actual=o;});if(quality.id==='high'&&softCount<2&&actual){physics.addSoftObject(actual,{mode:'cushion',mass:.8,label:'Подушка'});softCount++;}else physics.addDynamicObject(target.holder,{label:'Подушка',mass:.8,friction:.85,restitution:.025});}
  for(const target of interior.softProps){try{physics.addSoftObject(target.object,target.options);}catch(error){console.warn('Cloth uses a rigid proxy:',error);physics.addDynamicObject(target.object,{label:'Плед',mass:1.2,friction:.9});}}
  const exported=prepareBakeExport({scene,walls,ceilings,materials,dayLights,fills,interior,sun});bakeMaterials=exported.materialLookup;try{const info=await fetch('assets/baked/manifest.json').then(r=>r.json());for(const record of info.meshes){if(!record.materialName.startsWith('custom_'))continue;const min=new T.Vector3(...record.bounds.min),max=new T.Vector3(...record.bounds.max);let best=null,error=Infinity;for(const candidate of exported.spatialMaterials){const e=candidate.min.distanceToSquared(min)+candidate.max.distanceToSquared(max);if(e<error){error=e;best=candidate;}}if(best&&error<.01)bakeMaterials.set(record.materialName,best.material);}}catch{}batchStatic();
  canvas.dispatchEvent(new CustomEvent('loadprogress',{detail:{progress:.78,label:'Запечённый свет'},bubbles:true}));
  try{bakedController=await loadBakedLighting({group:bakedGroup,materials:bakeMaterials,quality:meshQuality,intensity:1,aoIntensity:.65});if(bakedController.applied){const closedFront=bakedGroup.children.find(o=>o.name==='static_0245');if(closedFront){closedFront.removeFromParent();closedFront.geometry.dispose();}}if(bakedController.applied)bakedGroup.traverse(o=>{if(!o.isMesh)return;const geometry=o.geometry;geometry.computeBoundingBox();const center=geometry.boundingBox.getCenter(new T.Vector3()),size=geometry.boundingBox.getSize(new T.Vector3()),[tx,tz]=point(364,944);if(Math.hypot(center.x-tx,center.z-tz)<.025&&center.y<.45&&size.x>.5&&size.y<.4){const ratio=size.x/size.z,p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,tz+(p.getZ(i)-tz)*ratio);p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();}metricUV(geometry);geometry.boundsTree=new MeshBVH(geometry,{maxLeafTris:16});});}catch(error){console.error('Baked lighting unavailable:',error);}
  if(bakedController?.applied)dynamicProbes=attachDynamicProbes({bakedGroup,targets:[...probeTargets,...physicalTargets.map(p=>p.object),...interior.props.map(p=>p.object),...pillowTargets.map(p=>p.holder),...interior.softProps.map(p=>p.object),...interior.curtains.map(c=>c.mesh),...interior.interactions.map(i=>i.object),...doorStates.map(d=>d.leaf)]});applyTime(clockValue);movement.setPhysics(physics);updateLocalLighting();for(const mirror of interior.mirrors)mirror.visible=false;canvas.dispatchEvent(new CustomEvent('loadprogress',{detail:{progress:.94,label:'Подготовка изображения'},bubbles:true}));try{await renderer.compileAsync(scene,camera);}catch{}ready=true;renderer.shadowMap.needsUpdate=true;canvas.dataset.loaded='true';canvas.dispatchEvent(new CustomEvent('loadprogress',{detail:{progress:1,label:'Готово'},bubbles:true}));canvas.dataset.meshLOD=bakedController?.stats?.lod||'none';canvas.dataset.bakedFallbacks=(bakedController?.stats?.fallbackMaterials||[]).join(',');canvas.dataset.rugPbr=bakedGroup.children.find(o=>o.name==='static_0229')?.material?.userData?.pbr||'missing';onReady?.();schedule();
 }
 const loader=new GLTFLoader();let assetPending=5;const assetDone=()=>{assetPending--;schedule();if(assetPending===0){assetsFinished=true;finaliseScene();}};
 import('./physics-world.js?v=20261025-gesture12').then(({createPhysicsWorld})=>createPhysicsWorld({quality:quality.id})).then(driver=>{physics=driver;physics.addApartmentFurniture();for(const[px,pz,w,ys]of[[286,866,.66,[.92,1.62,2.32,3.12]],[64,830,1.42,[1.35,1.79,2.23]]]){const[x,z]=point(px,pz);for(const y of ys)physics.addStaticBox([x,y,z+.12],[w/2,.018,.12]);}const[lx,lz]=point(463,997);physics.addStaticCylinder([lx,.74,lz],.12,.74);for(const item of interior.interactions)if(item.label==='Ящик')physics.addKinematicObject(item.object,{collisionSize:[1.05,.25,.36],collisionCenter:[0,.39,-.14],label:'Ящик'});physics.setDoorStates(doorStates);physicsReady=true;movement.setPhysics(physics);finaliseScene();}).catch(error=>{console.error('Physics could not initialize:',error);canvas.dispatchEvent(new CustomEvent('tourerror',{bubbles:true}));});
 loadPremiumMaterials({scene,materials,renderer,quality,onProgress:p=>canvas.dispatchEvent(new CustomEvent('loadprogress',{detail:{progress:.12+p*.50,label:'Материалы и фактуры'},bubbles:true}))}).then(()=>assetDone()).catch(error=>{console.error('PBR material loading failed:',error);assetDone();});
 function fitAsset(source,w,h,d){
  const asset=source.clone(true);asset.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(asset),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const normalized=new T.Group();normalized.add(asset);asset.position.sub(new T.Vector3(center.x,bounds.min.y,center.z));normalized.scale.set(w/size.x,h/size.y,d/size.z);
  asset.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material)o.material.envMapIntensity=.55;}});return normalized;
 }
 loader.load('assets/models/dining_chair_02/model.gltf',gltf=>{for(const holder of chairTargets){holder.clear();const asset=fitAsset(gltf.scene,.54,.94,.58);asset.traverse(o=>{if(o.isMesh){o.material=materials.linen;}});holder.add(asset);}assetDone();},undefined,assetDone);
 loader.load('assets/models/throw_pillows_01/model.gltf',gltf=>{const source=gltf.scene.getObjectByName('throw_pillows_01_pillow01')||gltf.scene.children[0];for(const t of pillowTargets){t.holder.clear();const asset=fitAsset(source,t.width,t.height,t.depth);asset.traverse(o=>{if(o.isMesh){o.material=materials.ivory;}});t.holder.add(asset);}assetDone();},undefined,assetDone);
 loader.load('assets/models/potted_plant_02/model.gltf',gltf=>{for(const t of plantTargets){t.holder.clear();const large=t.holder.position.z>point(0,850)[1],asset=createOliveTree({height:large?1.82:1.08,quality:quality.id,seed:Math.round(t.holder.position.x*997+t.holder.position.z*113)+296,materials:{pot:materials.stone,soil:materials.soil,bark:materials.walnut}});const physical=physicalTargets.find(p=>p.object===t.holder);if(physical)Object.assign(physical.options,{collisionSize:[.4,.55,.4],collisionCenter:[0,.275,0]});asset.traverse(o=>{if(o.isMesh&&o.name.endsWith('_pot')){o.material=o.material.clone();o.material.map=null;o.material.color.set('#d8d0bf');o.material.roughness=.85;}});t.holder.add(asset);}const leaves=gltf.scene.getObjectByName('potted_plant_02_leaves');if(leaves)for(const t of planterTargets){t.holder.clear();for(const[x,z]of t.positions){const plant=fitAsset(leaves,.24,.23,.24);plant.position.set(x,.31,z);plant.rotation.y=x*12+z*9;plant.traverse(o=>{if(o.isMesh)o.castShadow=false;});t.holder.add(plant);}}assetDone();},undefined,assetDone);
 new RGBELoader().load('assets/daylight-sky-2k.hdr',hdr=>{hdr.mapping=T.EquirectangularReflectionMapping;scene.environment=hdr;scene.environmentIntensity=.38;scene.background=hdr;scene.backgroundBlurriness=.12;scene.backgroundIntensity=.55;assetDone();},undefined,assetDone);
 movement.go('living',true);resize();
 return{go(id,instant=false){exitPhoto();return movement.go(id,instant);},resize,setPhoto,setTime(value){exitPhoto();clockTarget=Math.max(0,Math.min(1,value));schedule();},toggleCurtains(){exitPhoto();interior.setCurtains(!interior.curtainsOpen);schedule();return interior.curtainsOpen;},set onMove(fn){onMove=fn;},set onInteraction(fn){onInteraction=fn;},dispose(){if(frame)cancelAnimationFrame(frame);renderer.dispose();composer.dispose();photo?.dispose();physics?.dispose();movement.dispose?.();bakedController?.dispose();dynamicProbes?.dispose();env.dispose();}};
}
