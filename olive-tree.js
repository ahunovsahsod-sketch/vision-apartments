import * as THREE from 'three';

const LEVELS = {
 high: {leaves:720,twigs:36,leafRows:10,leafColumns:4,branchSides:10,potSides:96,soilGrains:38},
 medium: {leaves:420,twigs:30,leafRows:8,leafColumns:4,branchSides:8,potSides:72,soilGrains:26},
 low: {leaves:220,twigs:22,leafRows:6,leafColumns:2,branchSides:6,potSides:48,soilGrains:16}
};

function randomGenerator(seed){
 let state=(Number(seed)||296)>>>0;
 return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
}

// A closed, thin, cupped leaf with a softly raised central vein. Each side has
// its own normals and material, so the silver underside is an actual back face.
function oliveLeafGeometry(rows,columns){
 const positions=[],uvs=[],indices=[];
 for(let side=0;side<2;side++)for(let row=0;row<=rows;row++){
  const t=row/rows,outline=Math.pow(Math.sin(Math.PI*t),.82)*(1-.12*t);
  for(let column=0;column<=columns;column++){
   const u=column/columns*2-1;
   const x=u*.5*outline*(1+.045*Math.sin(t*7+u));
   const z=.052*t*t-.022*Math.sin(Math.PI*t)+.024*u*u*Math.sin(Math.PI*t)+.012*(1-Math.abs(u))*Math.sin(Math.PI*t);
   positions.push(x,t,z+(side===0?.0015:-.0015));uvs.push(column/columns,t);
  }
 }
 const sideVertices=(rows+1)*(columns+1),sideIndices=rows*columns*6;
 for(let side=0;side<2;side++)for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
  const a=side*sideVertices+row*(columns+1)+column,b=a+1,c=a+columns+1,d=c+1;
  if(side===0)indices.push(a,b,d,a,d,c);else indices.push(a,d,b,a,c,d);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.setIndex(indices);geometry.addGroup(0,sideIndices,0);geometry.addGroup(sideIndices,sideIndices,1);
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

function taperedBranch(curve,startRadius,endRadius,sides,segments,phase){
 const geometry=new THREE.TubeGeometry(curve,segments,1,sides,false),positions=geometry.attributes.position,uv=geometry.attributes.uv;
 const point=new THREE.Vector3(),radial=new THREE.Vector3();
 for(let i=0;i<positions.count;i++){
  const t=uv.getX(i),angle=uv.getY(i)*Math.PI*2;
  curve.getPointAt(t,point);radial.fromBufferAttribute(positions,i).sub(point);
  const taper=THREE.MathUtils.lerp(startRadius,endRadius,t),bark=1+.045*Math.sin(angle*7+t*9+phase)+.018*Math.sin(t*47-angle*3+phase);
  radial.multiplyScalar(taper*bark).add(point);positions.setXYZ(i,radial.x,radial.y,radial.z);
 }
 positions.needsUpdate=true;geometry.computeVertexNormals();return geometry;
}

function mergeBranches(geometries){
 let vertexCount=0;const flat=geometries.map(geometry=>{const result=geometry.toNonIndexed();vertexCount+=result.attributes.position.count;return result;});
 const position=new Float32Array(vertexCount*3),normal=new Float32Array(vertexCount*3),uv=new Float32Array(vertexCount*2);
 let offset=0;for(const geometry of flat){const count=geometry.attributes.position.count;position.set(geometry.attributes.position.array,offset*3);normal.set(geometry.attributes.normal.array,offset*3);uv.set(geometry.attributes.uv.array,offset*2);offset+=count;geometry.dispose();}
 for(const geometry of geometries)geometry.dispose();
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.BufferAttribute(position,3));result.setAttribute('normal',new THREE.BufferAttribute(normal,3));result.setAttribute('uv',new THREE.BufferAttribute(uv,2));result.computeBoundingBox();result.computeBoundingSphere();return result;
}

