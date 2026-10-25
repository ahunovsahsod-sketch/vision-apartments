import * as T from 'three';
import {point,toPlan,roomById,ROOMS,inside,route,roundedRoute,visibleLine,walkable} from './plan.js?v=20261025-gesture12';
import {createMobileControls} from './mobile-controls.js?v=20261025-gesture12';

// Locomotion is in metres/seconds. Navigation, direct walking and looking share
// the same capsule driver; visual furniture never participates in collision tests.
export function createMovement({canvas,camera,schedule,pick,obstructed=()=>false,onFeedback=()=>{}}){
 const reduced=matchMedia('(prefers-reduced-motion:reduce)'),ray=new T.Raycaster(),floor=new T.Plane(new T.Vector3(0,1,0),0),keys=new Set(),velocity=new T.Vector3();
 const abort=new AbortController(),listen=(event,callback)=>canvas.addEventListener(event,callback,{signal:abort.signal});
 let disposed=false,physics=null,path=null,prefix=[],length=0,travel=0,speed=0,accel=0,phase=0,drag=null,lookGoal=null,lookFinal=null,settle=0,shortStep=null;
 let active=false,lastInteraction=0,current='living',baseEyeY=1.62,visualEyeY=1.62,blockedTime=0;
 function endTouchMotion(){path=null;shortStep=null;speed=accel=0;velocity.set(0,0,0);drag=null;lookGoal=null;settle=0;active=false;lastInteraction=performance.now();if(!disposed)schedule();}
 const mobile=createMobileControls({host:canvas.closest?.('.tour'),canvas,onChange:()=>{if(!disposed)schedule();},onStart:endTouchMotion,onEngage:endTouchMotion,onRelease:endTouchMotion,onLook:(dx,dy)=>{const angles=new T.Euler().setFromQuaternion(lookGoal||camera.quaternion,'YXZ');angles.y-=dx*.0032;angles.x=T.MathUtils.clamp(angles.x-dy*.0032,-.92,.85);angles.z=0;lookGoal=new T.Quaternion().setFromEuler(angles);settle=.6;lastInteraction=performance.now();if(!disposed)schedule();},onTap:(x,y)=>pickAt(x,y)});
 const pos=()=>toPlan(camera.position.x,camera.position.z),eye=()=>new T.Vector3(camera.position.x,baseEyeY,camera.position.z);
 function interval(distance){let lo=0,hi=prefix.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(prefix[mid]<=distance)lo=mid;else hi=mid-1;}return Math.min(path.length-2,lo);}
 function sample(distance){if(length<1e-8)return path.at(-1).clone();const i=interval(Math.max(0,Math.min(length,distance))),span=prefix[i+1]-prefix[i];return path[i].clone().lerp(path[i+1],span?T.MathUtils.clamp((distance-prefix[i])/span,0,1):0);}
 function closestProgress(position){let best=travel,bestDistance=Infinity;const start=interval(Math.max(0,travel-.08)),end=interval(Math.min(length,travel+1));for(let i=start;i<=end;i++){const a=path[i],b=path[i+1],delta=b.clone().sub(a),n=delta.lengthSq(),u=n?T.MathUtils.clamp(position.clone().sub(a).dot(delta)/n,0,1):0,p=a.clone().addScaledVector(delta,u),d=p.distanceToSquared(position);if(d<bestDistance){bestDistance=d;best=prefix[i]+Math.sqrt(n)*u;}}return Math.max(travel,best);}
 function orient(p,target){const c=new T.Object3D();c.position.copy(p);c.lookAt(target);return c.quaternion.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI));}
 function begin(points,final){
  const dense=[points[0]];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])));for(let j=1;j<=n;j++)dense.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}
  path=dense.map(p=>{const[x,z]=point(...p);return new T.Vector3(x,baseEyeY,z);});prefix=[0];length=0;for(let i=1;i<path.length;i++){length+=path[i].distanceTo(path[i-1]);prefix.push(length);}
  travel=0;accel=0;speed=Math.min(speed,.5);lookFinal=final;lookGoal=null;settle=0;shortStep=null;velocity.set(0,0,0);blockedTime=0;active=true;lastInteraction=performance.now();schedule();return true;
 }
 function go(id,immediate=false){const r=roomById[id];if(!r)return false;const[x,z]=point(...r.camera),[lx,lz]=point(...r.look),destination=new T.Vector3(x,1.62,z),q=orient(destination,new T.Vector3(lx,id.startsWith('bath')?.95:['master','bed1','bed3','office'].includes(id)?1.08:id==='kitchen'?1.15:id==='living'?1.27:1.45,lz));
  if(immediate){stop();camera.position.copy(destination);baseEyeY=visualEyeY=destination.y;camera.quaternion.copy(q);physics?.teleportCharacter?.(destination);current=id;return true;}
  const nav=roundedRoute(route(pos(),r.camera));if(!nav){onFeedback('Здесь нет свободного прохода');return false;}keys.clear();mobile.reset();current=id;return begin(nav,q);
 }
 function stop(clearInput=true){path=null;shortStep=null;speed=accel=0;velocity.set(0,0,0);active=false;camera.position.y=baseEyeY;settle=0;lookGoal=null;blockedTime=0;if(clearInput){keys.clear();mobile.reset();drag=null;}}
 function fallbackMove(start,delta){
  const result=start.clone(),n=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.z)/.035));
  for(let i=0;i<n;i++){const a=toPlan(result.x,result.z),dx=delta.x/n,dz=delta.z/n,full=toPlan(result.x+dx,result.z+dz);if(visibleLine(a,full)){result.x+=dx;result.z+=dz;continue;}const px=toPlan(result.x+dx,result.z);if(visibleLine(a,px))result.x+=dx;const pz=toPlan(result.x,result.z+dz);if(visibleLine(toPlan(result.x,result.z),pz))result.z+=dz;}
  return result;
 }
 function move(delta,dt){const before=eye(),after=physics?physics.moveCharacter(before,delta,dt):fallbackMove(before,delta);baseEyeY=after.y;camera.position.copy(after);return before.distanceTo(after);}
 function pickAt(x,y){const b=canvas.getBoundingClientRect();ray.setFromCamera(new T.Vector2((x-b.left)/b.width*2-1,-(y-b.top)/b.height*2+1),camera);pick?.(ray);lastInteraction=performance.now();schedule();}
 function step(x,y){
  const b=canvas.getBoundingClientRect(),ndc=new T.Vector2((x-b.left)/b.width*2-1,-(y-b.top)/b.height*2+1);ray.setFromCamera(ndc,camera);if(pick?.(ray))return;
  const hit=new T.Vector3(),origin=eye();let direction;if(ray.ray.intersectPlane(floor,hit)&&hit.distanceTo(origin)<20)direction=hit.sub(origin).setY(0).normalize();else direction=ray.ray.direction.clone().setY(0).normalize();if(!direction.lengthSq())return;
  stop();shortStep={direction,remaining:.70};onFeedback('',origin.clone().addScaledVector(direction,.7).setY(.02));lastInteraction=performance.now();active=true;schedule();
 }
 function walkTo(worldPoint){const end=toPlan(worldPoint.x,worldPoint.z);if(!walkable(...end))return false;const nav=roundedRoute(route(pos(),end));return nav?begin(nav,camera.quaternion.clone()):false;}
 function manualInput(){const x=(keys.has('d')?1:0)-(keys.has('a')?1:0)+mobile.state.x,y=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)+mobile.state.y;return new T.Vector2(x,y).clampLength(0,1);}
 function finishPath(){path=null;speed=accel=0;lookGoal=lookFinal.clone();settle=.6;camera.position.y=baseEyeY;}
 function update(dt){
  if(disposed)return false;dt=Math.min(.05,Math.max(.001,dt));let changed=false;const input=manualInput(),inputLength=input.length(),turnInput=(keys.has('arrowleft')?1:0)-(keys.has('arrowright')?1:0);if(turnInput){const angles=new T.Euler().setFromQuaternion(lookGoal||camera.quaternion,'YXZ');angles.y+=turnInput*1.35*dt;lookGoal=new T.Quaternion().setFromEuler(angles);settle=.6;}
  if(inputLength>.025||velocity.lengthSq()>.00001){
   if(inputLength>.025){path=null;shortStep=null;lookFinal=null;blockedTime=0;}
   const forward=new T.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new T.Vector3().crossVectors(forward,new T.Vector3(0,1,0)),target=forward.multiplyScalar(input.y*1.32).addScaledVector(right,input.x*1.32),rate=inputLength>.025?8:11;
   velocity.lerp(target,1-Math.exp(-rate*dt));if(velocity.length()<.002&&inputLength<.025)velocity.set(0,0,0);
   const displacement=velocity.clone().multiplyScalar(dt);if(obstructed(eye().add(displacement)))velocity.multiplyScalar(.86);const moved=move(displacement,dt);phase+=moved*2*Math.PI/.74;changed=true;
  }
  else if(shortStep){
   const desired=Math.min(.82,Math.sqrt(Math.max(0,2*1.9*shortStep.remaining)));speed=T.MathUtils.damp(speed,desired,9,dt);const amount=Math.min(shortStep.remaining,Math.max(.001,speed*dt)),delta=shortStep.direction.clone().multiplyScalar(amount);const moved=move(delta,dt);shortStep.remaining-=amount;phase+=moved*2*Math.PI/.74;changed=true;if(shortStep.remaining<.005){shortStep=null;speed=0;}if(moved<amount*.05){blockedTime+=dt;if(blockedTime>.25){shortStep=null;speed=0;}}else blockedTime=0;
  }
  else if(path){
   const remaining=length-travel,lookAhead=sample(Math.min(length,travel+.62)),body=sample(travel),future=sample(Math.min(length,travel+.10)),a=lookAhead.clone().sub(body).setY(0).normalize(),b=sample(Math.min(length,travel+1.1)).sub(lookAhead).setY(0).normalize(),turn=Math.max(0,a.dot(b));
   let desired=Math.min((length<1?.8:1.22)*(.45+.55*turn),Math.sqrt(Math.max(0,2*1.65*remaining)));if(obstructed(future)&&!physics)desired=0;
   const requested=T.MathUtils.clamp((desired-speed)*6,-2.4,1.8),jerk=8.5*dt;accel+=T.MathUtils.clamp(requested-accel,-jerk,jerk);speed=T.MathUtils.clamp(speed+accel*dt,0,1.35);
   let moved=0;
   if(physics){const target=sample(Math.min(length,travel+.10)).setY(baseEyeY),delta=target.sub(eye()).setY(0),distance=delta.length();if(distance)delta.multiplyScalar(Math.min(speed*dt,distance)/distance);obstructed(eye().add(delta));moved=move(delta,dt);travel=closestProgress(eye());if(eye().distanceTo(path.at(-1))<.085)finishPath();}
   else{let distance=Math.min(length,travel+speed*dt);const next=sample(distance),old=pos(),np=toPlan(next.x,next.z);if(!visibleLine(old,np)||obstructed(next)){speed=0;accel=0;distance=travel;}moved=distance-travel;travel=distance;camera.position.copy(sample(travel));}
   phase+=moved*2*Math.PI/.74;const aim=path?sample(Math.min(length,travel+.65)):eye();aim.y=baseEyeY-.03;
   if(path){const q=remaining>.15?orient(eye(),aim):lookFinal.clone(),blend=T.MathUtils.smoothstep(remaining,0,.65);q.slerp(lookFinal,1-blend);camera.quaternion.slerp(q,1-Math.exp(-dt*8));if(length-travel<.012){if(!physics)camera.position.copy(path.at(-1));finishPath();}}
   changed=true;if(moved<.00005&&desired>.12){blockedTime+=dt;if(blockedTime>3){path=null;speed=accel=0;onFeedback('Выберите свободное место или другую комнату');}}else blockedTime=0;
  }
  if(lookGoal){camera.quaternion.slerp(lookGoal,1-Math.exp(-dt*(drag?18:13)));changed=true;settle-=dt;if(!drag&&(camera.quaternion.angleTo(lookGoal)<.00015||settle<-.5)){camera.quaternion.copy(lookGoal);lookGoal=null;}}
  const heightSettling=Math.abs(visualEyeY-baseEyeY)>.00015;visualEyeY=T.MathUtils.damp(visualEyeY,baseEyeY,14,dt);if(!reduced.matches&&(inputLength>.025||velocity.lengthSq()>.00001||path||shortStep))camera.position.y=visualEyeY+Math.sin(phase*2)*.004;else camera.position.y=visualEyeY;changed=heightSettling||changed;
  active=Boolean(heightSettling||path||shortStep||lookGoal||turnInput||inputLength>.025||velocity.lengthSq()>.00001);return changed;
 }
 listen('pointerdown',e=>{if(e.pointerType==='touch'||e.button&&e.button!==0||drag&&drag.pointer!==e.pointerId)return;drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,pointer:e.pointerId,angles:new T.Euler().setFromQuaternion(camera.quaternion,'YXZ')};canvas.setPointerCapture?.(e.pointerId);canvas.focus({preventScroll:true});});
 listen('pointermove',e=>{if(e.pointerType==='touch'||!drag||e.pointerId!==drag.pointer)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<5)return;if(!drag.moved){path=null;shortStep=null;speed=accel=0;drag.moved=true;}const delta=e.clientX-drag.lastX,vertical=e.clientY-drag.lastY;drag.angles.y-=delta*.0032;drag.angles.x=T.MathUtils.clamp(drag.angles.x-vertical*.0032,-.92,.85);drag.angles.z=0;lookGoal=new T.Quaternion().setFromEuler(drag.angles);settle=.6;drag.lastX=e.clientX;drag.lastY=e.clientY;lastInteraction=performance.now();schedule();});
 listen('pointerup',e=>{if(e.pointerType==='touch'||!drag||e.pointerId!==drag.pointer)return;const moved=drag.moved;drag=null;if(!moved)pickAt(e.clientX,e.clientY);else schedule();});listen('pointercancel',e=>{if(e.pointerType==='touch')return;drag=null;lookGoal=null;});
 listen('keydown',e=>{const key=e.key.toLowerCase();if(!['escape','arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(key))return;e.preventDefault();if(key==='escape'){stop();schedule();return;}if(key==='arrowleft'||key==='arrowright'){path=null;shortStep=null;keys.add(key);schedule();return;}keys.add(key);lastInteraction=performance.now();schedule();});
 const keyup=e=>{keys.delete(e.key.toLowerCase());schedule();};listen('keyup',keyup);const blur=()=>{keys.clear();mobile.reset();velocity.set(0,0,0);drag=null;};if(typeof window!=='undefined'){window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);}
 return {go,step,walkTo,update,stop,setPhysics(driver){if(disposed)return false;physics=driver;physics?.teleportCharacter?.(eye());},get moving(){return Boolean(path||shortStep||velocity.lengthSq()>.00001||manualInput().length()>.025);},get active(){return active||Math.abs(visualEyeY-baseEyeY)>.00015||Boolean(drag)||mobile.state.engaged||keys.has('arrowleft')||keys.has('arrowright')||manualInput().length()>.025;},get position(){return pos();},get room(){return ROOMS.find(r=>inside(...pos(),r.poly))?.id||current;},get diagnostics(){return {travel,length,speed,next:path?sample(Math.min(length,travel+.10)).toArray():null,gesture:mobile.state.mode};},get lastInteraction(){return lastInteraction;},dispose(){disposed=true;abort.abort();stop();mobile.dispose();if(typeof window!=='undefined'){window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);}}};
}
