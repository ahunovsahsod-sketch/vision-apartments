import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {ROOMS,roomById,point,CEILING} from './plan.js';

// One material vocabulary is used in every room: oak, linen, limestone and bronze.
// Detailed joinery, ceramics and lighting are geometry, not flat room backdrops.
export function furnish({scene,materials:m,group,box,cylinder,tube,fabric,plant,pillowTargets,bedGroups,doors,renderer,atelier}){
 const animated=[],interactions=[],lightSources=[],curtains=[],colliders=[],mirrors=[];
 const bronze=m.metal,white=m.ivory;
 function glow(color='#ffe7b8',strength=4.6){return new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:strength,roughness:.48,metalness:0});}
 const lit=glow();
 function lathe(profile,material,x,y,z,parent){const mesh=new T.Mesh(new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),64),material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function vessel(parent,x,y,z,size=.24,material=m.stone){return lathe([[0,0],[.44,0],[.5,.08],[.56,.42],[.46,.72],[.25,.87],[.22,1],[.18,1],[.19,.88],[.35,.68],[.42,.4],[.38,.12],[0,.12]].map(p=>p.map(v=>v*size)),material,x,y,z,parent);}
 function bowl(parent,x,y,z,size=.18){return lathe([[0,.01],[.4,.01],[.72,.08],[1,.3],[1,.35],[.93,.35],[.65,.14],[0,.1]].map(p=>p.map(v=>v*size)),m.stone,x,y,z,parent);}
 function books(parent,x,y,z){for(let i=0;i<3;i++){const g=new T.Group();g.position.set(x,y+i*.029,z);g.rotation.y=i*.11;parent.add(g);box(.34,.026,.25,i%2?m.linen:m.oak,0,.013,0,g,.003);box(.325,.018,.24,m.ivory,.005,.014,0,g,.002);}}
 function branches(parent,x,y,z,size=1){const g=new T.Group();g.position.set(x,y,z);parent.add(g);const leafGeo=new T.SphereGeometry(1,7,4);for(let i=0;i<7;i++){const a=i*2.399,length=size*(.36+.045*i),end=[Math.cos(a)*size*.32,length,Math.sin(a)*size*.3];tube([[0,0,0],[end[0]*.45,length*.55,end[2]*.45],end],.0045*size,m.walnut,g);for(let j=0;j<8;j++){const t=(j+1)/9,leaf=new T.Mesh(leafGeo,m.leaf);leaf.position.set(end[0]*t+.04*Math.cos(j),length*t,end[2]*t);leaf.scale.set(.036*size,.009*size,.10*size);leaf.rotation.set(.4,a+j*.7,.25);leaf.castShadow=true;g.add(leaf);}}return g;}
 function frame(px,pz,w,h,rotation=0){const g=group(px,pz,rotation);box(w,h,.025,m.oak,0,1.85,0,g,.003);const material=m.wall.clone();material.color.set('#c9bba3');box(w-.035,h-.035,.015,material,0,1.85,.018,g);for(let i=0;i<8;i++){const line=new T.Mesh(new T.TorusGeometry(.16+i*.025,.002,5,50,Math.PI*1.45),m.stone);line.position.set(-.1,1.9,.034);line.scale.y=1.55;line.rotation.z=-.6;g.add(line);}return g;}
 function strip(parent,x,y,z,w){box(w,.01,.018,lit,x,y,z,parent);const l=new T.RectAreaLight('#ffd89a',6.4,w,.08);l.position.set(x,y-.015,z+.03);l.lookAt(x,y-.9,z+.4);parent.add(l);lightSources.push({light:l,base:6.4});}
 function pendant(px,pz,width=.55,bottom=2.18){const g=group(px,pz);cylinder(.045,.045,.025,bronze,0,CEILING-.02,0,g);cylinder(.004,.004,CEILING-bottom-.05,bronze,0,(CEILING+bottom)/2,0,g);lathe([[0,0],[width*.5,0],[width*.5,.03],[width*.43,.08],[width*.15,.1],[0,.1]],m.linen,0,bottom,0,g);cylinder(width*.37,width*.37,.008,lit,0,bottom-.005,0,g);const light=new T.PointLight('#ffddb0',4,3,2);light.position.set(0,bottom-.12,0);g.add(light);lightSources.push({light,base:4});return g;}
 // Living: open niches, paper, ceramics and branch arrangements.
 const shelves=group(286,866);box(.7,3.18,.025,m.oak,0,1.72,.01,shelves,.004);for(const y of[.92,1.62,2.32,3.12]){box(.66,.032,.22,m.oak,0,y,.12,shelves,.003);strip(shelves,0,y-.022,.13,.6);}vessel(shelves,-.1,.94,.12,.30,bronze);books(shelves,0,1.65,.12);vessel(shelves,.03,2.35,.12,.21);branches(shelves,.03,2.55,.12,.55);
 // Niche ceramics on integrated TV wall unit (local offsets match scene media at 385,865)
 const nicheProps=group(385,865);vessel(nicheProps,-1.72,.98,.18,.22);books(nicheProps,-1.55,1.58,.16);vessel(nicheProps,-1.7,2.18,.16,.18,bronze);branches(nicheProps,-1.7,2.35,.16,.42);
 const table=group(364,944);books(table,-.2,.444,.02);vessel(table,.18,.445,-.03,.32);branches(table,.18,.74,-.03,.63);bowl(table,-.1,.535,.08,.15);
 const livingDetail=group(453,865);vessel(livingDetail,0,.55,.15,.31);branches(livingDetail,0,.85,.15,.78);
 // Throw with draped folds over the sofa's far end. Fabric follows a curved surface.
 const blanket=new T.PlaneGeometry(.88,1.48,48,70),bp=blanket.attributes.position;
 for(let i=0;i<bp.count;i++){const u=bp.getX(i),v=bp.getY(i),t=(v+.74)/1.48;const y=t<.63?.61+Math.sin(t*5)*.025:.61-(t-.63)*1.3;bp.setXYZ(i,u+.025*Math.sin(t*17),y+.012*Math.sin(u*44+t*14),-.30+t*.91);}
 blanket.computeVertexNormals();const bmat=fabric('#c4b396');bmat.side=T.DoubleSide;bmat.sheen=1;bmat.sheenRoughness=.34;bmat.bumpScale=.14;const throwMesh=new T.Mesh(blanket,bmat),throwGroup=group(378,978,Math.PI);throwGroup.add(throwMesh);throwMesh.castShadow=throwMesh.receiveShadow=true;
 // Frayed edge fringe along throw hem
 for(let i=0;i<18;i++){const fringe=box(.012,.008,.07,m.linen,-.38+i*.045,.58,.42,throwGroup);fringe.rotation.x=.35;}
 // Matching upholstered bedroom head walls and soft pendants in every bedroom.
 for(const [id,px,pz,width]of[['bed1',194,195,2.5],['master',350,195,2.7],['bed3',360,495,2.5]]){
  const g=group(px,pz,Math.PI/2);box(width,2.65,.045,m.oak,0,1.37,-.06,g,.003);for(let i=0;i<5;i++)box(width/5-.012,1.16,.06,m.linen,-width/2+width/10+i*width/5,.87,0,g,.018);strip(g,0,1.49,.05,width-.12);
  const side=(width/2-.22)*49.5;pendant(px+18,pz-side,.24,1.52);pendant(px+18,pz+side,.24,1.52);
  const detail=group(px+22,pz+side);books(detail,0,.51,0);frame(493,pz+20,.82,1.1,-Math.PI/2);
 }
 pendant(383,830,.72,2.17);pendant(100,936,.55,2.28);
 // Office and hall repeat the same joinery and warm indirect lighting.
 const office=group(94,832);strip(office,0,1.31,.12,2.2);vessel(office,.74,1.38,.1,.24);branches(office,.74,1.6,.1,.5);
 const stationery=group(131,936);books(stationery,0,.81,0);bowl(stationery,-.18,.81,.05,.13);
 frame(286,575,.57,1.1,Math.PI/2);frame(190,681,1.0,1.1,Math.PI/2);
 // Mirrors are metal rather than transparent glass; the photo renderer reflects the room.
 const mirror=new T.MeshStandardMaterial({color:'#eeeeea',metalness:1,roughness:.035});
 for(const[px,pz,rotation,w]of[[203,509,Math.PI/2,.6],[254,561,0,.56],[455,695,Math.PI,.46]]){const g=group(px,pz,rotation);box(w+.04,1.04,.015,lit,0,1.68,-.234,g,.04);box(w,.99,.02,mirror,0,1.68,-.215,g,.04);const reflection=new Reflector(new T.PlaneGeometry(w,.99),{clipBias:.003,textureWidth:512,textureHeight:768,color:0xe4ded3,multisample:2});reflection.position.set(0,1.68,-.200);reflection.userData.dynamic=true;const reflect=reflection.onBeforeRender;reflection.onBeforeRender=function(renderer,scene,camera){if(scene.overrideMaterial)return;reflect.call(this,renderer,scene,camera);};g.add(reflection);mirrors.push(reflection);const l=new T.RectAreaLight('#ffe3ba',2.8,w,1);l.position.set(0,1.68,-.19);l.lookAt(0,1.5,1);g.add(l);lightSources.push({light:l,base:2.8});vessel(g,w*.32,.79,.07,.11);const towel=box(.2,.025,.25,m.ivory,-w*.3,.81,.05,g,.015);}
 // Limestone backsplash and oak doors unite all three bathrooms.
 for(const id of['bath1','bath2','bath3']){const r=roomById[id],p=point(...r.camera),light=new T.PointLight('#ffedcf',5,3.2,2);light.position.set(p[0],2.95,p[1]);scene.add(light);lightSources.push({light,base:5});}

 // Full-height linen curtains: small explicit cloth strips with fixed top nodes.
 function curtain(px,pz,width,height=3.14,rotation=0){
  const g=group(px,pz,rotation),cols=28,rows=36,geo=new T.PlaneGeometry(width,height,cols,rows),positions=geo.attributes.position;
  const base=[],old=[],pinned=[];
  for(let i=0;i<positions.count;i++){const u=positions.getX(i),v=positions.getY(i);const fold=.14*Math.cos(u/width*Math.PI*8)+.06*Math.cos(u/width*Math.PI*18)+.025*Math.cos(u/width*Math.PI*28);const hang=.012*Math.sin((v/height)*Math.PI)*Math.abs(fold);const p=new T.Vector3(u,v+height/2+.07,fold+hang);base.push(p.clone());old.push(p.clone());pinned.push(v>height/2-.001);positions.setXYZ(i,p.x,p.y,p.z);}
  // Round1 sheer: lighter opacity/transmission; curtains clickable on index+atelier
  const material=(m.curtain?m.curtain.clone():fabric('#d8c4a8'));material.color.set('#e8d9c2');material.side=T.DoubleSide;material.transparent=true;material.opacity=.66;material.transmission=.38;material.roughness=.78;material.sheen=.8;material.sheenColor=new T.Color('#faf0e0');material.depthWrite=false;const mesh=new T.Mesh(geo,material);mesh.castShadow=false;mesh.receiveShadow=true;g.add(mesh); // Round2 sheer linen
  const rail=box(width+.15,.018,.025,bronze,0,height+.12,0,g);curtains.push({group:g,mesh,base,old,pinned,cols,rows,width,opening:1,velocity:0});
  // Invisible hit slab (like doorHit): sheer transparent/depthWrite=false is a weak raycast target.
  // Hit is a sibling of mesh (not scaled by opening) so pick stays reliable when curtains open.
  const curtainHit=new T.Mesh(new T.BoxGeometry(Math.max(width,.55)+.42,height+.2,.78),new T.MeshBasicMaterial({visible:false}));
  curtainHit.position.set(0,height/2+.07,0);curtainHit.userData.dynamic=true;g.add(curtainHit);
  interactions.push({object:curtainHit,label:'Шторы',kind:'curtains',action:()=>{curtainTarget=curtainTarget>.5?.24:1;}});
  return g;
 }
 // Panels respect every opening and never extend across a door threshold.
 curtain(492,882,.78,3.18,Math.PI/2);curtain(492,968,.78,3.18,Math.PI/2);
 curtain(493,730,.62,3.18,Math.PI/2);curtain(493,826,.62,3.18,Math.PI/2);
 for(const [px,pz]of[[492,58],[492,273],[492,400],[492,597]])curtain(px,pz,.72,3.18,Math.PI/2);
 curtain(203,25,.55,3.18);curtain(322,25,.55,3.18);curtain(360,25,.55,3.18);curtain(478,25,.55,3.18);
 let curtainTarget=1;
 // Static furniture AABBs (plan metres → world) — active on index + atelier.
 function boxCollider(px,pz,hw,hd){const[x,z]=point(px,pz);return p=>Math.abs(p.x-x)<hw&&Math.abs(p.z-z)<hd;}
 for(const c of[
  boxCollider(363,984,1.7,.7),   // living sofa (thrash)
  boxCollider(364,944,.9,.7),    // coffee table
  boxCollider(385,865,2.3,.4),   // media / TV wall unit
  boxCollider(286,866,.45,.3),   // open shelves
  boxCollider(458,918,.95,.7),   // lounge dining table
  boxCollider(383,832,1.2,.45),  // kitchen table
  boxCollider(385,738,2.15,.4),  // kitchen counter
  boxCollider(94,935,1.2,.5),    // office desk
 ])colliders.push(c);
 // A spring drawer and a reading light are directly touchable in the second site.
 // Floor lamp near sofa (TARGET: linen shade) — visual + toggle on both index and atelier.
 const reading=group(450,1000);cylinder(.19,.2,.035,bronze,0,.02,0,reading);cylinder(.013,.013,1.45,bronze,0,.74,0,reading);
 const shadeMat=m.ivory.clone();shadeMat.emissive=new T.Color('#ffd7a0');shadeMat.emissiveIntensity=2.4;shadeMat.color.set('#f4ebe0');
 const shade=lathe([[.20,0],[.20,.32],[.15,.32],[.14,0]],shadeMat,0,1.38,0,reading);
 const readingLight=new T.PointLight('#ffd8a2',4.2,4.2,2);readingLight.position.set(0,1.5,0);reading.add(readingLight);
 const lampSrc={light:readingLight,base:4.2,enabled:true};lightSources.push(lampSrc);colliders.push(boxCollider(450,1000,.22,.22));
 // Invisible enlarged hit target so lamp toggle is reliable (shade/stem alone are thin).
 const lampHit=new T.Mesh(new T.CylinderGeometry(.65,.65,2.1,16),new T.MeshBasicMaterial({visible:false}));lampHit.position.set(0,1.0,0);lampHit.userData.dynamic=true;reading.add(lampHit);
 // Lamp toggle: strong emissive/color delta so on↔off is obvious in ordinary daylight.
 function syncLamp(){
  const on=!!lampSrc.enabled;
  readingLight.intensity=on?lampSrc.base:0;
  shadeMat.emissiveIntensity=on?2.4:0;
  shadeMat.emissive.set(on?'#ffd7a0':'#000000');
  shadeMat.color.set(on?'#f4ebe0':'#3a3630');
  shadeMat.needsUpdate=true;
 }
 syncLamp();
 interactions.push({object:reading,label:'Торшер',kind:'lamp',get on(){return lampSrc.enabled;},action:()=>{lampSrc.enabled=!lampSrc.enabled;syncLamp();}});
 if(atelier){
  const drawer=group(386,875),drawerBase=point(385,865)[1]+.325;drawer.position.z=drawerBase;box(1.05,.23,.045,m.oak,0,.39,0,drawer,.006);box(1.0,.025,.32,m.oak,0,.28,-.14,drawer,.004);for(const x of[-.49,.49])box(.018,.16,.32,m.oak,x,.36,-.14,drawer,.003);books(drawer,-.12,.30,-.14);let value=0,velocity=0,target=0;
  interactions.push({object:drawer,label:'Ящик',action:()=>{target=target>.1?0:.29;}});colliders.push(p=>Math.abs(p.x-drawer.position.x)<.70&&Math.abs(p.z-drawer.position.z)<.20);animated.push({update(dt,camera){const force=(target-value)*90-velocity*18;velocity+=force*dt;const next=value+velocity*dt;if(velocity>0&&Math.abs(camera.position.x-drawer.position.x)<.72&&Math.abs(camera.position.z-(drawerBase+next))<.22){velocity=0;target=0;}else value=next;drawer.position.z=drawerBase+value;return Math.abs(target-value)+Math.abs(velocity)>.002;}});
}
 let elapsed=0;
 function update(dt,camera){
  elapsed+=dt;let moving=false;dt=Math.min(dt,.024);
  for(const a of animated)moving=a.update(dt,camera)||moving;
  for(const c of curtains){
   const distance=c.group.position.distanceTo(camera.position);
   c.velocity+=((curtainTarget-c.opening)*38-c.velocity*12)*dt;c.opening+=c.velocity*dt;c.mesh.scale.x=Math.max(.18,c.opening);moving= Math.abs(c.velocity)>.001||moving;
   if(distance>5.5)continue;
   if(!atelier||matchMedia('(prefers-reduced-motion:reduce)').matches)continue;
   const p=c.mesh.geometry.attributes.position;
   // Verlet-like transverse cloth displacement: spring to rest folds, coupled neighbours,
   // pinned heading and damping. Only nearby curtains simulate.
   for(let i=0;i<p.count;i++){if(c.pinned[i])continue;const rest=c.base[i],old=c.old[i],z=p.getZ(i),velocity=(z-old.z)*.965,fall=1-rest.y/3.3;const wind=.00038*Math.sin(elapsed*.9+rest.x*4+rest.y)*fall;const neighbour=(p.getZ(Math.max(0,i-1))+p.getZ(Math.min(p.count-1,i+1)))*.5;old.z=z;p.setZ(i,z+velocity+(rest.z-z)*.016+(neighbour-z)*.03+wind);}
   p.needsUpdate=true;c.mesh.geometry.computeVertexNormals();moving=true;
  }
  return moving;
 }
 return {interactions,lightSources,curtains,mirrors,update,blocks:p=>colliders.some(fn=>fn(p)),setCurtains(open){curtainTarget=open?.24:1;},get curtainsOpen(){return curtainTarget<.5;},get lampOn(){return !!lampSrc.enabled;},setLamp(on){lampSrc.enabled=!!on;syncLamp();return lampSrc.enabled;},toggleLamp(){lampSrc.enabled=!lampSrc.enabled;syncLamp();return lampSrc.enabled;}};
}
