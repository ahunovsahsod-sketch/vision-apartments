import {ROOMS,roomById,planMarkup,inside} from './plan.js';
const root=document.getElementById('vision-apartment'),canvas=document.getElementById('apartment-canvas'),map=document.getElementById('floor-plan'),picker=document.getElementById('room-picker'),atelier=document.body.dataset.experience==='atelier';
map.innerHTML=planMarkup();
const svg=map.querySelector('svg'),ns='http://www.w3.org/2000/svg',marker=document.createElementNS(ns,'g');marker.classList.add('location-marker');marker.innerHTML='<path class="location-cone" d="M0,0 L-58,-118 Q0,-146 58,-118 Z"/><circle class="location-dot" r="18"/>';svg.append(marker);
const legend=document.getElementById('room-legend');legend.innerHTML=ROOMS.map((r,i)=>`<button type="button" data-room="${r.id}" aria-label="${r.name}, ${r.area} квадратных метров"><span class="room-number">${String(i+1).padStart(2,'0')}</span><span>${r.name}</span><span class="room-area">${r.area}</span></button>`).join('');
for(const r of ROOMS){const o=document.createElement('option');o.value=r.id;o.textContent=`${r.name} · ${r.area} м²`;picker.append(o);}picker.value='living';
const requestedRoom=new URLSearchParams(location.search).get('room');
let engine=null,current=roomById[requestedRoom]?requestedRoom:'living',lastActive='living',initializing=false,hintTimer;
const hint=document.querySelector('.gesture-hint'),feedback=document.querySelector('.interaction-feedback');
function hideHint(){hint.classList.add('is-dismissed');}
function choose(id){if(!roomById[id])return;hideHint();
 // R08 update 21:45: map room click = walk (path), not teleport. Floor click-to-move stays OFF.
 current=id;picker.value=id;root.dataset.destination=id;
 root.querySelectorAll('[data-room]').forEach(el=>el.setAttribute('aria-current',String(el.dataset.room===id)));
 const r=roomById[id];document.getElementById('current-room').textContent=r.name;document.getElementById('current-area').textContent=r.area+' м²';
 if(engine)engine.go(id,false);
 if(innerWidth<700){root.querySelector('.tour-navigation').classList.remove('is-expanded');root.querySelector('.map-size').setAttribute('aria-expanded','false');root.querySelector('.map-size').setAttribute('aria-label','Развернуть карту');}
}
root.addEventListener('click',e=>{const a=e.target.closest('a[data-room],button[data-room]');if(a){e.preventDefault();choose(a.dataset.room);}});picker.addEventListener('change',()=>choose(picker.value));
const loading=root.querySelector('.scene-loader'),error=root.querySelector('.scene-error');function fail(){loading.hidden=true;error.hidden=false;}canvas.addEventListener('tourerror',fail);
let loadStart=0,loadTimer;function loadingText(){let t=loading.querySelector('.load-text');if(!t){t=document.createElement('p');t.className='load-text';loading.append(t);}const s=Math.round((performance.now()-loadStart)/1000);const pct=canvas.dataset.loadProgress;const base=pct?`Загружаем интерьер… ${pct}%`:'Загружаем интерьер…';t.textContent=s>20?`${base} · ${s} с (слабый WebGL — подождите)`:s>5?`${base} · ${s} с`:base;}
async function initialize(){if(initializing)return;initializing=true;loadStart=performance.now();loadingText();loadTimer=setInterval(()=>{if(loading.hidden)clearInterval(loadTimer);else loadingText();},1000);try{const {createApartment}=await import('./scene.js');engine=createApartment(canvas,()=>{loading.hidden=true;hintTimer=setTimeout(hideHint,8500);},{atelier});try{window.__visionEngine=engine;}catch{}
 engine.onMove=({x,z,heading,walking,room})=>{marker.setAttribute('transform',`translate(${x},${z}) rotate(${heading})`);const here=room||ROOMS.find(r=>inside(x,z,r.poly))?.id;if(here){root.dataset.room=here;root.querySelectorAll('[data-room]').forEach(a=>a.setAttribute('aria-current',String(a.dataset.room===here)));const r=roomById[here];document.getElementById('current-room').textContent=r.name;document.getElementById('current-area').textContent=r.area+' м²';lastActive=here;if(!walking){picker.value=here;current=here;root.dataset.destination='';}}};
 let feedbackTimer;engine.onInteraction=text=>{feedback.textContent=text;feedback.hidden=!text;clearTimeout(feedbackTimer);if(text)feedbackTimer=setTimeout(()=>feedback.hidden=true,1700);};
 if(current!=='living')engine.go(current,true);engine.resize();}catch(e){fail();console.error('Apartment viewer could not start:',e);}}
