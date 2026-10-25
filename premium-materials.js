import * as T from 'three';

// The UV unit used here is one metre; each source's measured tile size is respected.
export function metricUV(geometry,matrix=null){
 const p=geometry.attributes.position,n=geometry.attributes.normal;if(!p||!n)return;const uv=new Float32Array(p.count*2),v=new T.Vector3(),normal=new T.Vector3(),nm=matrix?new T.Matrix3().getNormalMatrix(matrix):null;
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);normal.fromBufferAttribute(n,i);if(matrix){v.applyMatrix4(matrix);normal.applyMatrix3(nm).normalize();}const x=Math.abs(normal.x),y=Math.abs(normal.y),z=Math.abs(normal.z);let a,b;if(y>x&&y>z){a=v.x;b=v.z;}else if(x>z){a=v.z;b=v.y;}else{a=v.x;b=v.y;}uv[i*2]=a;uv[i*2+1]=b;}
 geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
}

function authoredAlbedo(texture,scale,offset){
 const canvas=document.createElement('canvas'),image=texture.image;canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const frame=ctx.getImageData(0,0,canvas.width,canvas.height),tables=offset.map(add=>Uint8Array.from({length:256},(_,i)=>{const s=i/255,linear=s<=.04045?s/12.92:((s+.055)/1.055)**2.4,v=Math.max(0,Math.min(.9,linear*scale+add)),out=v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055;return Math.round(out*255);}));
 for(let i=0;i<frame.data.length;i+=4){frame.data[i]=tables[0][frame.data[i]];frame.data[i+1]=tables[1][frame.data[i+1]];frame.data[i+2]=tables[2][frame.data[i+2]];}ctx.putImageData(frame,0,0);
 const result=new T.CanvasTexture(canvas);result.colorSpace=T.SRGBColorSpace;result.wrapS=result.wrapT=T.RepeatWrapping;result.repeat.copy(texture.repeat);result.rotation=texture.rotation;result.anisotropy=texture.anisotropy;result.userData.authoredColour=true;texture.dispose();return result;
}

export async function loadPremiumMaterials({scene,materials,renderer,quality,manager,onProgress=()=>{}}){
 const manifest=await fetch('assets/materials/manifest.json').then(r=>{if(!r.ok)throw new Error('PBR manifest unavailable');return r.json();}),loader=new T.TextureLoader(manager),cache=new Map();
 const high=quality.id==='high',small=quality.id==='low',aniso=Math.min(high?12:small?2:6,renderer.capabilities.getMaxAnisotropy());let completed=0;
 function load(path,color,tile,rotate=0){const key=path+'/'+rotate;if(!cache.has(key))cache.set(key,loader.loadAsync(path).then(tex=>{tex.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(1/tile.width,1/tile.height);tex.rotation=rotate;tex.anisotropy=aniso;completed++;onProgress(completed/18);return tex;}));return cache.get(key);}
 const sets={};
 for(const key of['oak','linen','jute','travertine','plaster']){const entry=manifest.materials[key],tile=entry.physicalTileMetres?.width?entry.physicalTileMetres:entry.recommendedDisplayTileMetres;
  const albedoSize=high&&['oak','travertine'].includes(key)?'4k':small?'1k':'2k',normalSize=small?'1k':'2k',ormSize=small?'1k':'2k',rotation=key==='oak'?Math.PI/2:0;
  const orm=(key==='travertine'?(entry.maps.ormHoned||entry.maps.orm_honed||entry.maps.orm):entry.maps.orm);sets[key]={entry,tile,map:await load(entry.maps.albedo[albedoSize],true,tile,rotation),normal:await load(entry.maps.normalOpenGL[normalSize],false,tile,rotation),orm:await load(orm[ormSize],false,tile,rotation)};
 }
 sets.linen.map=authoredAlbedo(sets.linen.map,.35,[.681018,.629435,.539817]);sets.jute.map=authoredAlbedo(sets.jute.map,.35,[.355,.286,.193]);sets.travertine.map=authoredAlbedo(sets.travertine.map,.15,[.6145,.5223,.383]);sets.oak.map=authoredAlbedo(sets.oak.map,.65,[.377,.283,.159]);
 const apply=(material,key,{color='#ffffff',normal=.2,roughness=1}={})=>{const s=sets[key];material.map=s.map;material.normalMap=s.normal;material.normalScale?.set(normal,normal);material.bumpMap=null;material.roughnessMap=s.orm;material.aoMap=s.entry.sourceAOAvailable?s.orm:null;material.aoMapIntensity=.65;material.metalness=0;material.roughness=roughness;material.color.set(color);material.userData.pbr=key;material.needsUpdate=true;};
 for(const m of[materials.oak,materials.walnut])apply(m,'oak',{normal:.18,roughness:1});
 apply(materials.wall,'plaster',{color:'#ffffff',normal:.12});materials.wall.color.setRGB(1.129087,1.048194,.856524);
 for(const m of[materials.stone,materials.tile,materials.terrace])apply(m,'travertine',{normal:.16,roughness:1});
 const fabricMaterials=new Set();scene.traverse(o=>{if(o.isMesh&&o.material?.sheen>0)fabricMaterials.add(o.material);});for(const m of fabricMaterials){const target=m===materials.ivory?new T.Color('#e5ddcf'):m.color.clone();apply(m,'linen',{color:'#ffffff',normal:.22,roughness:1});m.color.setRGB(target.r/.783538,target.g/.723055,target.b/.623960);}
 scene.traverse(o=>{if(!o.isMesh||Array.isArray(o.material))return;const m=o.material;if(m.name?.startsWith('rug_')||m.userData.rug)apply(m,'jute',{color:'#ffffff',normal:.38,roughness:1});});
 // Oak floor already has a real plank texture. Set its physically coherent scale,
 // rather than repeating a 4K image once across an arbitrary wall or room.
 const floorBase='assets/textures/';const size=high?'4k':small?'1k':'2k';
 materials.floor.map=await load(floorBase+'oak-clean-color-'+size+'.webp',true,{width:2.4,height:2.4});materials.floor.map.rotation=Math.PI/2;
 materials.floor.normalMap=await load(floorBase+'oak-clean-normal-'+size+'.webp',false,{width:2.4,height:2.4});materials.floor.normalMap.rotation=Math.PI/2;materials.floor.normalScale.set(.22,.22);materials.floor.bumpMap=null;materials.floor.roughnessMap=await load(floorBase+'oak-clean-rough-2k.webp',false,{width:2.4,height:2.4});materials.floor.roughnessMap.rotation=Math.PI/2;materials.floor.color.set('#fff5e1');materials.floor.roughness=.68;materials.floor.needsUpdate=true;
 // All generated solids receive face-local, metric UVs. Imported details keep their
 // authored unwrap, except recoloured upholstery where a metric weave is preferable.
 scene.updateMatrixWorld(true);scene.traverse(o=>{if(!o.isMesh||!o.geometry.attributes.normal||o.isReflector)return;let material=o.material;if(Array.isArray(material))return;if(material.userData.pbr||material===materials.floor){const params=o.geometry.parameters?{...o.geometry.parameters}:null;o.geometry=o.geometry.clone();if(params)o.geometry.parameters=params;metricUV(o.geometry,o.matrixWorld);}});
 return{manifest,sets};
}
