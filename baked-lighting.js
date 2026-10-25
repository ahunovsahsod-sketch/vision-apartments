import * as T from 'three';

// Offline Cycles diffuse-indirect irradiance and AO. Direct sun, lamps, specular
// reflections, moving objects and the day/evening controls remain real time.
export async function loadBakedLighting({group,materials,quality='high',baseURL=new URL('./assets/baked/',import.meta.url),intensity=1,aoIntensity=.55,onProgress=()=>{}}={}){
 if(!group)throw new Error('A static lighting group is required');
 const fallbacks=new Map(),lookup=name=>fallbacks.get(name)||(materials instanceof Map?materials.get(name):materials?.[name]);
 let manifest;
 try{let response=await fetch(new URL(quality==='low'?'manifest-low.json':'manifest.json',baseURL));if(!response.ok&&quality==='low')response=await fetch(new URL('manifest.json',baseURL));if(!response.ok)return {applied:false,reason:'Baked lighting is not available',setMix(){},dispose(){}};manifest=await response.json();}catch{return {applied:false,reason:'Baked lighting is not available',setMix(){},dispose(){}};}
 if(manifest.version!==1||manifest.strideFloats!==15)throw new Error('Unsupported baked lighting version');
 for(const record of manifest.meshes){const source=record.fallbackMaterial||{},existing=lookup(record.materialName),incompatible=existing&&record.materialName.startsWith('custom_')&&(Math.abs((existing.metalness||0)-(source.metalness||0))>.25||Math.abs((existing.roughness??.8)-(source.roughness??.8))>.35||Boolean(existing.emissive?.getHex())!==Boolean((source.emission||[]).some(v=>v>.01)));if(!existing||incompatible){const material=new T.MeshStandardMaterial({color:new T.Color().fromArray(source.color||[.65,.6,.5]),roughness:source.roughness??.8,metalness:source.metalness??0,emissive:new T.Color().fromArray(source.emission||[0,0,0])});material.name=record.materialName;fallbacks.set(record.materialName,material);}}
 async function binary(name){
  const response=await fetch(new URL(name,baseURL));if(!response.ok)throw new Error('Cannot load baked geometry: '+name);
  let body=response.body,loaded=0,total=Number(response.headers.get('Content-Length'))||0;
  if(body&&typeof TransformStream!=='undefined')body=body.pipeThrough(new TransformStream({transform(chunk,controller){loaded+=chunk.byteLength;onProgress({phase:'download',loaded:total?Math.min(loaded,total):loaded,total});controller.enqueue(chunk);}}));
  // Hosts may already apply Content-Encoding:gzip. Inspect the actual bytes,
  // so a browser-decoded response is never decompressed a second time.
  let result=body?await new Response(body).arrayBuffer():await response.arrayBuffer();const magic=new Uint8Array(result,0,Math.min(2,result.byteLength));
  if(manifest.compressed&&magic[0]===0x1f&&magic[1]===0x8b){if(typeof DecompressionStream==='undefined'){const raw=name.replace(/\.gz$/,'');const fallback=await fetch(new URL(raw,baseURL));if(!fallback.ok)throw new Error('This browser cannot decompress the baked geometry');result=await fallback.arrayBuffer();}else result=await new Response(new Blob([result]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
  onProgress({phase:'download',loaded:total||loaded,total:total||loaded});return result;
 }

 let vertexData,indexData;
 if(manifest.codec==='meshopt'&&manifest.meshopt){
  const options=manifest.meshopt,{MeshoptDecoder}=await import(new URL(options.decoder,baseURL).href);await MeshoptDecoder.ready;
  const encoded=new Uint8Array(await binary(options.file));vertexData=new ArrayBuffer(options.decodedVertexBytes);indexData=new ArrayBuffer(options.decodedIndexBytes);
  let decoded=0;for(const record of manifest.meshes){if(decoded++%16===0)onProgress({phase:'decode',loaded:decoded,total:manifest.meshes.length});MeshoptDecoder.decodeVertexBuffer(new Uint8Array(vertexData,record.byteOffset,record.vertexCount*60),record.vertexCount,60,encoded.subarray(record.vertexEncodedOffset,record.vertexEncodedOffset+record.vertexEncodedLength),options.filter);MeshoptDecoder.decodeIndexBuffer(new Uint8Array(indexData,record.indexByteOffset,record.indexCount*4),record.indexCount,4,encoded.subarray(record.indexEncodedOffset,record.indexEncodedOffset+record.indexEncodedLength));}
 }else [vertexData,indexData]=await Promise.all([binary(manifest.geometry),binary(manifest.indices)]);
 const shared={mix:{value:0},intensity:{value:intensity},ao:{value:aoIntensity}},clones=new Map(),meshes=[],oldChildren=[...group.children];
 function bakedMaterial(original){if(clones.has(original))return clones.get(original);const material=original.clone(),previous=original.onBeforeCompile;clones.set(original,material);
  if(material.isMeshStandardMaterial||material.isMeshPhysicalMaterial){
   material.onBeforeCompile=function(shader,renderer){previous?.call(this,shader,renderer);shader.uniforms.bakedEveningMix=shared.mix;shader.uniforms.bakedGIIntensity=shared.intensity;shader.uniforms.bakedAOIntensity=shared.ao;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 bakedDay;\nattribute vec3 bakedNight;\nattribute float bakedAO;\nvarying vec3 vBakedDay;\nvarying vec3 vBakedNight;\nvarying float vBakedAO;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBakedDay=bakedDay;vBakedNight=bakedNight;vBakedAO=bakedAO;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float bakedEveningMix;\nuniform float bakedGIIntensity;\nuniform float bakedAOIntensity;\nvarying vec3 vBakedDay;\nvarying vec3 vBakedNight;\nvarying float vBakedAO;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',`#include <lights_fragment_maps>
     float localAO=clamp(vBakedAO,0.0,1.0);
     irradiance*=mix(1.0,mix(0.55,1.0,localAO),bakedAOIntensity);
     irradiance+=PI*max(vec3(0.0),mix(vBakedDay,vBakedNight,bakedEveningMix))*bakedGIIntensity;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
     reflectedLight.indirectSpecular*=mix(1.0,mix(0.7,1.0,clamp(vBakedAO,0.0,1.0)),bakedAOIntensity);
     reflectedLight.directDiffuse*=mix(1.0,mix(0.88,1.0,clamp(vBakedAO,0.0,1.0)),bakedAOIntensity);`);
   };
   material.customProgramCacheKey=()=>`baked-vertex-gi-v1:${original.customProgramCacheKey?.()||original.type}`;
  }return material;
 }
 for(const record of manifest.meshes){
  const array=new Float32Array(vertexData,record.byteOffset,record.vertexCount*15),compact=quality==='low'?new Float32Array(record.vertexCount*8):null;if(compact)for(let i=0;i<record.vertexCount;i++)compact.set(array.subarray(i*15,i*15+8),i*8);const interleaved=new T.InterleavedBuffer(compact||array,compact?8:15),geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.InterleavedBufferAttribute(interleaved,3,0));geo.setAttribute('normal',new T.InterleavedBufferAttribute(interleaved,3,3));geo.setAttribute('uv',new T.InterleavedBufferAttribute(interleaved,2,6));
  // Half floats reduce the extra lighting attributes on constrained devices.
  if(quality==='low'&&T.Float16BufferAttribute){const d=new Uint16Array(record.vertexCount*3),n=new Uint16Array(record.vertexCount*3),a=new Uint16Array(record.vertexCount);for(let i=0;i<record.vertexCount;i++){for(let c=0;c<3;c++){d[i*3+c]=T.DataUtils.toHalfFloat(array[i*15+8+c]);n[i*3+c]=T.DataUtils.toHalfFloat(array[i*15+11+c]);}a[i]=T.DataUtils.toHalfFloat(array[i*15+14]);}geo.setAttribute('bakedDay',new T.Float16BufferAttribute(d,3));geo.setAttribute('bakedNight',new T.Float16BufferAttribute(n,3));geo.setAttribute('bakedAO',new T.Float16BufferAttribute(a,1));}
  else{geo.setAttribute('bakedDay',new T.InterleavedBufferAttribute(interleaved,3,8));geo.setAttribute('bakedNight',new T.InterleavedBufferAttribute(interleaved,3,11));geo.setAttribute('bakedAO',new T.InterleavedBufferAttribute(interleaved,1,14));}
  geo.setIndex(new T.BufferAttribute(new Uint32Array(indexData,record.indexByteOffset,record.indexCount),1));geo.computeBoundingBox();geo.computeBoundingSphere();
  const mesh=new T.Mesh(geo,bakedMaterial(lookup(record.materialName)));mesh.name=record.id;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.bakedLighting=true;mesh.userData.bakedBounds=record.bounds;mesh.userData.bakedMaterialName=record.materialName;meshes.push(mesh);
 }
 group.clear();for(const geometry of new Set(oldChildren.filter(o=>o.isMesh).map(o=>o.geometry)))geometry.dispose();for(const mesh of meshes)group.add(mesh);group.userData.bakedLighting=true;onProgress({phase:'ready',loaded:1,total:1});
 return {applied:true,stats:{meshes:meshes.length,vertices:manifest.meshes.reduce((sum,r)=>sum+r.vertexCount,0),samples:manifest.samples,method:manifest.method,lod:manifest.lod||'high',payloadBytes:manifest.meshoptValidation?.gzipBytes||0,fallbackMaterials:[...fallbacks.keys()]},setMix(value){shared.mix.value=Math.max(0,Math.min(1,value));},setIntensity(value){shared.intensity.value=Math.max(0,value);},setAOIntensity(value){shared.ao.value=Math.max(0,Math.min(1,value));},dispose({restore=false}={}){for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();}for(const material of clones.values())material.dispose();for(const material of fallbacks.values())material.dispose();if(restore){for(const child of oldChildren)group.add(child);group.userData.bakedLighting=false;}}};
}