function microTexture(random){
 const size=128,data=new Uint8Array(size*size);
 for(let i=0;i<data.length;i++)data[i]=Math.round(128+(random()-.5)*38);
 const texture=new THREE.DataTexture(data,size,size,THREE.RedFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.NoColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}

/**
 * A movable potted olive tree; its pot bottom is y=0 and its final top is height.
 * Optional shared PBR materials: {pot, soil, bark, leafFront, leafBack}.
 * Only userData.collisionProxy represents a solid body. Branches and leaves
 * deliberately have no collision volumes. Do not flatten this moving group or
 * its InstancedMeshes into a static batch.
 */
export function createOliveTree({height=1.8,quality='high',seed=296,materials={}}={}){
 if(!Number.isFinite(height)||height<.9)throw new RangeError('Olive tree height must be at least 0.9 metres.');
 const level=LEVELS[quality]||LEVELS.high,random=randomGenerator(seed),root=new THREE.Group();
 root.name='PottedOliveTree';root.userData.dynamic=true;
 root.userData.collisionProxy={shape:'box',size:[.4,.55,.4],center:[0,.275,0],mass:12};
 root.userData.height=height;root.userData.quality=LEVELS[quality]?quality:'high';root.userData.seed=seed;root.userData.leafCount=level.leaves;
 const potTexture=materials.pot?null:microTexture(randomGenerator((Number(seed)>>>0)^0x394A)),soilTexture=materials.soil?null:microTexture(randomGenerator((Number(seed)>>>0)^0x720C));
 const potMaterial=materials.pot||new THREE.MeshStandardMaterial({color:'#c8bdab',roughness:.88,metalness:0,bumpMap:potTexture,bumpScale:.00075});
 const soilMaterial=materials.soil||new THREE.MeshStandardMaterial({color:'#3c3327',roughness:1,metalness:0,bumpMap:soilTexture,bumpScale:.0018});
 const barkMaterial=materials.bark||new THREE.MeshStandardMaterial({color:'#81705a',roughness:.91,metalness:0});
 let frontMaterial=materials.leafFront||new THREE.MeshStandardMaterial({color:'#626c47',roughness:.76,metalness:0});
 let backMaterial=materials.leafBack||new THREE.MeshStandardMaterial({color:'#a1a990',roughness:.91,metalness:0});
 // Two physical surfaces already provide both sides. A caller's DoubleSide
 // material would draw coincident opposite surfaces; clone instead of mutating it.
 if(frontMaterial.side!==THREE.FrontSide){frontMaterial=frontMaterial.clone();frontMaterial.side=THREE.FrontSide;}
 if(backMaterial.side!==THREE.FrontSide){backMaterial=backMaterial.clone();backMaterial.side=THREE.FrontSide;}

 // One continuous vessel section includes its underside, tapered body, rolled
 // rim, inner wall and inner bottom. Diameter .40 m, total vessel height .55 m.
 const profile=[[0,0],[.108,0],[.132,.012],[.142,.035],[.151,.105],[.174,.26],[.193,.485],[.199,.515],[.2,.535],[.197,.546],[.191,.55],[.184,.55],[.178,.541],[.177,.522],[.171,.48],[.152,.27],[.132,.085],[0,.085]];
 const pot=new THREE.Mesh(new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),level.potSides),potMaterial);pot.name='OliveCeramicPot';pot.castShadow=pot.receiveShadow=true;root.add(pot);
 const soil=new THREE.Mesh(new THREE.CylinderGeometry(.174,.171,.022,level.potSides),soilMaterial);soil.position.y=.493;soil.receiveShadow=true;soil.name='OliveSoil';root.add(soil);
 const soilGrains=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),barkMaterial,level.soilGrains),dummy=new THREE.Object3D(),grainRandom=randomGenerator((Number(seed)>>>0)^0x521D);soilGrains.name='OliveSoilGrains';
 for(let i=0;i<level.soilGrains;i++){const angle=grainRandom()*Math.PI*2,radius=Math.sqrt(grainRandom())*.164,size=.002+grainRandom()*.003;dummy.position.set(Math.cos(angle)*radius,.506+grainRandom()*.002,Math.sin(angle)*radius);dummy.rotation.set(grainRandom(),grainRandom()*Math.PI,grainRandom());dummy.scale.set(size,size*.4,size*.75);dummy.updateMatrix();soilGrains.setMatrixAt(i,dummy.matrix);}soilGrains.instanceMatrix.needsUpdate=true;soilGrains.receiveShadow=true;soilGrains.computeBoundingBox();soilGrains.computeBoundingSphere();root.add(soilGrains);

 const plant=new THREE.Group();plant.name='OliveLivingCrown';plant.position.y=.501;root.add(plant);
 const branchGeometries=[],trunk=new THREE.CatmullRomCurve3([
  new THREE.Vector3(0,0,0),new THREE.Vector3(.012,.19,-.006),new THREE.Vector3(-.012,.42,.012),new THREE.Vector3(.019,.65,.004),new THREE.Vector3(.032,.91,-.012),new THREE.Vector3(-.008,1.17,.014),new THREE.Vector3(.012,1.28,.004)
 ]);
 branchGeometries.push(taperedBranch(trunk,.022,.0038,level.branchSides,28,random()*6));
 for(let i=0;i<3;i++){const angle=i*Math.PI*2/3+.3,curve=new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(angle)*.058,-.003,Math.sin(angle)*.058),new THREE.Vector3(Math.cos(angle)*.027,.016,Math.sin(angle)*.027),new THREE.Vector3(0,.075,0)]);branchGeometries.push(taperedBranch(curve,.009,.007,level.branchSides,5,random()*6));}

 // Irregular woody boughs, not radial balls. The crown is narrower at the top,
 // and each terminal shoot carries opposite, decussate olive leaf pairs.
 const boughs=[];
 for(let i=0;i<7;i++){
  const t=.39+i*.074,origin=trunk.getPointAt(t),angle=i*2.399963+random()*.38,radius=.22+(1-t)*.20;
  const end=new THREE.Vector3(origin.x+Math.cos(angle)*radius,origin.y+.25+random()*.10,origin.z+Math.sin(angle)*radius*.82);
  const middle=origin.clone().lerp(end,.48).add(new THREE.Vector3(.012,.037,-.008));
  const curve=new THREE.CatmullRomCurve3([origin,middle,end]);boughs.push({curve,angle,index:i});branchGeometries.push(taperedBranch(curve,.0105-i*.00055,.0022,level.branchSides,12,random()*6));
 }

 const leaves=new THREE.InstancedMesh(oliveLeafGeometry(level.leafRows,level.leafColumns),[frontMaterial,backMaterial],level.leaves);leaves.name='OliveLanceolateLeaves';leaves.castShadow=leaves.receiveShadow=true;
 const matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),xAxis=new THREE.Vector3(),normal=new THREE.Vector3();
 let leafIndex=0;
 const pairsPerTwig=level.leaves/(2*level.twigs);
 for(let i=0;i<level.twigs;i++){
  const bough=boughs[i%boughs.length],along=.38+.60*((Math.floor(i/boughs.length)+.35+random()*.20)/Math.ceil(level.twigs/boughs.length));
  const start=bough.curve.getPointAt(Math.min(.98,along)),shootAngle=bough.angle+(random()-.5)*1.75;
  const length=.19+random()*.105,spread=.10+random()*.075;
  const end=start.clone().add(new THREE.Vector3(Math.cos(shootAngle)*spread,length,Math.sin(shootAngle)*spread));
  const middle=start.clone().lerp(end,.53).add(new THREE.Vector3((random()-.5)*.035,.012,(random()-.5)*.035)),shoot=new THREE.CatmullRomCurve3([start,middle,end]);
  branchGeometries.push(taperedBranch(shoot,.0026,.00055,Math.max(5,level.branchSides-2),7,random()*6));
  for(let node=0;node<pairsPerTwig;node++){
   const t=.13+.82*(node+.20+random()*.22)/pairsPerTwig,nodePosition=shoot.getPointAt(Math.min(.99,t)),tangent=shoot.getTangentAt(t).normalize();
   const cross=new THREE.Vector3().crossVectors(tangent,Math.abs(tangent.y)>.92?new THREE.Vector3(1,0,0):up).normalize();
   cross.applyAxisAngle(tangent,node*Math.PI/2+(random()-.5)*.42);
   for(const sign of[-1,1]){
    const outward=cross.clone().multiplyScalar(sign),direction=outward.clone().multiplyScalar(.86).addScaledVector(tangent,.32+random()*.22);direction.y+=.05+(random()-.5)*.24;direction.normalize();
    normal.copy(up).addScaledVector(direction,-up.dot(direction));if(normal.lengthSq()<.005)normal.set(0,0,1).addScaledVector(direction,-direction.z);normal.normalize();normal.applyAxisAngle(direction,(random()-.5)*1.05);
    if(random()<.09)normal.negate();xAxis.crossVectors(direction,normal).normalize();normal.crossVectors(xAxis,direction).normalize();matrix.makeBasis(xAxis,direction,normal);quaternion.setFromRotationMatrix(matrix);
    const leafLength=.048+random()*.029,leafWidth=.009+random()*.0055;scale.set(leafWidth,leafLength,leafLength);
    const petiole=nodePosition.clone().addScaledVector(outward,.0035);matrix.compose(petiole,quaternion,scale);leaves.setMatrixAt(leafIndex,matrix);
    leaves.setColorAt(leafIndex,new THREE.Color().setRGB(.84+random()*.16,.86+random()*.14,.80+random()*.16));leafIndex++;
   }
  }
 }
 leaves.instanceMatrix.setUsage(THREE.StaticDrawUsage);leaves.instanceMatrix.needsUpdate=true;if(leaves.instanceColor)leaves.instanceColor.needsUpdate=true;leaves.computeBoundingBox();leaves.computeBoundingSphere();plant.add(leaves);
 const wood=new THREE.Mesh(mergeBranches(branchGeometries),barkMaterial);wood.name='OliveTaperedWood';wood.castShadow=wood.receiveShadow=true;plant.add(wood);

 // Set the requested overall height without changing the rigid pot dimensions.
 root.updateMatrixWorld(true);const crownBounds=new THREE.Box3().setFromObject(plant),naturalHeight=crownBounds.max.y-plant.position.y;
 plant.scale.setScalar((height-plant.position.y)/naturalHeight);root.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
 root.userData.boundingDimensions=[size.x,size.y,size.z];root.userData.materialKeys=['pot','soil','bark','leafFront','leafBack'];
 root.traverse(object=>{if(object!==root)object.userData.collision=false;});return root;
}
