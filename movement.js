import * as T from 'three';
import {point,toPlan,roomById,ROOMS,inside,walkable,route,roundedRoute} from './plan.js';

// R08 (2026-10-25): desktop = WASD + mouse look. Floor click-to-move OFF.
// Map room click = walk (path/steer) — not teleport (user 2026-10-25 ~21:45).
// Mobile DRAFT only: 1 finger hold = walk, 2nd finger = look; tour mode with explicit exit.
// Capsule + wall-slide + smooth accel/stop.
export function createMovement({canvas,camera,schedule,pick,obstructed=()=>false,onFeedback=()=>{}}){
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const coarse=matchMedia('(pointer:coarse)');
 let drag=null,lookVelocity=[0,0],lookGoal=null,settle=0,phase=0;
 let active=false,lastInteraction=0,current='living';
 let mobileTour=false; // draft: walk/look only while tour active
 let walkPtr=null,lookPtr=null; // pointerIds
 const keys=new Set(),vel=new T.Vector2(),WALK=1.35,ACC=4.5,DEC=6,TURN=1.9;
 let pathPts=null,pathIdx=0,pathLookQ=null,pathRoom=null,pathBlock=0;
 const pos=()=>toPlan(camera.position.x,camera.position.z);
 function clearPath(){pathPts=null;pathIdx=0;pathLookQ=null;pathRoom=null;pathBlock=0;}

 // nav=true: map-room path uses plan walkable only (door leaves must not abort room-to-room walk).
 // WASD thrash still uses furniture + door blockers via obstructed().
 function freeWorld(x,z,nav=false){
  const b=toPlan(x,z);if(!walkable(...b))return false;
  if(nav)return true;
  return !obstructed(new T.Vector3(x,1.62,z));
 }
 function slide(dx,dz,nav=false){
  const x=camera.position.x,z=camera.position.z;
  if(freeWorld(x+dx,z+dz,nav)){camera.position.x+=dx;camera.position.z+=dz;return 1;}
  if(Math.abs(dx)>1e-6&&freeWorld(x+dx,z,nav)){camera.position.x+=dx;return .55;}
  if(Math.abs(dz)>1e-6&&freeWorld(x,z+dz,nav)){camera.position.z+=dz;return .55;}
  if(Math.abs(dx)>1e-6&&freeWorld(x+dx*.5,z,nav)){camera.position.x+=dx*.5;return .3;}
  if(Math.abs(dz)>1e-6&&freeWorld(x,z+dz*.5,nav)){camera.position.z+=dz*.5;return .3;}
  return 0;
 }
 function orient(p,target){
  const c=new T.Object3D();c.position.copy(p);c.lookAt(target);
  const q=c.quaternion.clone();q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI));
  return q;
 }
 function setTour(on,reason=''){
  mobileTour=!!on;
  if(!mobileTour){walkPtr=null;lookPtr=null;keys.delete('w');canvas.style.touchAction='pan-y';if(reason)onFeedback(reason);}
  else{canvas.style.touchAction='none';onFeedback('Тур: 1 палец — ходьба, 2-й — взгляд · Esc / выход из полноэкрана — выход');}
  schedule();
 }
 // Sub-zones / auditor aliases (not separate ROOMS): dining sits inside living.
 const ROOM_ALIASES={
  dining:{id:'dining',name:'Столовая',camera:[400,905],look:[458,918]},
  'lounge-dining':{id:'lounge-dining',name:'Столовая',camera:[400,905],look:[458,918]},
  lounge:{id:'lounge',name:'Гостиная · диван',camera:[330,960],look:[364,944]},
  sofa:{id:'sofa',name:'Гостиная · диван',camera:[330,960],look:[364,944]},
  lamp:{id:'lamp',name:'Торшер',camera:[410,970],look:[450,1000]}
 };
 function resolveRoom(id){return roomById[id]||ROOM_ALIASES[id]||null;}
 // If camera sat inside furniture AABB (bad spawn / thrash), pull to nearest walkable plan cell so A* can start.
 function snapIfStuck(){
  let from=pos();
  if(walkable(...from))return from;
  for(let rad=8;rad<=140;rad+=8){
   for(let a=0;a<16;a++){
    const ang=a*Math.PI/8,x=from[0]+Math.cos(ang)*rad,z=from[1]+Math.sin(ang)*rad;
    if(!walkable(x,z))continue;
    const[wx,wz]=point(x,z);
    camera.position.x=wx;camera.position.z=wz;
    return [x,z];
   }
  }
  return from;
 }
 function go(id,immediate=false){
  const r=resolveRoom(id);if(!r)return false;
  const rid=r.id in roomById?r.id:(id==='dining'||id==='lounge-dining'?'living':id==='lounge'||id==='sofa'?'living':id==='lamp'?'living':id);
  const[x,z]=point(...r.camera),[lx,lz]=point(...r.look);
  const lookY=rid.startsWith('bath')?.95:['master','bed1','bed3','office'].includes(rid)?1.08:rid==='kitchen'?1.15:rid==='living'?1.27:1.45;
  const destination=new T.Vector3(x,1.62,z),q=orient(destination,new T.Vector3(lx,lookY,lz));
  if(immediate){
   clearPath();camera.position.copy(destination);camera.quaternion.copy(q);current=rid;vel.set(0,0);keys.clear();active=false;schedule();return true;
  }
  // Map room click → walk along A* path (not teleport). Floor click-to-move stays off.
  // Snap out of furniture first — kitchen spawn 300,810 used to sit inside island AABB.
  const from=snapIfStuck(),to=[r.camera[0],r.camera[1]];
  let path=route(from,to);
  if(path&&path.length>=2)path=roundedRoute(path)||path;
  else{
   // Last resort: snap toward destination nearest cells via a second route attempt from living-ish clear point
   const mid=walkable(330,900)?[330,900]:from;
   const via=route(from,mid),tail=route(mid,to);
   if(via&&tail&&via.length+tail.length>=3)path=roundedRoute([...via,...tail.slice(1)])||[...via,...tail.slice(1)];
   else path=null;
  }
  if(!path||path.length<2){onFeedback('Нет пути: '+r.name);return false;}
  pathPts=path;pathIdx=0;pathLookQ=q;pathRoom=rid;pathBlock=0;current=rid;vel.set(0,0);
  onFeedback('Идём: '+r.name);schedule();return true;
 }
 // Instant teleport in plan px for live proofs (door leaf in frame). Does not walk (R08).
 function warp(px,pz,lookPx=px,lookPz=pz){
  clearPath();
  const[x,z]=point(px,pz),[lx,lz]=point(lookPx,lookPz);
  const destination=new T.Vector3(x,1.62,z),q=orient(destination,new T.Vector3(lx,1.35,lz));
  camera.position.copy(destination);camera.quaternion.copy(q);vel.set(0,0);keys.clear();active=false;
  const here=ROOMS.find(r=>inside(px,pz,r.poly));if(here)current=here.id;schedule();return true;
 }
 function stop(){
  vel.set(0,0);keys.clear();active=false;camera.position.y=1.62;settle=0;lookGoal=null;lookVelocity=[0,0];
  walkPtr=null;lookPtr=null;clearPath();
 }
 function step(clientX,clientY){
  const bounds=canvas.getBoundingClientRect();
  const ndc=new T.Vector2((clientX-bounds.left)/bounds.width*2-1,-(clientY-bounds.top)/bounds.height*2+1);
  const ray=new T.Raycaster();ray.setFromCamera(ndc,camera);
  pick?.(ray);
 }

 function update(dt){
  dt=Math.min(.22,dt);let changed=false;
  // mobile draft: held walk pointer → forward
  if(walkPtr!=null)keys.add('w');
  // WASD cancels map walk so user stays in control
  if(pathPts&&(keys.has('w')||keys.has('a')||keys.has('s')||keys.has('d')||keys.has('arrowup')||keys.has('arrowdown')||keys.has('arrowleft')||keys.has('arrowright'))){clearPath();}
  // Path/steer toward map room target (nav=true: ignore closed-door rigid bodies)
  if(pathPts){
   while(pathIdx<pathPts.length-1){
    const wp=pathPts[pathIdx+1],[wx,wz]=point(wp[0],wp[1]);
    const dx=wx-camera.position.x,dz=wz-camera.position.z,dist=Math.hypot(dx,dz);
    if(dist<.18){pathIdx++;pathBlock=0;continue;}
    const e=new T.Euler().setFromQuaternion(camera.quaternion,'YXZ');
    // Three YXZ: forward = (-sin(y),0,-cos(y)) → face (dx,dz) with y=atan2(-dx,-dz)
    const wantY=Math.atan2(-dx,-dz);
    let dy=wantY-e.y;while(dy>Math.PI)dy-=Math.PI*2;while(dy<-Math.PI)dy+=Math.PI*2;
    e.y+=Math.max(-TURN*dt,Math.min(TURN*dt,dy));e.z=0;camera.quaternion.setFromEuler(e);
    const stepLen=WALK*dt,ux=dx/dist,uz=dz/dist;
    let moved=slide(ux*stepLen,uz*stepLen,true);
    if(!moved){
     // lateral unstick then short step; clear only after persistent block
     const lx=-uz,lz=ux;
     moved=slide(lx*stepLen*.7,lz*stepLen*.7,true)||slide(-lx*stepLen*.7,-lz*stepLen*.7,true)||slide(ux*stepLen*.4,uz*stepLen*.4,true);
    }
    if(!moved){
     pathBlock=(pathBlock||0)+1;
     if(pathBlock>22){clearPath();pathBlock=0;onFeedback('Проход закрыт');break;}
    }else{pathBlock=0;changed=true;lastInteraction=performance.now();}
    break;
   }
   if(pathPts&&pathIdx>=pathPts.length-1){
    if(pathLookQ){lookGoal=pathLookQ;settle=.55;}
    if(pathRoom)current=pathRoom;
    clearPath();pathBlock=0;changed=true;
   }
  }
  const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0);
  const strafe=(keys.has('d')?1:0)-(keys.has('a')?1:0);
  const yaw=(keys.has('arrowleft')?1:0)-(keys.has('arrowright')?1:0);
  if(yaw){const e=new T.Euler().setFromQuaternion(camera.quaternion,'YXZ');e.y+=yaw*TURN*dt;e.z=0;camera.quaternion.setFromEuler(e);lookGoal=null;changed=true;}
  if(forward||strafe||vel.lengthSq()>1e-6){
   const dir=new T.Vector3();camera.getWorldDirection(dir);dir.y=0;if(dir.lengthSq())dir.normalize();
   const right=new T.Vector3(-dir.z,0,dir.x);
   const want=new T.Vector2(dir.x*forward+right.x*strafe,dir.z*forward+right.z*strafe);
   if(want.lengthSq())want.normalize().multiplyScalar(WALK);
   const k=want.lengthSq()?ACC:DEC,dv=want.clone().sub(vel),cap=k*dt;if(dv.length()>cap)dv.setLength(cap);vel.add(dv);
   const moved=slide(vel.x*dt,vel.y*dt);
   if(!moved){vel.multiplyScalar(.12);if(forward||strafe)onFeedback('Проход закрыт');}
   else if(moved<1)vel.multiplyScalar(.9);
   const sp=vel.length();phase+=sp*dt*2*Math.PI/.72;
   camera.position.y=1.62+(reduced.matches?0:Math.sin(phase*2)*.006*Math.min(1,sp/.8));
   if(sp<.015&&!forward&&!strafe){vel.set(0,0);camera.position.y=1.62;}
   changed=true;lastInteraction=performance.now();
  }
  if(lookGoal&&!drag&&lookPtr==null){camera.quaternion.slerp(lookGoal,1-Math.exp(-dt*13));changed=true;settle-=dt;if(camera.quaternion.angleTo(lookGoal)<.00015||settle<-.5){camera.quaternion.copy(lookGoal);lookGoal=null;}}
  if(Math.hypot(...lookVelocity)>.00004&&!drag&&lookPtr==null){
   const e=new T.Euler().setFromQuaternion(camera.quaternion,'YXZ');
   e.y+=lookVelocity[0]*dt;e.x=T.MathUtils.clamp(e.x+lookVelocity[1]*dt,-.92,.85);e.z=0;
   camera.quaternion.setFromEuler(e);lookVelocity=lookVelocity.map(v=>v*Math.exp(-dt*12));changed=true;
  }
  const here=ROOMS.find(r=>inside(...pos(),r.poly));if(here)current=here.id;
  active=Boolean(lookGoal||keys.size||vel.lengthSq()>1e-6||Math.hypot(...lookVelocity)>.00004||Boolean(drag)||walkPtr!=null||lookPtr!=null||!!pathPts);
  return changed;
 }

 const LOOK_SLOP=10;
 canvas.addEventListener('pointerdown',e=>{
  if(e.button&&e.button!==0)return;
  // Desktop mouse: look drag / atelier pick — never walk-by-click
  if(e.pointerType==='mouse'){
   drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,time:performance.now()};
   canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});return;
  }
  // Touch DRAFT: only inside mobileTour (enter via fullscreen). Outside → page may scroll (touch-action:pan-y).
  if(!mobileTour){
   // Do not claim gesture for walk/look — let the browser scroll. Tip once.
   onFeedback('Для ходьбы на телефоне: полноэкран → 1 палец держать, 2-й — взгляд (черновик)');
   return;
  }
  e.preventDefault();
  canvas.focus({preventScroll:true});
  if(walkPtr==null){walkPtr=e.pointerId;keys.add('w');onFeedback('');schedule();return;}
  if(lookPtr==null){lookPtr=e.pointerId;drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,time:performance.now(),id:e.pointerId};schedule();return;}
 });
 canvas.addEventListener('pointermove',e=>{
  // Mouse look
  if(e.pointerType==='mouse'){
   if(!drag)return;
   const totalX=e.clientX-drag.x,totalY=e.clientY-drag.y;
   if(Math.hypot(totalX,totalY)<LOOK_SLOP)return;
   drag.moved=true;lookGoal=null;
   const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY,now=performance.now(),frameDt=Math.max(.016,(now-drag.time)/1000);
   const euler=new T.Euler().setFromQuaternion(camera.quaternion,'YXZ');
   euler.y-=dx*.0032;euler.x=T.MathUtils.clamp(euler.x-dy*.0032,-.92,.85);euler.z=0;
   camera.quaternion.setFromEuler(euler);
   lookVelocity=[T.MathUtils.clamp(-dx*.0032/frameDt,-1.5,1.5),T.MathUtils.clamp(-dy*.0032/frameDt,-1.5,1.5)];
   drag.lastX=e.clientX;drag.lastY=e.clientY;drag.time=now;lastInteraction=now;schedule();return;
  }
  // Touch look with 2nd finger only (draft). No mid-gesture handoff to native scroll.
  if(lookPtr!==e.pointerId||!drag)return;
  e.preventDefault();
  const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY,now=performance.now(),frameDt=Math.max(.016,(now-drag.time)/1000);
  drag.moved=true;lookGoal=null;
  const euler=new T.Euler().setFromQuaternion(camera.quaternion,'YXZ');
  euler.y-=dx*.0038;euler.x=T.MathUtils.clamp(euler.x-dy*.0038,-.92,.85);euler.z=0;
  camera.quaternion.setFromEuler(euler);
  lookVelocity=[T.MathUtils.clamp(-dx*.0038/frameDt,-1.5,1.5),T.MathUtils.clamp(-dy*.0038/frameDt,-1.5,1.5)];
  drag.lastX=e.clientX;drag.lastY=e.clientY;drag.time=now;lastInteraction=now;schedule();
 });
 function endPtr(e){
  if(e.pointerType==='mouse'){
   if(!drag)return;const moved=drag.moved;drag=null;
   if(!moved)step(e.clientX,e.clientY);else schedule();return;
  }
  if(e.pointerId===walkPtr){walkPtr=null;keys.delete('w');schedule();}
  if(e.pointerId===lookPtr){lookPtr=null;drag=null;schedule();}
 }
 canvas.addEventListener('pointerup',endPtr);
 canvas.addEventListener('pointercancel',endPtr);

 const KEYMAP={w:'w',ц:'w',s:'s',ы:'s',a:'a',ф:'a',d:'d',в:'d',arrowup:'arrowup',arrowdown:'arrowdown',arrowleft:'arrowleft',arrowright:'arrowright'};
 canvas.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(k==='escape'){e.preventDefault();stop();if(mobileTour)setTour(false,'Выход из тура');else schedule();return;}
  const m=KEYMAP[k];if(!m)return;e.preventDefault();keys.add(m);onFeedback('');schedule();
 });
 canvas.addEventListener('keyup',e=>{const m=KEYMAP[e.key.toLowerCase()];if(m){keys.delete(m);schedule();}});
 canvas.addEventListener('blur',()=>{keys.clear();walkPtr=null;lookPtr=null;});

 // Enter/exit tour with fullscreen (explicit). Outside tour → page scroll via touch-action:pan-y.
 const onFs=()=>{
  const fs=Boolean(document.fullscreenElement);
  if(coarse.matches)setTour(fs,fs?'':'Выход из тура');
 };
 document.addEventListener('fullscreenchange',onFs);

 function debugWalk(fwd=0,strafe=0,dt=.05){
  keys.clear();
  if(fwd>0)keys.add('w');else if(fwd<0)keys.add('s');
  if(strafe>0)keys.add('d');else if(strafe<0)keys.add('a');
  const before=pos();
  update(Math.min(.22,Math.max(.016,dt)));
  const after=pos();
  const moved=Math.hypot(after[0]-before[0],after[1]-before[1]);
  keys.clear();
  return {pos:after,moved,blocked:moved<.025&&!!(fwd||strafe)};
 }
 return {
  go,warp,step,update,stop,setTour,debugWalk,
  get moving(){return vel.lengthSq()>1e-4||!!pathPts;},
  get active(){return active||Boolean(drag)||walkPtr!=null;},
  get mobileTour(){return mobileTour;},
  get position(){return pos();},
  get room(){return ROOMS.find(r=>inside(...pos(),r.poly))?.id||current;},
  get lastInteraction(){return lastInteraction;}
 };
}
