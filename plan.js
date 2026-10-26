// Apartment 296: positions traced from the published plan. Units below are pixels
// on apartment-296-plan.webp; conversion to metres happens in point().
export const CEILING = 3.40;
export const PX_PER_METRE = 49.5;
// Shared metric grid fitted to the room areas printed on the supplied drawing.
// All adjoining walls use the same transform. This is a reconstruction, not a survey.
export const METRIC_X = [[18, -7.717172], [62, -6.829762], [174, -4.556991], [184, -4.270147], [269, -2.568352], [282, -2.397457], [340, -1.120458], [352, -0.883252], [499, 1.959016], [786, 7.680871]];
export const METRIC_Z = [[18, -10.141414], [276, -4.878985], [362, -3.256684], [421, -1.71817], [543, 0.424561], [622, 2.001448], [636, 2.402258], [716, 3.932698], [818, 6.083237], [858, 6.729087], [1014, 9.920445]];
// Effective partition width is fitted, not a verified structural dimension.
export const WALL_THICKNESS = 0.105344;
function interpolate(value,grid,inverse=false){const a=inverse?1:0,b=1-a;let i=0;while(i<grid.length-2&&value>grid[i+1][a])i++;const u=(value-grid[i][a])/(grid[i+1][a]-grid[i][a]);return grid[i][b]+u*(grid[i+1][b]-grid[i][b]);}
export const point=(x,z)=>[interpolate(x,METRIC_X),interpolate(z,METRIC_Z)];
export const toPlan=(x,z)=>[interpolate(x,METRIC_X,true),interpolate(z,METRIC_Z,true)];
export const areaAudit=[{"id": "living", "target": 21, "model": 21}, {"id": "kitchen", "target": 11.9, "model": 11.9}, {"id": "terrace", "target": 33.1, "model": 33.1}, {"id": "office", "target": 11.4, "model": 11.4}, {"id": "bed1", "target": 15.7, "model": 15.7}, {"id": "master", "target": 22.1, "model": 22.1}, {"id": "bed3", "target": 15.2, "model": 15.2}, {"id": "wardrobe", "target": 5.4, "model": 5.4}, {"id": "bath1", "target": 3.6, "model": 3.601}, {"id": "bath2", "target": 2.6, "model": 2.601}, {"id": "bath3", "target": 3.9, "model": 3.9}, {"id": "hall", "target": 13.4, "model": 13.4}, {"id": "entry", "target": 8.5, "model": 8.5}];

export const ROOMS = [
 {id:'living',name:'Гостиная',short:'Гостиная',area:'21,0',poly:[[174,818],[269,818],[269,858],[499,858],[499,1014],[174,1014]],label:[340,963],camera:[224,896],look:[352,944]},
 {id:'kitchen',name:'Кухня',short:'Кухня',area:'11,9',poly:[[269,716],[499,716],[499,858],[269,858]],label:[389,787],camera:[312,778],look:[419,745]},
 {id:'terrace',name:'Терраса',short:'Терраса',area:'33,1',poly:[[499,716],[786,716],[786,1014],[499,1014]],label:[635,870],camera:[641,810],look:[604,943],outside:true},
 {id:'office',name:'Кабинет',short:'Кабинет',area:'11,4',poly:[[18,818],[174,818],[174,1014],[18,1014]],label:[96,939],camera:[131,872],look:[82,930]},
 {id:'bed1',name:'Спальня 1',short:'Спальня',area:'15,7',poly:[[184,18],[340,18],[340,276],[184,276]],label:[262,165],camera:[313,106],look:[245,196]},
 {id:'master',name:'Мастер-спальня',short:'Спальня',area:'22,1',poly:[[340,18],[499,18],[499,362],[282,362],[282,276],[340,276]],label:[417,151],camera:[421,306],look:[397,185]},
 {id:'bed3',name:'Спальня 2',short:'Спальня',area:'15,2',poly:[[352,362],[499,362],[499,636],[352,636]],label:[429,513],camera:[409,593],look:[409,484]},
 {id:'wardrobe',name:'Гардеробная',short:'Гардероб',area:'5,4',poly:[[184,276],[282,276],[282,421],[184,421]],label:[234,346],camera:[249,350],look:[200,337]},
 {id:'bath1',name:'Ванная 1',short:'С/у',area:'3,6',poly:[[184,421],[282,421],[282,543],[184,543]],label:[234,485],camera:[260,514],look:[232,447]},
 {id:'bath2',name:'Гостевой санузел',short:'С/у',area:'2,6',poly:[[184,543],[282,543],[282,622],[184,622]],label:[234,587],camera:[261,597],look:[217,564]},
 {id:'bath3',name:'Ванная 2',short:'С/у',area:'3,9',poly:[[352,636],[499,636],[499,716],[352,716]],label:[430,681],camera:[452,657],look:[452,695]},
 {id:'hall',name:'Коридор',short:'Коридор',area:'13,4',poly:[[282,362],[352,362],[352,716],[184,716],[184,622],[282,622]],label:[319,560],camera:[315,660],look:[316,419]},
 {id:'entry',name:'Прихожая',short:'Прихожая',area:'8,5',poly:[[62,716],[269,716],[269,818],[62,818]],label:[166,774],camera:[211,776],look:[257,721]}
];
export const roomById = Object.fromEntries(ROOMS.map(r => [r.id,r]));

