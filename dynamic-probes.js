import * as T from 'three';
import {ROOMS,inside,toPlan} from './plan.js?v=20261025-gesture12';

// Movable objects receive a room-scale probe derived from the same offline GI.
// Their direct light, shadows and reflections remain live while the probe provides
// the diffuse bounce that would otherwise disappear when an object becomes dynamic.
export function attachDynamicProbes({bakedGroup,targets}){
 const probes=new Map(),mix={value:0},clones=new Map(),created=[],visited=new Set();
 const roomAt=p=>{const q=toPlan(p.x,p.z);return ROOMS.find(r=>inside(...q,r.poly))?.id||'living';};
 bakedGroup.traverse(o=>{if(!o.isMesh||!o.geometry.attributes.bakedDay)return;const g=o.geometry;g.computeBoundingBox();const box=g.boundingBox,center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),id=roomAt(center),day=g.attributes.bakedDay,night=g.attributes.bakedNight,count=Math.min(200,day.count),a=new T.Vector3(),b=new T.Vector3();for(let i=0;i<count;i++){const j=Math.floor(i*day.count/count);a.add(new T.Vector3(day.getX(j),day.getY(j),day.getZ(j)));b.add(new T.Vector3(night.getX(j),night.getY(j),night.getZ(j)));}a.divideScalar(count);b.divideScalar(count);const weight=Math.max(.05,2*(size.x*size.y+size.x*size.z+size.y*size.z));if(!probes.has(id))probes.set(id,{day:new T.Vector3(),night:new T.Vector3(),weight:0});const p=probes.get(id);p.day.addScaledVector(a,weight);p.night.addScaledVector(b,weight);p.weight+=weight;});
 for(const p of probes.values()){p.day.divideScalar(p.weight);p.night.divideScalar(p.weight);}
 for(const target of new Set(targets)){if(!target)continue;target.updateWorldMatrix(true,true);const id=roomAt(target.getWorldPosition(new T.Vector3())),probe=probes.get(id)||probes.get('living');if(!probe)continue;
  target.traverse(o=>{if(visited.has(o)||!o.isMesh||Array.isArray(o.material)||!o.material.isMeshStandardMaterial)return;visited.add(o);const original=o.material,key=original.uuid+':'+id;let material=clones.get(key);if(!material){material=original.clone();const previous=original.onBeforeCompile;material.onBeforeCompile=function(shader,renderer){previous?.call(this,shader,renderer);shader.uniforms.dynamicProbeMix=mix;shader.uniforms.dynamicProbeDay={value:probe.day.clone().multiplyScalar(.7)};shader.uniforms.dynamicProbeNight={value:probe.night.clone().multiplyScalar(.7)};shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float dynamicProbeMix;\nuniform vec3 dynamicProbeDay;\nuniform vec3 dynamicProbeNight;').replace('#include <lights_fragment_maps>','#include <lights_fragment_maps>\nirradiance+=PI*max(vec3(0.),mix(dynamicProbeDay,dynamicProbeNight,dynamicProbeMix));');};material.customProgramCacheKey=()=>original.type+':dynamic-room-probe-v1';clones.set(key,material);created.push(material);}o.material=material;});
 }
 return{setMix(value){mix.value=value;},dispose(){for(const m of created)m.dispose();},stats:{rooms:probes.size,materials:clones.size}};
}
