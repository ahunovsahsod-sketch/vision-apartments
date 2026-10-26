import {doorSegment,segmentDistance,BODY_RADIUS} from './plan.js';

// Damped angular hinges with a swept personal-space guard. Both the camera
// controller and leaf animation query this same physical state.
export function createDoorPhysics(states){
 const clearance=BODY_RADIUS+.065;
 function sweep(d,next,body){
  const segment=doorSegment(d.d,d.angle),width=Math.hypot(segment[2]-segment[0],segment[3]-segment[1]);
  if(Math.hypot(body.x-d.point.x,body.z-d.point.z)>width+clearance)return next;
  // The tip travels at most 8 mm in one substep. Checking both angular
  // directions prevents a leaf from tunnelling through the visitor while opening.
  const count=Math.max(1,Math.ceil(Math.abs(next-d.angle)*width/.008));
  let angle=d.angle,gap=segmentDistance(body.x,body.z,segment);
  for(let i=1;i<=count;i++){
   const candidate=d.angle+(next-d.angle)*i/count,nextGap=segmentDistance(body.x,body.z,doorSegment(d.d,candidate));
   // If external state already overlaps the safety band, allow only escape.
   if(nextGap<clearance&&nextGap<gap-1e-8)return angle;
   angle=candidate;gap=nextGap;
  }
  return angle;
 }
 return {
  blocks(p){for(const door of states){if(!door.manual&&Math.hypot(p.x-door.point.x,p.z-door.point.z)<1.35){door.target=door.d.open;}if(segmentDistance(p.x,p.z,doorSegment(door.d,door.angle))<.21)return true;}return false;},
  update(dt,body){let moving=false;for(const d of states){
   const distance=Math.hypot(body.x-d.point.x,body.z-d.point.z);if(!d.manual)d.target=distance<1.75?d.d.open:0;
   // Softer spring (v9): smoother open/close, still settles quickly
   let velocity=d.velocity+((d.target-d.angle)*22-d.velocity*9.5)*dt,next=d.angle+velocity*dt;
   const safe=sweep(d,next,body);if(Math.abs(safe-next)>1e-10){next=safe;velocity=0;}
   d.velocity=velocity;d.angle=next;if(d.leaf)d.leaf.rotation.y=next;
   if(Math.abs(d.target-d.angle)+Math.abs(d.velocity)>.002)moving=true;
  }return moving;}
 };
}