// Centre lines, with real door openings left as gaps. No room is relocated.
export const WALLS = [
 [184,18,184,716,'outer'],[62,711,184,711,'outer'],[62,716,62,754,'outer'],[62,802,62,818,'outer'],
 [18,818,112,818],[150,818,187,818],[255,818,269,818],
 [18,818,18,1014,'outer'],[18,1014,499,1014,'outer'],[174,818,174,1014],
 [340,18,340,276],[184,276,218,276],[282,276,340,276],[282,276,282,379],[282,418,282,421],[184,421,282,421],
 [282,362,298,362],[342,362,499,362],[352,362,352,584],[352,632,352,716],
 [352,636,408,636],[454,636,499,636],[269,716,499,716],
 [282,421,282,490],[282,530,282,576],[282,616,282,622],[184,543,282,543],[184,622,282,622],
 [269,716,269,754],[269,799,269,858],[269,858,499,858],
 [499,716,499,754],[499,804,499,899],[499,947,499,1014]
];
export const DOORS = [
 {x:62,z:802,width:48,angle:-Math.PI/2,open:-Math.PI/2},
 {x:112,z:818,width:38,angle:0,open:-Math.PI/2},
 {x:187,z:818,width:34,angle:0,open:-Math.PI/2},{x:255,z:818,width:34,angle:Math.PI,open:Math.PI/2},
 {x:269,z:799,width:45,angle:-Math.PI/2,open:Math.PI/2},
 {x:282,z:418,width:39,angle:-Math.PI/2,open:Math.PI/2},
 {x:298,z:362,width:44,angle:0,open:Math.PI/2},
 {x:352,z:632,width:48,angle:-Math.PI/2,open:-Math.PI/2},
 {x:282,z:530,width:40,angle:-Math.PI/2,open:Math.PI/2},
 {x:282,z:616,width:40,angle:-Math.PI/2,open:Math.PI/2},
 {x:408,z:636,width:46,angle:0,open:-Math.PI/2},
 {x:499,z:804,width:50,angle:-Math.PI/2,open:-Math.PI/2,glass:true},
 {x:499,z:947,width:48,angle:-Math.PI/2,open:-Math.PI/2,glass:true}
];
// Loose furniture is modelled in metres in scene.js. Convert its complete
// world footprint back to plan coordinates, rather than assuming a uniform
// pixels-per-metre scale on the fitted metric grid.
function worldFootprint(x,z,width,depth){
 return [...toPlan(x-width/2,z-depth/2),...toPlan(x+width/2,z+depth/2)];
}
function footprintAt(px,pz,width,depth){const[x,z]=point(px,pz);return worldFootprint(x,z,width,depth);}
export const DETAIL_OBSTACLES = [
 {id:'office-chair',bounds:footprintAt(94,981,.65,.65)},
 {id:'terrace-coffee-table',bounds:footprintAt(608,910,.84,.84)},
 {id:'living-reading-light',bounds:footprintAt(450,1000,.4,.4)},
 {id:'lounge-dining',bounds:footprintAt(458,918,1.8,1.4)},
 ...[[248,195,1.8],[403,195,1.9],[414,495,1.65]].flatMap(([px,pz,width],bedIndex)=>{
  const[x,z]=point(px,pz);
  // bed() rotates PI/2 around Y: local Z becomes world X, local X becomes -Z.
  // Include the slightly wider stone tops (.51 x .49 m), not just the bases.
  return [-width/2-.38,width/2+.38].map((side,index)=>({
   id:`bed-${bedIndex+1}-nightstand-${index+1}`,
   bounds:worldFootprint(x-.76,z-side,.49,.51)
  }));
 })
];
export const OBSTACLES = [
 [194,143,311,249],[350,141,456,259],[360,442,467,544],
 [189,282,218,415],[355,331,494,358],
 [67,716,165,742],[34,909,150,959],
 [281,719,494,751],[303,789,463,852],
 [285,960,441,1010],[328,923,398,962],[280,858,487,883],
 [196,425,278,462],[189,489,216,529],[194,549,230,578],[232,550,273,574],
 [359,640,391,711],[416,681,438,712],[441,682,468,708],
 [551,945,672,983],[545,865,578,903],[631,865,665,903],[684,866,781,916],
 ...DETAIL_OBSTACLES.map(item=>item.bounds)
];
export const inside = (x,z,poly) => {
 let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if(((a[1]>z)!==(b[1]>z))&&(x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]))c=!c;
 }return c;
};
export function segmentDistance(x,z,s){
 const [a,b,c,d]=s,dx=c-a,dz=d-b,t=Math.max(0,Math.min(1,((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz||1)));
 return Math.hypot(x-a-t*dx,z-b-t*dz);
}
export const BODY_RADIUS=.17;
const worldWalls=WALLS.map(w=>[...point(w[0],w[1]),...point(w[2],w[3])]);
export function doorSegment(d,opening=d.open){
 const a=point(d.x,d.z),b=point(d.x+d.width*Math.cos(d.angle),d.z+d.width*Math.sin(d.angle));
 const width=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=-d.angle+opening;
 return[a[0],a[1],a[0]+width*Math.cos(angle),a[1]-width*Math.sin(angle)];
}
export function walkable(x,z){
 const p=point(x,z);
 if(!ROOMS.some(r=>inside(x,z,r.poly)))return false;
 // Camera capsule must remain inside the union of the rooms, including the terrace edge.
 for(let i=0;i<8;i++){const a=i*Math.PI/4,q=toPlan(p[0]+Math.cos(a)*BODY_RADIUS,p[1]+Math.sin(a)*BODY_RADIUS);if(!ROOMS.some(r=>inside(...q,r.poly)))return false;}
 if(worldWalls.some(w=>segmentDistance(...p,w)<WALL_THICKNESS/2+BODY_RADIUS))return false;
 if(DOORS.some(d=>segmentDistance(...p,doorSegment(d))<BODY_RADIUS+.065))return false;
 if(OBSTACLES.some(b=>{const a=point(b[0],b[1]),c=point(b[2],b[3]);return p[0]>a[0]-BODY_RADIUS&&p[0]<c[0]+BODY_RADIUS&&p[1]>a[1]-BODY_RADIUS&&p[1]<c[1]+BODY_RADIUS;}))return false;
 return true;
}
const STEP=10,cache=new Map(),edgeCache=new Map();
function nearest(p){
 let best=null,d=Infinity;for(let x=Math.round(p[0]/STEP)-8;x<=Math.round(p[0]/STEP)+8;x++)for(let z=Math.round(p[1]/STEP)-8;z<=Math.round(p[1]/STEP)+8;z++){
  if(walkable(x*STEP,z*STEP)){const dd=Math.hypot(x*STEP-p[0],z*STEP-p[1]);if(dd<d&&visibleLine(p,[x*STEP,z*STEP])){d=dd;best=[x,z];}}
 }return best;
}
function intersects(a,b,c,d){const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]))&&cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0;}
function segmentGap(a,b,w){const c=[w[0],w[1]],d=[w[2],w[3]];if(intersects(a,b,c,d))return 0;return Math.min(segmentDistance(...a,w),segmentDistance(...b,w),segmentDistance(...c,[...a,...b]),segmentDistance(...d,[...a,...b]));}
function crossesFurniture(a,b,box){
 const lo=point(box[0],box[1]).map(v=>v-BODY_RADIUS),hi=point(box[2],box[3]).map(v=>v+BODY_RADIUS);let enter=0,exit=1;
 for(let axis=0;axis<2;axis++){const d=b[axis]-a[axis];if(Math.abs(d)<1e-12){if(a[axis]<=lo[axis]||a[axis]>=hi[axis])return false;}else{const u=(lo[axis]-a[axis])/d,v=(hi[axis]-a[axis])/d;enter=Math.max(enter,Math.min(u,v));exit=Math.min(exit,Math.max(u,v));if(enter>=exit)return false;}}
 return enter<exit&&exit>0&&enter<1;
}
export function visibleLine(a,b){
 const aw=point(...a),bw=point(...b);
 if(worldWalls.some(w=>segmentGap(aw,bw,w)<WALL_THICKNESS/2+BODY_RADIUS))return false;
 if(DOORS.some(d=>segmentGap(aw,bw,doorSegment(d))<BODY_RADIUS+.065))return false;
 if(OBSTACLES.some(box=>crossesFurniture(aw,bw,box)))return false;
 const n=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])));for(let i=0;i<=n;i++)if(!walkable(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n))return false;return true;
}
// route() used by movement.go for map room click → walk (R08 update 2026-10-25 ~21:45).
export function route(from,to){
 const k=from.join(',')+'>'+to.join(',');if(cache.has(k))return cache.get(k);
 const start=nearest(from),end=nearest(to);if(!start||!end)return null;
 const key=p=>p[0]+','+p[1],endKey=key(end),open=new Map([[key(start),{p:start,g:0,f:0,prev:null}]]),closed=new Map();
 let found=null;
 while(open.size&&closed.size<14000){
  let q=null;for(const n of open.values())if(!q||n.f<q.f)q=n;
  const qk=key(q.p);open.delete(qk);closed.set(qk,q);if(qk===endKey){found=q;break;}
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const p=[q.p[0]+dx,q.p[1]+dz],pk=key(p);if(closed.has(pk)||!walkable(p[0]*STEP,p[1]*STEP))continue;
   if(dx&&dz&&(!walkable((q.p[0]+dx)*STEP,q.p[1]*STEP)||!walkable(q.p[0]*STEP,(q.p[1]+dz)*STEP)))continue;
   const ek=qk<pk?qk+'|'+pk:pk+'|'+qk;if(!edgeCache.has(ek))edgeCache.set(ek,visibleLine(q.p.map(v=>v*STEP),p.map(v=>v*STEP)));if(!edgeCache.get(ek))continue;
   const g=q.g+Math.hypot(dx,dz);if(!open.has(pk)||g<open.get(pk).g)open.set(pk,{p,g,f:g+Math.hypot(p[0]-end[0],p[1]-end[1]),prev:q});
  }
 }
 if(!found)return null;
 let path=[];for(let q=found;q;q=q.prev)path.push(q.p.map(n=>n*STEP));path.reverse();
 const simple=[path[0]];for(let i=0;i<path.length-1;){let j=path.length-1;while(j>i+1&&!visibleLine(path[i],path[j]))j--;simple.push(path[j]);i=j;}
 const result=[from,...simple,to].filter((p,i,a)=>i===0||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>.01);cache.set(k,result);return result;
}
export function roundedRoute(path){
 if(!path||path.length<3)return path;const result=[path[0]];
 for(let i=1;i<path.length-1;i++){
  const a=path[i-1],b=path[i],c=path[i+1],ab=Math.hypot(a[0]-b[0],a[1]-b[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]);
  let curve=null;
  for(const limit of[14,9,5]){
   const r=Math.min(limit,ab*.35,bc*.35),u=[b[0]+(a[0]-b[0])*r/ab,b[1]+(a[1]-b[1])*r/ab],v=[b[0]+(c[0]-b[0])*r/bc,b[1]+(c[1]-b[1])*r/bc];
   const points=Array.from({length:13},(_,j)=>{const t=j/12;return[(1-t)*(1-t)*u[0]+2*(1-t)*t*b[0]+t*t*v[0],(1-t)*(1-t)*u[1]+2*(1-t)*t*b[1]+t*t*v[1]];});
   if(points.every(p=>walkable(...p))&&points.slice(1).every((p,j)=>visibleLine(points[j],p))){curve=points;break;}
  }
  result.push(...(curve||[b]));
 }result.push(path.at(-1));return result.slice(1).every((p,i)=>visibleLine(result[i],p))?result:path;
}
export function planMarkup(){
 return `<svg viewBox="0 0 815 1040" role="group" aria-label="План квартиры — клик по комнате: идти пешком">${ROOMS.map((r,index)=>`<a href="#apartment-tour" data-room="${r.id}" aria-label="${r.name}, ${r.area} м²"><path class="room-shape" d="M${r.poly.map(p=>p.join(',')).join('L')}Z"/><text x="${r.label[0]}" y="${r.label[1]}" text-anchor="middle"><tspan x="${r.label[0]}">${String(index+1).padStart(2,'0')}</tspan></text></a>`).join('')}<g class="plan-walls">${WALLS.map(w=>`<path d="M${w[0]},${w[1]}L${w[2]},${w[3]}"/>`).join('')}</g></svg>`;
}
