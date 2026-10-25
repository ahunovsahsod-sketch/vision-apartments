import * as T from 'three';

export function prepareBakeExport({scene,walls,ceilings,materials,dayLights,fills,interior,sun}){
 for(const[name,material]of Object.entries(materials))material.name='mat_'+name;
 const materialLookup=new Map(),meshes=[],spatialMaterials=[],exportRequested=new URLSearchParams(location.search).has('bake');let next=0,custom=0;
 const under=(o,parent)=>{while(o){if(o===parent)return true;o=o.parent;}return false;};
 scene.updateMatrixWorld(true);
 const mapped=new Map();
 function average(material){if(mapped.has(material))return mapped.get(material);const color=material.color?.clone()||new T.Color(1,1,1),image=material.map?.image;
  if(image){try{const canvas=document.createElement('canvas');canvas.width=canvas.height=48;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,48,48);const data=ctx.getImageData(0,0,48,48).data,result=[0,0,0];for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++){let v=data[i+c]/255;if(material.map.colorSpace===T.SRGBColorSpace)v=v<=.04045?v/12.92:((v+.055)/1.055)**2.4;result[c]+=v;}const n=data.length/4;color.multiply(new T.Color(result[0]/n,result[1]/n,result[2]/n));}catch{}}
  const value=color.toArray();mapped.set(material,value);return value;
 }
 scene.traverse(o=>{if(!o.isMesh||Array.isArray(o.material)||o.userData.dynamic||o.isReflector)return;for(let p=o.parent;p;p=p.parent)if(p.userData.dynamic)return;
  const m=o.material;if(m.transparent||m.opacity<.95)return;
  const bounds=new T.Box3().setFromObject(o),size=bounds.getSize(new T.Vector3());const architecture=under(o,walls)||under(o,ceilings)||Boolean(o.userData.room);
  if(!architecture&&(Math.max(size.x,size.y,size.z)<.90||Math.min(size.x,size.y,size.z)<.012))return;
  if(!m.name)m.name='custom_'+custom++;if(materialLookup.has(m.name)&&materialLookup.get(m.name)!==m){const other=materialLookup.get(m.name);if(other.color?.getHex()!==m.color?.getHex()||other.side!==m.side)m.name+='_'+custom++;}
  materialLookup.set(m.name,m);o.userData.bakeCandidate=true;spatialMaterials.push({material:m,min:bounds.min.clone(),max:bounds.max.clone()});if(!exportRequested)return;const geometry=o.geometry,positions=geometry.attributes.position,normals=geometry.attributes.normal,uv=geometry.attributes.uv;
  const matrix=o.matrixWorld,normalMatrix=new T.Matrix3().getNormalMatrix(matrix),v=new T.Vector3(),n=new T.Vector3(),pout=[],nout=[],uout=[];
  for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i).applyMatrix4(matrix);pout.push(v.x,v.y,v.z);if(normals)n.fromBufferAttribute(normals,i).applyNormalMatrix(normalMatrix);else n.set(0,1,0);nout.push(n.x,n.y,n.z);uout.push(uv?.getX(i)||0,uv?.getY(i)||0);}
  meshes.push({id:'static_'+String(next++).padStart(4,'0'),positions:pout,normals:nout,uv:uout,indices:geometry.index?Array.from(geometry.index.array):null,material:{name:m.name,color:average(m),roughness:m.roughness??.8,metalness:m.metalness||0,emission:m.emissive?.clone().multiplyScalar(m.emissiveIntensity||0).toArray()||[0,0,0],opacity:m.opacity??1}});
 });
 function lightData(light,intensity=light.intensity){const position=light.getWorldPosition(new T.Vector3()).toArray(),direction=new T.Vector3(0,0,-1).applyQuaternion(light.getWorldQuaternion(new T.Quaternion())).toArray();if(light.isDirectionalLight){const target=light.target.getWorldPosition(new T.Vector3());direction.splice(0,3,...target.sub(new T.Vector3(...position)).normalize().toArray());}return{type:light.isDirectionalLight?'sun':light.isRectAreaLight?'area':'point',position,direction,color:light.color.toArray(),intensity,width:light.width||0,height:light.height||0};}
 const fixed=[];scene.traverse(o=>{if((o.isPointLight||o.isRectAreaLight)&&!dayLights.includes(o)&&!fills.includes(o)&&!interior.lightSources.some(i=>i.light===o))fixed.push(o);});
 const day=[lightData(sun,3.3),...dayLights.map(l=>lightData(l,2.8)),...fills.map(l=>lightData(l,5)),...interior.lightSources.map(i=>lightData(i.light,i.base*.7)),...fixed.map(l=>lightData(l))];
 const evening=[lightData(sun,.08),...dayLights.map(l=>lightData(l,.05)),...fills.map(l=>lightData(l,12)),...interior.lightSources.map(i=>lightData(i.light,i.base*1.6)),...fixed.map(l=>lightData(l))];
 const data={version:1,coordinateSystem:'Y-up',meshes,lights:{day,evening},environment:{path:'assets/daylight-sky-2k.hdr',day:.38,evening:.025}};
 if(new URLSearchParams(location.search).has('bake')){const button=document.createElement('button');button.textContent='Export lighting source';Object.assign(button.style,{position:'fixed',left:'15px',top:'15px',zIndex:100,padding:'13px',borderRadius:'8px'});document.body.append(button);button.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='source-scene.json';link.click();button.textContent='Lighting source exported';setTimeout(()=>URL.revokeObjectURL(url),1000);});}
 return{materialLookup,spatialMaterials,meshCount:meshes.length};
}
