import {World,Body,Box,Sphere,Vec3,SAPBroadphase,Material,ContactMaterial} from 'cannon-es';
import {BODY_RADIUS} from './plan.js';

// Package C — cannon-es. Capsule movement stays in movement.js (R08 / wall-slide).
// Kinematic player proxy only pushes low-mass props. Doors stay in door-physics.js.
export function createPhysicsWorld(){
 const world=new World({gravity:new Vec3(0,-9.82,0)});
 world.broadphase=new SAPBroadphase(world);
 world.allowSleep=true;
 world.defaultContactMaterial.friction=.35;
 world.defaultContactMaterial.restitution=.05;
 const defaultMat=new Material('default');
 const propMat=new Material('prop');
 world.addContactMaterial(new ContactMaterial(defaultMat,propMat,{friction:.45,restitution:.08}));
 world.addContactMaterial(new ContactMaterial(propMat,propMat,{friction:.4,restitution:.05}));

 const floor=new Body({mass:0,material:defaultMat,type:Body.STATIC});
 floor.addShape(new Box(new Vec3(40,.05,40)));
 floor.position.set(0,-.05,0);
 world.addBody(floor);

 const dynamics=[];
 const statics=[];
 let player=null;
 let lastPx=null,lastPz=null;

 function addStaticBox(cx,cy,cz,hx,hy,hz){
  const body=new Body({mass:0,material:defaultMat,type:Body.STATIC});
  body.addShape(new Box(new Vec3(hx,hy,hz)));
  body.position.set(cx,cy,cz);
  world.addBody(body);
  statics.push(body);
  return body;
 }

 // mesh must be a direct scene child (world pos = local pos) so sync stays simple.
 function addDynamicMesh(mesh,{mass=.28,radius=.1,shape='sphere',halfExtents=null}={}){
  mesh.updateMatrixWorld(true);
  const body=new Body({
   mass,
   material:propMat,
   linearDamping:.55,
   angularDamping:.65,
   allowSleep:true,
   sleepSpeedLimit:.22,
   sleepTimeLimit:.4
  });
  if(shape==='box'&&halfExtents)body.addShape(new Box(new Vec3(halfExtents[0],halfExtents[1],halfExtents[2])));
  else body.addShape(new Sphere(radius));
  body.position.set(mesh.position.x,mesh.position.y,mesh.position.z);
  world.addBody(body);
  mesh.userData.physicsBody=body;
  mesh.userData.dynamic=true;
  dynamics.push({body,mesh});
  return body;
 }

 function ensurePlayer(){
  if(player)return player;
  player=new Body({mass:0,type:Body.KINEMATIC,material:defaultMat});
  player.addShape(new Sphere(BODY_RADIUS+.03));
  world.addBody(player);
  return player;
 }

 function step(dt,camera){
  if(!dynamics.length)return false;
  ensurePlayer();
  const px=camera.position.x,pz=camera.position.z;
  if(lastPx!=null){
   const inv=dt>1e-4?1/dt:0;
   player.velocity.set((px-lastPx)*inv,0,(pz-lastPz)*inv);
  }
  lastPx=px;lastPz=pz;
  player.position.set(px,1.05,pz);
  world.step(1/60,Math.min(.05,Math.max(0,dt)),3);
  let moving=false;
  for(const {body,mesh} of dynamics){
   mesh.position.set(body.position.x,body.position.y,body.position.z);
   mesh.quaternion.set(body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w);
   if(body.velocity.lengthSquared()>1e-4||body.angularVelocity.lengthSquared()>1e-4)moving=true;
  }
  return moving;
 }

 function nudge(mesh,dir,impulse=1.35){
  const body=mesh?.userData?.physicsBody;
  if(!body||body.type===Body.STATIC)return false;
  body.wakeUp();
  const d=dir||{x:0,y:0,z:1};
  const len=Math.hypot(d.x,d.z)||1;
  body.applyImpulse(new Vec3(d.x/len*impulse,.25*impulse,d.z/len*impulse),new Vec3(0,0,0));
  return true;
 }

 function dispose(){
  for(const b of statics)world.removeBody(b);
  for(const {body} of dynamics)world.removeBody(body);
  if(player)world.removeBody(player);
  dynamics.length=0;statics.length=0;player=null;
 }

 return{
  world,addStaticBox,addDynamicMesh,step,nudge,dispose,
  get dynamicCount(){return dynamics.length;},
  get staticCount(){return statics.length;}
 };
}
