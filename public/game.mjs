import * as T from '/vendor/three.module.js';
import {createScene} from './scene.mjs';
import {makeVehicle,updateVehicle} from './vehicle.mjs';
import {createCar,stepCar,solveTethers,nearestVehicle,FIXED_DT,resetCar} from '/shared/physics.mjs';
import {POIS,ROUTE,MAP_SIZE,terrain,surface,WATER,riverX,clamp,nearestAnchor} from '/shared/world.mjs';
const $=id=>document.getElementById(id), keys=new Set();
let renderer,world,camera,localMesh,p=createCar(),running=false,menu=true,photo=false,mapOpen=false,atmosphere=0,color='#8b9471',low=false,lights=true,winch=false,resetQueued=false,soundOn=true;
let socket=null,myId=null,roomCode='',online=false,peers=new Map(),lastServer=null,ping=0,toastTimer,elapsed=0,accumulator=0,last=performance.now(),lastSend=0,lastHUD=0,discovered=new Set();
let cameraMode=0,zoom=1,orbit=.2,orbitPitch=0,heroOrbit=2.95,pointer=null,dragged=false,lastInteraction=0;
const cameraNames=['追随镜头','开阔镜头','近景镜头'];
const colors=['#8b9471','#c5b58a','#6b8c91','#a8684b'];
const input=()=>({throttle:menu||mapOpen||photo?0:(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),steer:menu||mapOpen||photo?0:(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0),brake:menu||mapOpen||photo||keys.has('Space'),low,lights,winch,reset:resetQueued});
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
function fatal(e){$('loading').classList.add('hidden');$('fatal').classList.remove('hidden');$('fatal-message').textContent='请使用支持 WebGL 2 的 Chrome 或 Edge，并启用硬件加速。'+(e?.message?'（'+e.message+'）':'');console.error(e);}
function replaceCar(){if(localMesh)world.scene.remove(localMesh);localMesh=makeVehicle(color);world.scene.add(localMesh);updateVehicle(localMesh,p);}
function showMenu(value){menu=value;keys.clear();$('menu').classList.toggle('hidden',!value);$('hud').classList.toggle('hidden',value||photo);$('solo').firstElementChild.textContent=running?'继续探索':'独自出发';$('leave').classList.toggle('hidden',!online);if(value){camera.clearViewOffset();}else{camera.clearViewOffset();}updateMobile();}
function updateMobile(){$('mobile-controls').classList.toggle('hidden',menu||photo||mapOpen||!matchMedia('(pointer:coarse)').matches);}
function startSolo(){
 if(running){showMenu(false);return;}
 disconnect();p=createCar('local',$('name').value||'山野旅人');discovered=new Set();running=true;replaceCar();showMenu(false);audio.start();toast('松风山谷，欢迎你。先到营地看看，再沿山路出发。');
}
function disconnect(){if(socket){const old=socket;socket=null;old.close();}online=false;myId=null;roomCode='';for(const o of peers.values()){world.scene.remove(o.mesh);world.scene.remove(o.label);}peers.clear();}
function setConnection(message,error=false){$('connection-status').textContent=message;$('connection-status').style.color=error?'#efac83':'#d7d2af';}
async function connect(mode){
 const code=$('code').value.trim().toUpperCase();if(mode==='join'&&!/^[0-9A-Z]{4}$/.test(code)){setConnection('请输入 4 位房间邀请码',true);return;}
 disconnect();setConnection(mode==='match'?'正在寻找山谷里的同行者…':'正在连接房间…');
 const s=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);socket=s;
 const timeout=setTimeout(()=>{if(socket===s&&!online){s.close();setConnection('连接超时，请确认本地游戏服务正在运行',true);}},7000);
 s.addEventListener('open',()=>s.send(JSON.stringify({type:'join',mode,code,name:$('name').value||'山野旅人',color:colors.indexOf(color)})));
 s.addEventListener('message',e=>{if(socket!==s)return;let m;try{m=JSON.parse(e.data);}catch{return;}
  if(m.type==='error'){setConnection(m.message,true);if(!online){clearTimeout(timeout);socket=null;s.close();}return;}
  if(m.type==='welcome'){clearTimeout(timeout);online=true;myId=m.id;roomCode=m.code;p=m.players.find(o=>o.id===myId);p.input={};discovered=new Set(m.discovered);running=true;replaceCar();showMenu(false);audio.start();setConnection('');toast(`已进入房间 ${roomCode} · 邀请朋友使用同一服务器和邀请码加入`);lastSend=0;handleState(m);}
  if(m.type==='state')handleState(m);
  if(m.type==='pong')ping=Math.round(performance.now()-m.time);
  if(m.type==='horn')audio.horn(.08);
 });
 s.addEventListener('close',()=>{clearTimeout(timeout);if(socket!==s)return;online=false;socket=null;roomCode='';for(const o of peers.values()){world.scene.remove(o.mesh);world.scene.remove(o.label);}peers.clear();if(running){toast('与房间的连接已断开，当前可以继续单人探索。');p.id='local';}else setConnection('无法连接房间，请重试',true);});
 s.addEventListener('error',()=>{if(socket===s)setConnection('联机服务不可达，请检查服务是否启动',true);});
}
function playerLabel(name){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const c=canvas.getContext('2d');c.fillStyle='rgba(35,57,44,.84)';c.beginPath();c.roundRect(6,8,244,48,12);c.fill();c.font='24px "Microsoft YaHei", sans-serif';c.fillStyle='#f0e5bd';c.textAlign='center';c.fillText(name,128,41);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const sprite=new T.Sprite(new T.SpriteMaterial({map:tex,depthTest:false}));sprite.scale.set(3.3,.83,1);return sprite;}
function handleState(m){
 lastServer=m;
 for(const state of m.players){
  if(state.id===myId){
   if(m.type==='state'){const d=Math.hypot(state.x-p.x,state.z-p.z);if(d>5){Object.assign(p,state);}else{p.x+=(state.x-p.x)*.28;p.z+=(state.z-p.z)*.28;p.speed+=(state.speed-p.speed)*.25;let delta=state.yaw-p.yaw;delta=Math.atan2(Math.sin(delta),Math.cos(delta));p.yaw+=delta*.25;}p.discovered=state.discovered;p.travel=state.travel;p.winch=state.winch;p.anchor=state.anchor;}
   continue;
  }
  let peer=peers.get(state.id);if(!peer){const mesh=makeVehicle(colors[state.color%colors.length]),label=playerLabel(state.name);world.scene.add(mesh,label);peer={mesh,label,state:{...state},target:state};peers.set(state.id,peer);toast(`${state.name} 来到了山谷`);}if(peer.target.color!==state.color){world.scene.remove(peer.mesh);peer.mesh=makeVehicle(colors[state.color%colors.length]);world.scene.add(peer.mesh);}peer.target=state;
 }
 for(const [id,peer] of peers)if(!m.players.some(o=>o.id===id)){world.scene.remove(peer.mesh,peer.label);peers.delete(id);toast(`${peer.state.name} 离开了山谷`);}
 for(const id of m.discovered||[])discovered.add(id);
}
function toggleMap(){if(menu||!running)return;mapOpen=!mapOpen;$('full-map').classList.toggle('hidden',!mapOpen);keys.clear();updateMobile();if(mapOpen)renderMap($('large-map'),true);}
function togglePhoto(){if(menu||!running)return;photo=!photo;$('photo').classList.toggle('hidden',!photo);$('hud').classList.toggle('hidden',photo);keys.clear();updateMobile();if(photo)toast('拖动画面调整镜头，点击按钮保存风景');}
function cycleCamera(){cameraMode=(cameraMode+1)%3;orbit=0;orbitPitch=0;toast(cameraNames[cameraMode]);}
function toggleWinch(){if(winch){winch=false;toast('绞盘已收回');}else{const car=nearestVehicle(p,[...peers.values()].map(o=>o.state)),a=car||nearestAnchor(p);if(!a){toast('前方 23 米内无同行车辆，24 米内也无树木锚点');return;}winch=true;toast(car?`牵引绳连接 ${car.name} · 同伴缓慢前进即可协作脱困`:'绞盘连接树木 · 缓慢牵引中，按 E 收回');}}
function cycleWeather(){atmosphere=(atmosphere+1)%3;const text=['☀ 晴日','☾ 暮色','≋ 薄雾'][atmosphere];$('weather').textContent=text;$('menu-weather').textContent=text;if(running)toast(['秋日下午，能见度良好','暮色降临，打开车灯照亮前路','薄雾笼罩山谷，放慢速度'][atmosphere]);}
const audio={ctx:null,engine:null,gain:null,filter:null,start(){if(!soundOn)return;try{if(!this.ctx){this.ctx=new AudioContext();const o=this.ctx.createOscillator(),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter();o.type='sawtooth';f.type='lowpass';f.frequency.value=210;g.gain.value=0;o.connect(f).connect(g).connect(this.ctx.destination);o.start();this.engine=o;this.gain=g;this.filter=f;}this.ctx.resume();}catch{}},update(){if(!this.ctx)return;const t=this.ctx.currentTime;this.engine.frequency.setTargetAtTime(30+Math.abs(p.speed)*2.8+(keys.has('KeyW')?8:0),t,.12);this.filter.frequency.setTargetAtTime(150+Math.abs(p.speed)*15,t,.2);this.gain.gain.setTargetAtTime(soundOn&&running&&!menu?.022:0,t,.2);},horn(volume=.13){if(!soundOn)return;this.start();if(!this.ctx)return;const c=this.ctx,g=c.createGain(),o=c.createOscillator();o.type='triangle';o.frequency.value=330;g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.4);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+.42);}};
// The map is a real projection of the same heightfield used by driving and rendering.
const mapBase=document.createElement('canvas');mapBase.width=mapBase.height=440;const mapCtx=mapBase.getContext('2d');
function buildMap(){const image=mapCtx.createImageData(440,440);for(let z=0;z<440;z++)for(let x=0;x<440;x++){const wx=(x/440-.5)*MAP_SIZE,wz=(z/440-.5)*MAP_SIZE,h=terrain(wx,wz),s=surface(wx,wz),col=new T.Color(s.color);const shade=clamp(.72+(terrain(wx-2,wz-2)-h)*.06,.5,.98);col.multiplyScalar(shade);const rgb=col.getHex(),i=(z*440+x)*4;image.data[i]=rgb>>16;image.data[i+1]=rgb>>8&255;image.data[i+2]=rgb&255;image.data[i+3]=255;}mapCtx.putImageData(image,0,0);mapCtx.strokeStyle='#e5d3a178';mapCtx.lineWidth=2;mapCtx.beginPath();ROUTE.forEach(([x,z],i)=>{const px=(x/MAP_SIZE+.5)*440,py=(z/MAP_SIZE+.5)*440;i?mapCtx.lineTo(px,py):mapCtx.moveTo(px,py);});mapCtx.stroke();}
function renderMap(canvas,large=false){const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);c.drawImage(mapBase,0,0,w,h);c.fillStyle='#243e3022';c.fillRect(0,0,w,h);c.strokeStyle='#d1d9af20';c.lineWidth=1;for(let i=1;i<8;i++){c.beginPath();c.moveTo(w*i/8,0);c.lineTo(w*i/8,h);c.moveTo(0,h*i/8);c.lineTo(w,h*i/8);c.stroke();}
 const project=(x,z)=>[(x/MAP_SIZE+.5)*w,(z/MAP_SIZE+.5)*h];
 for(const poi of POIS){const [x,z]=project(poi.x,poi.z);c.beginPath();c.arc(x,z,large?8:3.5,0,6.283);c.fillStyle=discovered.has(poi.id)?'#dce8b9':'#edc67c';c.fill();c.strokeStyle='#324b3c';c.lineWidth=large?2:1;c.stroke();if(large){c.font='bold 14px "Microsoft YaHei",sans-serif';c.fillStyle='#283f30';c.fillText(`${poi.icon} ${poi.name}`,x+13,z+5);}}
 for(const peer of peers.values()){const [x,z]=project(peer.state.x,peer.state.z);c.fillStyle='#c7e5e3';c.beginPath();c.arc(x,z,large?5:3,0,6.283);c.fill();}
 const [x,z]=project(p.x,p.z);c.save();c.translate(x,z);c.rotate(-p.yaw);c.fillStyle='#fff6cf';c.strokeStyle='#344d3b';c.lineWidth=1.5;c.beginPath();c.moveTo(0,large?11:6);c.lineTo(large?-6:-4,large?-8:-5);c.lineTo(0,large?-5:-3);c.lineTo(large?6:4,large?-8:-5);c.closePath();c.fill();c.stroke();c.restore();
 if(large){$('map-legend').replaceChildren(...POIS.map(poi=>{const el=document.createElement('div'),b=document.createElement('b'),small=document.createElement('small');b.textContent=`${discovered.has(poi.id)?'✓':poi.icon} ${poi.name}`;small.textContent=poi.subtitle;el.append(b,small);return el;}));}
}
function updateHUD(){
 const speed=Math.round(Math.abs(p.speed)*3.6);$('speed').textContent=speed;$('gear').textContent=Math.abs(p.speed)<.15?'N':p.speed<0?'R':low?'L':String(Math.min(4,1+Math.floor(speed/17)));
 $('drive-mode').textContent=low?'4L · 低速四驱':'4H · 四驱';$('surface').textContent=surface(p.x,p.z).name;$('slope').textContent=`坡度 ${Math.round(Math.abs(p.pitch)*180/Math.PI)}°`;$('distance').textContent=`${(p.travel/1000).toFixed(2)} km`;
 $('low').classList.toggle('active',low);$('lights').classList.toggle('active',lights);$('winch').classList.toggle('active',winch&&p.winch);
 p.compression.forEach((n,i)=>$('spring-'+i).style.height=(3+n*15)+'px');const cross=Math.max(Math.abs(p.wheels[0]-p.wheels[1]),Math.abs(p.wheels[2]-p.wheels[3]));$('axle-status').textContent=cross>.22?'车桥交叉轴':p.water>.2?'涉水行驶':'轮胎接地';
 for(const id of p.discovered)if(!discovered.has(id)){discovered.add(id);const poi=POIS.find(o=>o.id===id);toast(`发现 ${poi.name} · ${poi.subtitle}`);}
 const count=discovered.size;$('progress').textContent=`${count} / ${POIS.length}`;$('progress-bar').style.width=`${count/POIS.length*100}%`;
 const target=POIS.find(o=>!discovered.has(o.id));$('target-name').textContent=target?target.name:'山谷手记 · 已集齐';$('target-distance').textContent=target?`${Math.round(Math.hypot(p.x-target.x,p.z-target.z))} m · 按 M 查看山路`:'所有地标都留下了你的车辙';
 world.markers.forEach((m,i)=>m.visible=!discovered.has(POIS[i].id));
 $('session-label').textContent=online?`结伴探索 ${peers.size+1}/4`:'独自探索';$('room-label').textContent=roomCode?`邀请码 ${roomCode}`:'';$('ping').textContent=online?`${ping} ms`:'离线探索';$('coordinates').textContent=`N ${Math.round(-p.z)} / E ${Math.round(p.x)}`;
 $('players').replaceChildren(...[...peers.values()].map(peer=>{const e=document.createElement('span');e.textContent=`● ${peer.state.name}　${Math.round(Math.hypot(peer.state.x-p.x,peer.state.z-p.z))} m`;return e;}));renderMap($('minimap'));if(mapOpen)renderMap($('large-map'),true);
}
function updateCamera(dt){
 const target=new T.Vector3(p.x,p.y+.5,p.z);let desired;
 if(menu){heroOrbit+=dt*.016;const a=heroOrbit;desired=new T.Vector3(p.x+Math.sin(a)*7.8,p.y+3.05,p.z+Math.cos(a)*7.8);target.y=p.y+.35;camera.setViewOffset(innerWidth,innerHeight,-innerWidth*.16,0,innerWidth,innerHeight);}
 else{camera.clearViewOffset();if(!pointer&&elapsed-lastInteraction>4)orbit*=Math.exp(-dt*.5);const distance=[12.2,22,6.2][cameraMode]*zoom,angle=p.yaw+Math.PI+orbit;desired=new T.Vector3(p.x+Math.sin(angle)*distance,p.y+distance*(cameraMode===1?.58:.4)+1.2+orbitPitch,p.z+Math.cos(angle)*distance);target.x+=Math.sin(p.yaw)*2.1;target.z+=Math.cos(p.yaw)*2.1;}
 desired.y=Math.max(desired.y,terrain(desired.x,desired.z)+1.25);camera.position.lerp(desired,1-Math.exp(-dt*(menu?3:4.2)));camera.lookAt(target);
}
function frame(now){const dt=Math.min((now-last)/1000,.06);last=now;elapsed+=dt;accumulator+=dt;
 if(running){const command=input(),cars=[p,...[...peers.values()].map(o=>o.state)];while(accumulator>=FIXED_DT){stepCar(p,command,FIXED_DT,cars);if(!online)solveTethers(cars,FIXED_DT);accumulator-=FIXED_DT;}if(resetQueued&&!online)resetQueued=false;
  if(online&&socket?.readyState===1&&elapsed-lastSend>.05){socket.send(JSON.stringify({type:'input',...command}));lastSend=elapsed;resetQueued=false;}
  if(winch&&!p.winch&&!nearestAnchor(p)&&!nearestVehicle(p,cars))winch=false;
 }else{accumulator=0;stepCar(p,{brake:true,lights},FIXED_DT);}
 updateVehicle(localMesh,p,dt);
 for(const peer of peers.values()){const a=peer.state,b=peer.target,t=1-Math.exp(-dt*12);for(const k of ['x','y','z','pitch','roll','steer','wheelSpin','speed'])a[k]+=(b[k]-a[k])*t;a.yaw+=Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*t;a.wheels=a.wheels.map((v,i)=>v+(b.wheels[i]-v)*t);a.lights=b.lights;a.anchor=b.anchor;updateVehicle(peer.mesh,a,dt);peer.label.position.set(a.x,a.y+2.7,a.z);}
 world.update(p,dt,elapsed,atmosphere);updateCamera(dt);audio.update();if(elapsed-lastHUD>.12){updateHUD();lastHUD=elapsed;}renderer.render(world.scene,camera);requestAnimationFrame(frame);
}
function bind(){
 $('solo').onclick=startSolo;$('match').onclick=()=>connect('match');$('friends').onclick=()=>$('join-panel').classList.toggle('hidden');$('create').onclick=()=>connect('create');$('join').onclick=()=>connect('join');$('menu-button').onclick=()=>showMenu(true);$('low').onclick=()=>{low=!low;toast(low?'低速四驱 · 扭矩更足，适合陡坡与涉水':'高速四驱 · 适合山谷巡游');};$('winch').onclick=toggleWinch;$('lights').onclick=()=>lights=!lights;$('camera').onclick=cycleCamera;$('recover').onclick=()=>{resetQueued=true;toast('已请求救援，回到最近的安全位置');};$('weather').onclick=cycleWeather;$('menu-weather').onclick=cycleWeather;$('map-button').onclick=toggleMap;$('close-map').onclick=toggleMap;$('exit-photo').onclick=togglePhoto;
 $('sound').onclick=()=>{soundOn=!soundOn;$('sound').textContent=soundOn?'声音 开':'声音 关';audio.start();};
 $('leave').onclick=()=>{disconnect();p.id='local';showMenu(false);toast('已离开房间，继续独自探索');};
 $('capture').onclick=()=>{renderer.render(world.scene,camera);const a=document.createElement('a');a.download=`栖野-松风山谷-${Date.now()}.png`;a.href=renderer.domElement.toDataURL('image/png');a.click();};
 document.querySelectorAll('[data-color]').forEach(button=>button.onclick=()=>{color=button.dataset.color;document.querySelectorAll('[data-color]').forEach(o=>o.classList.toggle('selected',o===button));replaceCar();if(online&&socket?.readyState===1)socket.send(JSON.stringify({type:'color',color:colors.indexOf(color)}));});
 document.addEventListener('keydown',e=>{if(e.target.matches('input'))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;
 if(e.code==='Escape'){if(mapOpen)toggleMap();else if(photo)togglePhoto();else if(running)showMenu(!menu);return;}if(menu)return;
 if(e.code==='KeyF')$('low').click();if(e.code==='KeyE')toggleWinch();if(e.code==='KeyL')lights=!lights;if(e.code==='KeyC')cycleCamera();if(e.code==='KeyR')$('recover').click();if(e.code==='KeyM')toggleMap();if(e.code==='KeyP')togglePhoto();if(e.code==='KeyT')cycleWeather();if(e.code==='KeyH'){audio.horn();if(online)socket.send(JSON.stringify({type:'horn'}));}
 });document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden)keys.clear();});
 const canvas=$('world');canvas.addEventListener('contextmenu',e=>e.preventDefault());
 const down=e=>{pointer={x:e.clientX,y:e.clientY};dragged=false;canvas.setPointerCapture(e.pointerId);};
 canvas.addEventListener('pointerdown',down);$('menu').addEventListener('pointerdown',e=>{if(e.target===$('menu')){pointer={x:e.clientX,y:e.clientY};$('menu').setPointerCapture(e.pointerId);}});
 const move=e=>{if(!pointer)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer={x:e.clientX,y:e.clientY};if(menu)heroOrbit-=dx*.009;else{orbit-=dx*.006;orbitPitch=clamp(orbitPitch+dy*.035,-2.5,8);}lastInteraction=elapsed;dragged=true;};
 window.addEventListener('pointermove',move);window.addEventListener('pointerup',()=>pointer=null);window.addEventListener('pointercancel',()=>{pointer=null;keys.clear();});canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom+e.deltaY*.001,.55,2);lastInteraction=elapsed;},{passive:false});
 document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);b.classList.add('pressed');});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{keys.delete(b.dataset.key);b.classList.remove('pressed');});});
 addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
 setInterval(()=>{if(online&&socket?.readyState===1)socket.send(JSON.stringify({type:'ping',time:performance.now()}));},2000);
}
try{
 renderer=new T.WebGLRenderer({canvas:$('world'),antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
 camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.15,2200);world=createScene(renderer);replaceCar();camera.position.set(p.x+Math.sin(heroOrbit)*7.8,p.y+3.05,p.z+Math.cos(heroOrbit)*7.8);buildMap();bind();$('loading').classList.add('hidden');requestAnimationFrame(frame);
 // Read-only diagnostics used by the local integration tests and performance inspection.
 window.__trailbound={get state(){return JSON.parse(JSON.stringify(p));},get online(){return online;},get room(){return roomCode;},get peers(){return [...peers.values()].map(o=>JSON.parse(JSON.stringify(o.state)));},get discovered(){return [...discovered];},get server(){return lastServer;},get render(){return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},get suspension(){localMesh.updateMatrixWorld(true);const centers=localMesh.userData.wheels.map(w=>w.getWorldPosition(new T.Vector3()));return {axleLengths:[centers[0].distanceTo(centers[1]),centers[2].distanceTo(centers[3])],wheelContactErrors:centers.map(v=>v.y-.43-terrain(v.x,v.z)),compression:[...p.compression],pitch:p.pitch,roll:p.roll};},get ready(){return true;}};
}catch(e){fatal(e);}