const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.intersectionRatio>0)){initialize();observer.disconnect();}},{threshold:.01});observer.observe(root);
const enterLink=document.querySelector('.enter-tour');enterLink.addEventListener('pointerenter',initialize,{once:true});enterLink.addEventListener('focus',initialize,{once:true});canvas.addEventListener('pointerdown',hideHint,{once:true});
root.querySelector('.full-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await root.requestFullscreen();}catch{root.scrollIntoView({behavior:'smooth',block:'start'});}});document.addEventListener('fullscreenchange',()=>engine?.resize());
// Polish v37-prep: High/Med/Low/Auto quality tiers (manual override sticky until Auto)
const qualityBar=root.querySelector('.quality-control');
function syncQualityUI(q,manual,adaptive){
 if(!qualityBar)return;
 const active=manual?q:'auto';
 qualityBar.querySelectorAll('[data-quality]').forEach(btn=>{
  const on=btn.dataset.quality===active;
  btn.setAttribute('aria-pressed',String(on));
 });
 // Polish v38: Auto title reflects adaptive step honestly (soft-GPU may not trigger)
 const autoBtn=qualityBar.querySelector('[data-quality="auto"]');
 if(autoBtn){autoBtn.title=adaptive?'Авто: снижено до Med по FPS':'Авто по ширине экрана';autoBtn.dataset.adaptive=adaptive?'1':'';}
}
qualityBar?.addEventListener('click',e=>{
 const btn=e.target.closest('[data-quality]');if(!btn||!engine)return;
 const q=btn.dataset.quality;
 engine.setQuality(q);
 syncQualityUI(q==='auto'?'auto':q,q!=='auto',false);
});
canvas.addEventListener('qualitychange',e=>{
 const {quality,manual,adaptive}=e.detail||{};
 syncQualityUI(quality,!!manual,!!adaptive);
});

const mapSize=root.querySelector('.map-size');mapSize.addEventListener('click',()=>{const open=root.querySelector('.tour-navigation').classList.toggle('is-expanded');mapSize.setAttribute('aria-expanded',String(open));mapSize.setAttribute('aria-label',open?'Свернуть карту':'Развернуть карту');});
if(atelier){const slider=document.getElementById('daylight'),timeLabel=document.getElementById('daylight-value');slider.addEventListener('input',()=>{const v=Number(slider.value)/100;engine?.setTime(v);timeLabel.textContent=v<.45?'День':v<.8?'Закат':'Вечер';});document.getElementById('curtains-button').addEventListener('click',e=>{const open=engine?.toggleCurtains();e.currentTarget.setAttribute('aria-pressed',String(Boolean(open)));});const photoButton=document.getElementById('photo-button'),photoStatus=document.getElementById('photo-status');photoButton.addEventListener('click',()=>engine?.setPhoto());root.addEventListener('photostate',e=>{const {state,message}=e.detail;photoButton.setAttribute('aria-pressed',String(['preparing','rendering'].includes(state)));photoStatus.textContent=message;photoStatus.hidden=!message;});}
document.getElementById('preview-form').addEventListener('submit',e=>{e.preventDefault();const result=e.currentTarget.querySelector('.form-result');result.hidden=false;result.textContent='Предпросмотр: заявка не отправлена. Телефон для связи: +998 95 454 22 22.';});
// A horizontal swipe on the miniature plan advances through the apartment.
let mapGesture=null,skipMapClick=false;const roomSequence=['entry','living','kitchen','terrace','office','hall','bed3','master','wardrobe','bed1','bath1','bath2','bath3'];
map.addEventListener('pointerdown',e=>{mapGesture=[e.clientX,e.clientY];});
map.addEventListener('pointerup',()=>{mapGesture=null;});
map.addEventListener('pointercancel',()=>mapGesture=null);map.addEventListener('click',e=>{if(skipMapClick){e.preventDefault();e.stopPropagation();skipMapClick=false;}},true);
