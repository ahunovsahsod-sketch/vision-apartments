export const PRESETS={
 high:{id:'high',label:'Высокое',texture:'4k',dpr:2,maxPixels:3840,shadow:4096,ao:true,bloom:true,aoScale:1,leaves:720,maxBodies:36},
 medium:{id:'medium',label:'Среднее',texture:'2k',dpr:1.5,maxPixels:2560,shadow:2048,ao:true,bloom:true,aoScale:.6,leaves:420,maxBodies:24},
 low:{id:'low',label:'Низкое',texture:'1k',dpr:1,maxPixels:1600,shadow:1024,ao:false,bloom:false,aoScale:.5,leaves:220,maxBodies:12}
};
export function chooseQuality(){
 let saved='auto';try{saved=localStorage.getItem('vision-quality')||'auto';}catch{}const requested=new URLSearchParams(location.search).get('quality')||saved;
 const mobile=matchMedia('(pointer:coarse)').matches&&/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent),cores=navigator.hardwareConcurrency||4,memory=navigator.deviceMemory||(mobile?4:8);
 const detected=mobile?(memory>=6&&cores>=6?'medium':'low'):(cores>=16&&memory>=32?'high':'medium');return{...PRESETS[requested in PRESETS?requested:detected],requested,mobile};
}
export function setupViewerUI(){
 const tour=document.querySelector('.tour'),quality=chooseQuality(),box=document.createElement('label');box.className='quality-control';box.innerHTML='<span class="sr-only">Качество изображения</span><select aria-label="Качество изображения"><option value="auto">Качество · Авто</option><option value="high">Высокое</option><option value="medium">Среднее</option><option value="low">Низкое</option></select>';tour.append(box);const select=box.querySelector('select');select.value=quality.requested;
 select.addEventListener('change',()=>{try{localStorage.setItem('vision-quality',select.value);}catch{}const u=new URL(location.href);u.searchParams.set('quality',select.value);u.searchParams.set('room',tour.dataset.room||'living');u.hash='apartment-tour';location.assign(u);});
 const loading=document.querySelector('.scene-loader');loading.innerHTML='<div class="loading-content"><span class="loading-mark">V</span><div class="loading-line"><i></i></div><b>0%</b><small>Подготовка квартиры</small></div>';
 let last=0;tour.addEventListener('loadprogress',e=>{const detail=e.detail||{},p=Math.max(last,Math.min(.99,detail.progress||0));last=p;loading.querySelector('i').style.transform=`scaleX(${p})`;loading.querySelector('b').textContent=Math.round(p*100)+'%';if(detail.label)loading.querySelector('small').textContent=detail.label;});
 const jump=document.createElement('button');jump.className='jump-mode';jump.type='button';jump.setAttribute('aria-pressed','false');jump.title='Выбрать: прогулка или мгновенный переход';jump.textContent='Пешком';document.querySelector('.map-header').insertBefore(jump,document.querySelector('.map-size'));jump.addEventListener('click',()=>{const instant=jump.getAttribute('aria-pressed')!=='true';jump.setAttribute('aria-pressed',String(instant));jump.textContent=instant?'Сразу':'Пешком';tour.dataset.jump=String(instant);});
 return quality;
}
