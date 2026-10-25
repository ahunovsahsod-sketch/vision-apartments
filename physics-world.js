import * as T from 'three';
import RAPIER from './vendor/rapier/rapier.mjs';
import {ROOMS,WALLS,CEILING,WALL_THICKNESS,point,inside,doorSegment} from './plan.js?v=20261025-gesture12';

const FIXED_DT=1/60,EYE_OFFSET=.78,RADIUS=.20,HALF_HEIGHT=.62,SKIN=.02;
let initialization;
const v3=value=>Array.isArray(value)?{x:value[0],y:value[1],z:value[2]}:{x:value.x,y:value.y,z:value.z};
const quaternion=value=>typeof value==='number'?new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),value):value||new T.Quaternion();

/** Local, fixed-step Rapier world. All positions and dimensions are in metres. */
export async function createPhysicsWorld({quality='high',buildPlan=true}={}){
 initialization ||= RAPIER.init();await initialization;
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=FIXED_DT;
 world.integrationParameters.numSolverIterations=quality==='low'?4:6;
 const controller=world.createCharacterController(SKIN);
 controller.setSlideEnabled(true);controller.setNormalNudgeFactor(.001);controller.setUp({x:0,y:1,z:0});
 controller.setMaxSlopeClimbAngle(Math.PI/4);controller.setMinSlopeSlideAngle(Math.PI/3);
 controller.enableAutostep(.12,.22,false);controller.enableSnapToGround(.18);
 controller.setApplyImpulsesToDynamicBodies(true);controller.setCharacterMass(74);
 const character=world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT,RADIUS).setTranslation(0,.84,0).setFriction(0).setRestitution(0));
 const rigid=[],soft=[],colliderRecords=new Map(),doorBodies=[],kinematicObjects=[],staticColliders=[];
 let accumulator=0,dirty=true,disposed=false,verticalVelocity=0,lastEye=new T.Vector3(0,1.62,0),lastMove={grounded:false,collisions:0};
 const rigidLimit=quality==='low'?64:quality==='medium'?96:160;

 function addStaticBox(center,halfExtents,rotation=0,options={}){
  const q=quaternion(rotation),desc=RAPIER.ColliderDesc.cuboid(Math.max(.005,halfExtents.x??halfExtents[0]),Math.max(.005,halfExtents.y??halfExtents[1]),Math.max(.005,halfExtents.z??halfExtents[2])).setTranslation(...Object.values(v3(center))).setRotation(q).setFriction(options.friction??.72).setRestitution(options.restitution??.02);
  const collider=world.createCollider(desc);collider.userData={kind:options.kind||'static',...(options.userData||{})};staticColliders.push(collider);dirty=true;return collider;
 }
 function addStaticCylinder(center,radius,halfHeight,options={}){const collider=world.createCollider(RAPIER.ColliderDesc.cylinder(halfHeight,radius).setTranslation(...Object.values(v3(center))).setFriction(options.friction??.75));collider.userData={kind:options.kind||'static'};staticColliders.push(collider);dirty=true;return collider;}
 function addWall(a,b,height=CEILING,thickness=WALL_THICKNESS){const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);return addStaticBox([(a[0]+b[0])/2,height/2,(a[1]+b[1])/2],[length/2,height/2,thickness/2],-Math.atan2(dz,dx),{kind:'wall',friction:0});}
 function buildApartmentColliders(){
  const xs=[...new Set(ROOMS.flatMap(r=>r.poly.map(p=>p[0])))].sort((a,b)=>a-b),zs=[...new Set(ROOMS.flatMap(r=>r.poly.map(p=>p[1])))].sort((a,b)=>a-b);
  const occupied=(i,j)=>i>=0&&j>=0&&i<xs.length-1&&j<zs.length-1&&ROOMS.some(r=>inside((xs[i]+xs[i+1])/2,(zs[j]+zs[j+1])/2,r.poly));
  const edges=[];
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++)if(occupied(i,j)){
   const outside=ROOMS.some(r=>r.outside&&inside((xs[i]+xs[i+1])/2,(zs[j]+zs[j+1])/2,r.poly)),h=outside?1.1:CEILING;
   if(!occupied(i-1,j))edges.push([xs[i],zs[j],xs[i],zs[j+1],h]);
   if(!occupied(i+1,j))edges.push([xs[i+1],zs[j],xs[i+1],zs[j+1],h]);
   if(!occupied(i,j-1))edges.push([xs[i],zs[j],xs[i+1],zs[j],h]);
   if(!occupied(i,j+1))edges.push([xs[i],zs[j+1],xs[i+1],zs[j+1],h]);
  }
  // Coalesce adjacent perimeter boxes: the controller sees long clean faces,
  // not the tiny segmentation of the measured coordinate grid.
  const merged=[];for(const edge of edges.sort((a,b)=>(a[0]===a[2]?0:1)-(b[0]===b[2]?0:1)||a[0]-b[0]||a[1]-b[1])){
   let found=false;for(const m of merged){if(m[4]!==edge[4])continue;if(m[0]===m[2]&&edge[0]===edge[2]&&m[0]===edge[0]&&(m[3]===edge[1]||edge[3]===m[1])){m[1]=Math.min(m[1],edge[1]);m[3]=Math.max(m[3],edge[3]);found=true;break;}if(m[1]===m[3]&&edge[1]===edge[3]&&m[1]===edge[1]&&(m[2]===edge[0]||edge[2]===m[0])){m[0]=Math.min(m[0],edge[0]);m[2]=Math.max(m[2],edge[2]);found=true;break;}}
   if(!found)merged.push([...edge]);
  }
  for(const e of merged)addWall(point(e[0],e[1]),point(e[2],e[3]),e[4],e[4]<2?.06:WALL_THICKNESS);
  for(const w of WALLS){if(w[4]==='outer')continue;const mid=[(w[0]+w[2])/2,(w[1]+w[3])/2];if(merged.some(e=>e[0]===e[2]&&w[0]===w[2]&&e[0]===w[0]&&mid[1]>=e[1]&&mid[1]<=e[3]||e[1]===e[3]&&w[1]===w[3]&&e[1]===w[1]&&mid[0]>=e[0]&&mid[0]<=e[2]))continue;addWall(point(w[0],w[1]),point(w[2],w[3]));}
  const lo=point(xs[0],zs[0]),hi=point(xs.at(-1),zs.at(-1));addStaticBox([(lo[0]+hi[0])/2,-.12,(lo[1]+hi[1])/2],[(hi[0]-lo[0])/2+.25,.12,(hi[1]-lo[1])/2+.25],0,{kind:'floor'});
  for(const r of ROOMS.filter(r=>!r.outside)){const points=r.poly.map(p=>point(...p)),lo=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],hi=[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];addStaticBox([(lo[0]+hi[0])/2,CEILING+.05,(lo[1]+hi[1])/2],[(hi[0]-lo[0])/2,.05,(hi[1]-lo[1])/2],0,{kind:'ceiling'});}return {walls:merged.length+WALLS.filter(w=>w[4]!=='outer').length};
 }
 function addApartmentFurniture(){
  const at=(px,pz,w,h,d,y=h/2,rotation=0)=>{const[x,z]=point(px,pz);return addStaticBox([x,y,z],[w/2,h/2,d/2],rotation,{kind:'furniture'});};
  for(const[px,pz,w]of[[248,195,1.8],[403,195,1.9],[414,495,1.65]]){at(px,pz,w+.12,.67,2.2,.335,Math.PI/2);const[x,z]=point(px,pz);for(const side of[-w/2-.38,w/2+.38])addStaticBox([x-.76,.26,z-side],[.245,.26,.255],0,{kind:'furniture'});}
  at(201,349,.51,2.7,2.6);at(424,343,2.75,2.7,.5);at(115,729,1.8,2.7,.4);
  at(363,984,3,.52,.98,.33);const[sx,sz]=point(363,984);addStaticBox([sx,.80,sz+.35],[1.4,.275,.11],0,{kind:'furniture'});for(const x of[-1.39,1.39])addStaticBox([sx+x,.62,sz-.015],[.12,.225,.465],0,{kind:'furniture'});at(385,865,3.75,.3,.34,.39);const[lx,lz]=point(364,944);addStaticCylinder([lx,.21,lz],.69,.21,{kind:'furniture'});
  at(94,935,2.25,.8,.86);at(64,830,1.55,.5,.32);at(385,738,4.15,.92,.67);at(383,832,2.2,.84,.69);
  at(237,443,1.56,.57,.71);at(203,509,.66,.83,.43,.42,Math.PI/2);at(213,565,.43,.52,.6);at(254,561,.62,.83,.43);
  at(375,676,1.4,.57,.71,.285,Math.PI/2);at(428,693,.43,.52,.6);at(455,695,.5,.83,.43,.42,Math.PI);
  at(612,965,2.4,.85,.8);at(733,892,1.92,.15,.92);
 }
 function localBounds(object){
  object.updateWorldMatrix(true,true);const inverse=object.matrixWorld.clone().invert(),bounds=new T.Box3();
  object.traverse(o=>{if(!o.isMesh||!o.geometry)return;o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld)));});
  if(bounds.isEmpty())throw new Error('Physics object has no geometry');return bounds;
 }
 function addDynamicObject(object,{mass=1,friction=.68,restitution=.045,shape='box',radius,linearDamping=.28,angularDamping=.65,sleep=true,label='Предмет',collisionSize=null,collisionCenter=null}={}){
  if(rigid.length>=rigidLimit)return null;
  const box=localBounds(object),scale=object.getWorldScale(new T.Vector3()),size=(collisionSize?new T.Vector3(...Object.values(v3(collisionSize))):box.getSize(new T.Vector3())).multiply(scale),localCenter=collisionCenter?new T.Vector3(...Object.values(v3(collisionCenter))):box.getCenter(new T.Vector3()),offset=localCenter.clone().multiply(scale),center=localCenter.clone().applyMatrix4(object.matrixWorld),rotation=object.getWorldQuaternion(new T.Quaternion());size.set(Math.abs(size.x),Math.abs(size.y),Math.abs(size.z));
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(center.x,center.y,center.z).setRotation(rotation).setLinearDamping(linearDamping).setAngularDamping(angularDamping).setCanSleep(true).setCcdEnabled(true));
  const minHalf=Math.max(.001,Math.min(size.x,size.y,size.z)/2),bevel=Math.min(.008,minHalf*.2),contactSkin=Math.min(.004,minHalf*.08);
  let colliderDesc;if(shape==='sphere')colliderDesc=RAPIER.ColliderDesc.ball(radius??Math.max(size.x,size.y,size.z)/2);else if(shape==='cylinder')colliderDesc=RAPIER.ColliderDesc.cylinder(Math.max(.008,size.y/2),radius??Math.max(size.x,size.z)/2);else if(shape==='capsule'){const r=radius??Math.min(size.x,size.z)/2;colliderDesc=RAPIER.ColliderDesc.capsule(Math.max(.005,size.y/2-r),r);}else colliderDesc=RAPIER.ColliderDesc.roundCuboid(Math.max(.001,size.x/2-bevel),Math.max(.001,size.y/2-bevel),Math.max(.001,size.z/2-bevel),bevel);
  // Start awake even when sleep is requested: a book, pillow or pot must make
  // contact and settle under gravity before Rapier's automatic sleep takes over.
  // Forcing sleep after one broadphase pass can freeze a prop above its support.
  const collider=world.createCollider(colliderDesc.setMass(Math.max(.03,mass)).setFriction(friction).setRestitution(restitution).setContactSkin(contactSkin),body),record={object,body,collider,offset,initial:center.clone(),visualPosition:object.position.clone(),visualRotation:object.quaternion.clone(),label,lastTouched:0,type:'rigid'};
  colliderRecords.set(collider.handle,record);object.userData.dynamic=true;object.userData.physics=record;rigid.push(record);dirty=true;return record;
 }
 function addKinematicObject(object,{collisionSize=null,collisionCenter=null,friction=.45,label='Механизм'}={}){
  const bounds=localBounds(object),scale=object.getWorldScale(new T.Vector3()),size=(collisionSize?new T.Vector3(...Object.values(v3(collisionSize))):bounds.getSize(new T.Vector3())).multiply(scale),center=collisionCenter?new T.Vector3(...Object.values(v3(collisionCenter))):bounds.getCenter(new T.Vector3()),position=center.clone().applyMatrix4(object.matrixWorld),rotation=object.getWorldQuaternion(new T.Quaternion());
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x,position.y,position.z).setRotation(rotation));
  const collider=world.createCollider(RAPIER.ColliderDesc.cuboid(Math.max(.005,Math.abs(size.x)/2),Math.max(.005,Math.abs(size.y)/2),Math.max(.005,Math.abs(size.z)/2)).setFriction(friction),body),record={object,body,collider,center,label};collider.userData={kind:'mechanism',label};object.userData.dynamic=true;kinematicObjects.push(record);dirty=true;return record;
 }
 function updateKinematicObjects(){for(const record of kinematicObjects){record.object.updateWorldMatrix(true,false);const p=record.center.clone().applyMatrix4(record.object.matrixWorld),q=record.object.getWorldQuaternion(new T.Quaternion());record.body.setNextKinematicTranslation(p);record.body.setNextKinematicRotation(q);}}
 function addSoftObject(mesh,{mass=.8,mode='cloth',pinned=[],pinTop=false,label=mode==='cloth'?'Плед':'Подушка',selfContacts=false}={}){
  if(!mesh.isMesh)throw new Error('addSoftObject expects the actual THREE.Mesh');
  mesh.updateWorldMatrix(true,false);const originalParameters=mesh.geometry.parameters?{...mesh.geometry.parameters}:null;mesh.geometry=mesh.geometry.clone();if(originalParameters)mesh.geometry.parameters=originalParameters;const geometry=mesh.geometry,position=geometry.attributes.position,rest=[];for(let i=0;i<position.count;i++)rest.push(new T.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld));
  // A designed drape may intersect the simplified sofa back or arm boxes.
  // Resolve that initial overlap upward, before constraints acquire rest lengths;
  // otherwise the first collision impulse can crumple an already pinned cloth.
  if(mode==='cloth'&&pinTop){const inverse=mesh.matrixWorld.clone().invert(),local=new T.Vector3();for(let i=0;i<rest.length;i++){const p=rest[i];for(const collider of staticColliders){if(collider.userData?.kind!=='furniture'||!collider.containsPoint(p))continue;const upper=collider.projectPoint({x:p.x,y:CEILING+5,z:p.z},true);if(upper)p.y=Math.max(p.y,upper.point.y+.016);}local.copy(p).applyMatrix4(inverse);position.setXYZ(i,local.x,local.y,local.z);}position.needsUpdate=true;geometry.computeVertexNormals();}
  let desc,simulationRest,bindings;
  const params=geometry.parameters||{},nu=quality==='low'?8:12,nv=16;
  if(mode==='cloth'&&params.widthSegments&&params.heightSegments){
   const points=[],indices=[];for(let y=0;y<=nv;y++)for(let x=0;x<=nu;x++){const index=Math.round(y/nv*params.heightSegments)*(params.widthSegments+1)+Math.round(x/nu*params.widthSegments);points.push(...rest[index].toArray());}
   for(let y=0;y<nv;y++)for(let x=0;x<nu;x++){const a=y*(nu+1)+x,b=a+1,c=a+nu+1,d=c+1;indices.push(a,c,b,b,c,d);}
   desc=RAPIER.SoftBodyDesc.trimesh(new Float32Array(points),new Uint32Array(indices));simulationRest=points;
   bindings=rest.map((_,i)=>{const u=i%(params.widthSegments+1)/params.widthSegments*nu,v=Math.floor(i/(params.widthSegments+1))/params.heightSegments*nv,x=Math.min(nu-1,Math.floor(u)),y=Math.min(nv-1,Math.floor(v)),fu=u-x,fv=v-y,a=y*(nu+1)+x;return [[a,(1-fu)*(1-fv)],[a+1,fu*(1-fv)],[a+nu+1,(1-fu)*fv],[a+nu+2,fu*fv]];});
   const clothMaterial=RAPIER.SoftBodyMaterial.uniform(45,1);
   clothMaterial.bendSoftness={naturalFrequency:5,dampingRatio:1};
   desc.setShapeMatching(false).setVolumePreservation(false).setSelfContacts(selfContacts).setMaterial(clothMaterial);
   if(pinTop&&!pinned.length){let row=0,highest=-Infinity;for(let y=0;y<=nv;y++){let height=0;for(let x=0;x<=nu;x++)height+=points[(y*(nu+1)+x)*3+1];if(height>highest){highest=height;row=y;}}pinned=Array.from({length:nu+1},(_,x)=>row*(nu+1)+x);}
  }else{
   const bounds=new T.Box3().setFromPoints(rest),center=bounds.getCenter(new T.Vector3()),half=bounds.getSize(new T.Vector3()).multiplyScalar(.5);desc=RAPIER.SoftBodyDesc.cuboid(center,half,3,2,3).setShapeMatching(true).setVolumePreservation(true).setSoftness(7,.95);
  }
  if(!desc)return null;
  desc.setMass(mass).setLinearDamping(mode==='cloth'?2.2:1.4).setCanSleep(true).setParticleRadius(.012).setAdditionalSolverIterations(mode==='cloth'?2:1).setSurfaceCollider(RAPIER.ColliderDesc.ball(.012).setFriction(.85).setRestitution(.015));
  if(pinned.length)desc.setPinnedParticles(pinned);
  const body=world.createSoftBody(desc);simulationRest=Array.from(body.particlePositions());
  if(!bindings){bindings=rest.map(p=>{const distances=[];for(let j=0;j<simulationRest.length;j+=3){const d=p.distanceToSquared(new T.Vector3(simulationRest[j],simulationRest[j+1],simulationRest[j+2]));distances.push([j/3,1/Math.max(1e-5,d)]);}distances.sort((a,b)=>b[1]-a[1]);const nearest=distances.slice(0,8),sum=nearest.reduce((s,p)=>s+p[1],0);return nearest.map(p=>[p[0],p[1]/sum]);});}
  const record={type:'soft',object:mesh,body,rest,simulationRest,displayParticles:new Float32Array(simulationRest),bindings,pinned:[...pinned],label,lastTouched:0};soft.push(record);mesh.userData.dynamic=true;mesh.userData.physics=record;
  for(let i=0;i<body.numMeshes();i++){const c=body.meshCollider(i);if(c)colliderRecords.set(c.handle,record);}dirty=true;return record;
 }
 function syncVisuals(){
  const p=new T.Vector3(),q=new T.Quaternion(),parentQ=new T.Quaternion();let changed=false;
  for(const record of rigid){const t=record.body.translation(),r=record.body.rotation();q.set(r.x,r.y,r.z,r.w);p.set(t.x,t.y,t.z).sub(record.offset.clone().applyQuaternion(q));if(record.object.parent){record.object.parent.updateWorldMatrix(true,false);record.object.parent.worldToLocal(p);parentQ.copy(record.object.parent.getWorldQuaternion(parentQ)).invert();record.object.quaternion.copy(parentQ.multiply(q));}else record.object.quaternion.copy(q);record.object.position.copy(p);if(p.distanceToSquared(record.visualPosition)>4e-8||1-Math.abs(record.object.quaternion.dot(record.visualRotation))>1.25e-7){changed=true;record.visualPosition.copy(p);record.visualRotation.copy(record.object.quaternion);}}
  for(const record of soft){if(record.body.isSleeping())continue;const current=record.body.particlePositions();let moved=false;for(let i=0;i<current.length;i+=3)if((current[i]-record.displayParticles[i])**2+(current[i+1]-record.displayParticles[i+1])**2+(current[i+2]-record.displayParticles[i+2])**2>4e-8){moved=true;break;}if(!moved)continue;changed=true;record.displayParticles.set(current);const inverse=record.object.matrixWorld.clone().invert(),attribute=record.object.geometry.attributes.position;for(let i=0;i<record.rest.length;i++){p.copy(record.rest[i]);for(const[index,weight]of record.bindings[i]){const j=index*3;p.x+=(current[j]-record.simulationRest[j])*weight;p.y+=(current[j+1]-record.simulationRest[j+1])*weight;p.z+=(current[j+2]-record.simulationRest[j+2])*weight;}p.applyMatrix4(inverse);attribute.setXYZ(i,p.x,p.y,p.z);}attribute.needsUpdate=true;record.object.geometry.computeVertexNormals();record.object.geometry.computeBoundingSphere();}
  return changed;
 }
 function setDoorStates(states){for(const item of doorBodies)world.removeRigidBody(item.body);doorBodies.length=0;for(const state of states){const segment=doorSegment(state.d,state.angle??state.d.open),length=Math.hypot(segment[2]-segment[0],segment[3]-segment[1]),q=quaternion(-Math.atan2(segment[3]-segment[1],segment[2]-segment[0]));const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation((segment[0]+segment[2])/2,1.375,(segment[1]+segment[3])/2).setRotation(q));const collider=world.createCollider(RAPIER.ColliderDesc.cuboid(length/2,1.375,.022).setFriction(0),body);collider.userData={kind:'door',state};doorBodies.push({state,body,collider});}dirty=true;}
 function syncDoors(){for(const item of doorBodies){const segment=doorSegment(item.state.d,item.state.angle??item.state.d.open),q=quaternion(-Math.atan2(segment[3]-segment[1],segment[2]-segment[0]));item.body.setNextKinematicTranslation({x:(segment[0]+segment[2])/2,y:1.375,z:(segment[1]+segment[3])/2});item.body.setNextKinematicRotation(q);}}
 function step(dt){if(disposed)return false;accumulator=Math.min(accumulator+Math.max(0,dt),FIXED_DT*5);if(dirty&&accumulator<FIXED_DT)accumulator=FIXED_DT;let count=0;while(accumulator>=FIXED_DT){syncDoors();updateKinematicObjects();world.step();accumulator-=FIXED_DT;count++;dirty=false;}return count?syncVisuals():false;}
 function moveCharacter(eyePosition,desiredTranslation,dt=FIXED_DT){
  if(dirty)step(0);const start=new T.Vector3(eyePosition.x,eyePosition.y,eyePosition.z),delta=v3(desiredTranslation);lastEye.copy(start);
  character.setTranslation({x:start.x,y:start.y-EYE_OFFSET,z:start.z});
  verticalVelocity=Math.max(-3.2,verticalVelocity-9.81*Math.min(.05,dt));delta.y+=verticalVelocity*Math.min(.05,dt);
  const compute=d=>{world.timestep=Math.max(.001,Math.min(.05,dt));try{controller.computeColliderMovement(character,d,undefined,undefined,c=>c.handle!==character.handle);}finally{world.timestep=FIXED_DT;}return controller.computedMovement();};
  let applied=compute(delta);
  // Rounded door jambs can start a cast a few millimetres inside the controller's
  // *skin*, even though the physical capsule is still outside the wall. Recover
  // tangential motion with a second Rapier cast, biased gently away from contact.
  // This never bypasses a collider and is not used to force through movable props.
  const desiredLength=Math.hypot(delta.x,delta.z);
  if(desiredLength>.0005&&Math.hypot(applied.x,applied.z)<desiredLength*.28){
   const slide=new T.Vector3(delta.x,delta.y,delta.z),away=new T.Vector3();let movable=false;
   for(let i=0;i<controller.numComputedCollisions();i++){const contact=controller.computedCollision(i);if(contact.collider?.parent()?.isDynamic()){movable=true;break;}const normal=contact.normal1;if(Math.abs(normal.y)>.55)continue;const n=new T.Vector3(normal.x,0,normal.z).normalize(),into=slide.x*n.x+slide.z*n.z;if(into<0)slide.addScaledVector(n,-into);away.add(n);}
   if(!movable&&Math.hypot(slide.x,slide.z)>desiredLength*.12&&away.lengthSq()>.01){away.normalize();slide.addScaledVector(away,.012);const retry=compute(slide);if(Math.hypot(retry.x,retry.z)>Math.hypot(applied.x,applied.z))applied=retry;}
  }
  lastMove={grounded:controller.computedGrounded(),collisions:controller.numComputedCollisions()};if(lastMove.grounded)verticalVelocity=0;
  for(let i=0;i<controller.numComputedCollisions();i++){const c=controller.computedCollision(i);const entry=c?.collider&&doorBodies.find(d=>d.collider.handle===c.collider.handle);if(entry){const d=entry.state;d.target=d.d.open;d.manual=false;}}
  const result=start.add(new T.Vector3(applied.x,applied.y,applied.z));character.setTranslation({x:result.x,y:result.y-EYE_OFFSET,z:result.z});lastEye.copy(result);return result;
 }
 function teleportCharacter(eye){verticalVelocity=0;lastEye.copy(eye);character.setTranslation({x:eye.x,y:eye.y-EYE_OFFSET,z:eye.z});}
 function pushFromRay(ray,strength=.9){if(dirty)step(0);const r=new RAPIER.Ray(v3(ray.origin||ray.ray?.origin),v3(ray.direction||ray.ray?.direction)),hit=world.castRayAndGetNormal(r,3.5,true,undefined,undefined,character);if(!hit)return false;const record=colliderRecords.get(hit.collider.handle);if(!record)return false;const direction=ray.direction||ray.ray.direction,impulse={x:direction.x*strength,y:direction.y*strength+.04*strength,z:direction.z*strength},at={x:r.origin.x+r.dir.x*hit.timeOfImpact,y:r.origin.y+r.dir.y*hit.timeOfImpact,z:r.origin.z+r.dir.z*hit.timeOfImpact};if(record.type==='soft')record.body.applyImpulseAtPoint(impulse,at,.34,true);else record.body.applyImpulseAtPoint(impulse,at,true);record.lastTouched=performance.now();return {label:record.label,object:record.object,type:record.type};}
 if(buildPlan)buildApartmentColliders();step(0);
 return {world,rapier:RAPIER,controller,character,addStaticBox,addStaticCylinder,addWall,buildApartmentColliders,addApartmentFurniture,addDynamicObject,addKinematicObject,updateKinematicObjects,addSoftObject,setDoorStates,moveCharacter,teleportCharacter,pushFromRay,step,get lastMove(){return lastMove;},get activeBodies(){return rigid.filter(r=>!r.body.isSleeping()).length+soft.filter(r=>!r.body.isSleeping()).length;},get objects(){return [...rigid,...soft];},dispose(){if(disposed)return;disposed=true;world.free();}};
}
