import * as T from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

// Geometry-guided a-trous filtering. Lighting is filtered independently from
// the actual surface colour, preserving wood grain and woven fabric detail.
export function createPhotoResolve(renderer,scene,camera){
 const options={type:T.HalfFloatType,depthBuffer:false};
 const albedo=new T.WebGLRenderTarget(1,1,{...options,depthBuffer:true});
 const normals=new T.WebGLRenderTarget(1,1,{...options,depthBuffer:true});normals.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
 const ping=new T.WebGLRenderTarget(1,1,options),pong=new T.WebGLRenderTarget(1,1,options);
 const normalMaterial=new T.MeshNormalMaterial({side:T.DoubleSide});
 let dirty=true,lastSample=-1;
 const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 const filter=new FullScreenQuad(new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{map:{value:null},albedo:{value:albedo.texture},normals:{value:normals.texture},depth:{value:normals.depthTexture},texel:{value:new T.Vector2(1,1)},stride:{value:1},first:{value:1},near:{value:camera.near},far:{value:camera.far}},vertexShader:vertex,
  fragmentShader:`varying vec2 vUv;uniform sampler2D map,albedo,normals,depth;uniform vec2 texel;uniform float stride,first,near,far;
  float viewDepth(float d){return near*far/(far-(far-near)*d);}
  vec3 lightAt(vec2 uv){vec3 c=texture2D(map,uv).rgb;if(first>.5&&texture2D(depth,uv).x<.99999)c/=max(texture2D(albedo,uv).rgb,vec3(.055));return min(c,vec3(18.));}
  void main(){float raw=texture2D(depth,vUv).x;if(raw>.99999){gl_FragColor=vec4(lightAt(vUv),1.);return;}
   vec3 n=normalize(texture2D(normals,vUv).rgb*2.-1.);float d=viewDepth(raw);vec3 sum=vec3(0.);float weight=0.;
   for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){vec2 uv=vUv+vec2(float(x),float(y))*texel*stride;float dd=texture2D(depth,uv).x;vec3 nn=normalize(texture2D(normals,uv).rgb*2.-1.);float nd=max(0.,dot(n,nn));float geom=pow(nd,24.)*exp(-abs(viewDepth(dd)-d)/max(.025,d*.009*stride));float w=exp(-float(x*x+y*y)*.32)*geom;if(dd>.99999)w=0.;sum+=lightAt(uv)*w;weight+=w;}
   gl_FragColor=vec4(sum/max(weight,.00001),1.);
  }`}));
 const output=new FullScreenQuad(new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{map:{value:ping.texture},albedo:{value:albedo.texture},depth:{value:normals.depthTexture}},vertexShader:vertex,
  fragmentShader:`varying vec2 vUv;uniform sampler2D map,albedo,depth;void main(){vec3 colour=texture2D(map,vUv).rgb;if(texture2D(depth,vUv).x<.99999)colour*=max(texture2D(albedo,vUv).rgb,vec3(.055));gl_FragColor=vec4(colour,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`.replace(';#include',';\n#include')}));
 function capture(w,h){
  for(const rt of[albedo,normals,ping,pong])rt.setSize(w,h);
  const background=scene.background,override=scene.overrideMaterial,tone=renderer.toneMapping,auto=renderer.autoClear,changes=[],temp=[];scene.background=new T.Color(0);renderer.toneMapping=T.NoToneMapping;renderer.autoClear=true;
  scene.traverse(o=>{if(!o.isMesh)return;const original=o.material,make=m=>{const basic=new T.MeshBasicMaterial({color:m.color||0xffffff,map:m.map||null,side:m.side,transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest||0,depthWrite:m.depthWrite});temp.push(basic);return basic;};changes.push([o,original]);o.material=Array.isArray(original)?original.map(make):make(original);});
  renderer.setRenderTarget(albedo);renderer.render(scene,camera);for(const[o,m]of changes)o.material=m;
  scene.overrideMaterial=normalMaterial;renderer.setRenderTarget(normals);renderer.render(scene,camera);scene.overrideMaterial=override;scene.background=background;renderer.toneMapping=tone;renderer.autoClear=auto;renderer.setRenderTarget(null);for(const m of temp)m.dispose();dirty=false;lastSample=-1;
 }
 return {invalidate(){dirty=true;},render(source,sample){
  if(dirty||albedo.width!==source.width||albedo.height!==source.height)capture(source.width,source.height);
  if(lastSample!==Math.floor(sample)){filter.material.uniforms.texel.value.set(1/source.width,1/source.height);let input=source.texture;
   for(let i=0;i<5;i++){const target=i%2===0?ping:pong;filter.material.uniforms.map.value=input;filter.material.uniforms.stride.value=2**i;filter.material.uniforms.first.value=i===0?1:0;renderer.setRenderTarget(target);filter.render(renderer);input=target.texture;}
   output.material.uniforms.map.value=input;lastSample=Math.floor(sample);
  }renderer.setRenderTarget(null);output.render(renderer);
 },dispose(){for(const rt of[albedo,normals,ping,pong])rt.dispose();normalMaterial.dispose();filter.material.dispose();filter.dispose();output.material.dispose();output.dispose();}};
}
