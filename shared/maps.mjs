import {terrain as valleyTerrain,surface as valleySurface,POIS,ROUTE,SPAWN,OBSTACLES,MAP_SIZE,hash,clamp} from './world.mjs';
export const MAPS={
 valley:{id:'valley',name:'松风山谷',tag:'自由探索',icon:'01',size:MAP_SIZE,capacity:4,spawn:SPAWN,description:'沿林间车辙穿越浅溪，和朋友一起寻找五处风景。',tasks:POIS,route:ROUTE,terrain:valleyTerrain,surface:valleySurface,obstacles:OBSTACLES},
 snow:{id:'snow',name:'白岭补给线',tag:'雪地运送',icon:'02',size:300,capacity:4,spawn:{x:-88,z:-108,yaw:.4},description:'在雪地装载补给，停稳交接，把物资送到山顶电台。',tasks:[{id:'load',name:'领取补给',subtitle:'到仓库停稳 2 秒装载物资',x:-70,z:-65,radius:9},{id:'deliver',name:'救援站交接',subtitle:'把补给送到红色救援屋，停稳 2 秒',x:18,z:2,radius:10},{id:'beacon',name:'点亮山顶信标',subtitle:'带上电池抵达山顶，停稳 2 秒',x:78,z:95,radius:10}],route:[[-88,-108],[-78,-86],[-70,-65],[-48,-40],[-10,-21],[18,2],[47,25],[60,59],[78,95]],terrain:(x,z)=>3+Math.sin(x*.022)*2.2+Math.sin(z*.03)*1.8+14*Math.exp(-((x-75)**2/9000+(z-90)**2/5500)),surface:()=>({name:'积雪',grip:.59,drag:.23,color:'#c6d9db'}),obstacles:[]},
 trials:{id:'trials',name:'悬谷机关道',tag:'合作闯关',icon:'03',size:260,capacity:4,spawn:{x:0,z:-104,yaw:0},description:'压动跷跷板、沿双木梁保持平衡，再搭滑索平台越过峡谷。',tasks:[{id:'seesaw',name:'平衡跷跷板',subtitle:'低速驶过受车重影响的活动桥',x:0,z:-43,radius:7},{id:'beams',name:'双梁独木道',subtitle:'对齐轮胎，沿两根木梁慢慢开',x:0,z:4,radius:6},{id:'zip',name:'滑索飞渡',subtitle:'上板自动起滑，抵达后驶向终点',x:0,z:95,radius:8}],route:[[0,-104],[0,-79],[0,-62],[0,-43],[0,-28],[0,-15],[0,4],[0,16],[0,76],[0,95]],terrain:(x,z)=>-5.5+Math.sin(x*.06)*.45+Math.cos(z*.08)*.35,surface:()=>({name:'木质机关',grip:.9,drag:.12,color:'#bc9267'}),obstacles:[]},
 soccer:{id:'soccer',name:'山野足球场',tag:'5 对 5 · 5 分钟',icon:'04',size:160,capacity:10,spawn:{x:0,z:-19,yaw:0},description:'开四驱、撞足球。真人或 AI 混编，五分钟决胜，最多 5 对 5。',tasks:[],route:[],terrain:()=>0,surface:()=>({name:'球场草皮',grip:.96,drag:.09,color:'#487c62'}),obstacles:[]}
};
MAPS.snow.obstacles=Array.from({length:340},(_,i)=>{const x=(hash(i,83)-.5)*280,z=(hash(i,84)-.5)*280;return {x,z,y:MAPS.snow.terrain(x,z),r:.65,size:5+hash(i,85)*7,kind:'tree',seed:i};}).filter(o=>!MAPS.snow.tasks.some(t=>Math.hypot(t.x-o.x,t.z-o.z)<15)&&routeDistance(MAPS.snow.route,o.x,o.z)>7);
export function getMap(id='valley'){return MAPS[id]||MAPS.valley;}
export function routeDistance(route,x,z){let d=Infinity;for(let i=1;i<route.length;i++){const [a,b]=route[i-1],[c,e]=route[i],dx=c-a,dz=e-b,t=clamp(((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz),0,1);d=Math.min(d,Math.hypot(x-a-t*dx,z-b-t*dz));}return d;}
export const COURSE_DECKS=[{x:0,z:-98,w:17,l:28,y:4},{x:0,z:-77,w:8,l:14,y:4},{x:0,z:-40,w:11,l:22,y:4},{x:-.74,z:-15,w:.56,l:30,y:4},{x:.74,z:-15,w:.56,l:30,y:4},{x:0,z:5,w:8,l:10,y:5,slope:.2},{x:0,z:95,w:15,l:26,y:3}];
export function initialWorld(mapId){return {mapId,time:0,seesaw:{angle:0,velocity:0,load:0},zip:{progress:0,z:16,y:6,phase:'idle',timer:0,rides:0},soccer:{phase:'waiting',remaining:300,score:{blue:0,orange:0},phaseTime:0,round:0,lastGoal:null,ball:{x:0,y:1.25,z:0,vx:0,vy:0,vz:0,lastTouch:null}}};}
export function groundHeight(mapId,x,z,world=null){const map=getMap(mapId);if(map.id!=='trials')return map.terrain(x,z);let h=map.terrain(x,z);for(const d of COURSE_DECKS)if(Math.abs(x-d.x)<=d.w/2&&Math.abs(z-d.z)<=d.l/2)h=Math.max(h,d.y+(d.slope||0)*(z-d.z));if(Math.abs(x)<2.8&&Math.abs(z+62)<11.2)h=Math.max(h,4+(z+62)*Math.sin(world?.seesaw.angle||0));const zip=world?.zip||{z:16,y:6};if(Math.abs(x)<=3.5&&Math.abs(z-zip.z)<=6)h=Math.max(h,zip.y);return h;}
export function inZip(p,w){return Math.abs(p.x)<2.65&&Math.abs(p.z-w.zip.z)<4.2&&Math.abs(p.y-(w.zip.y+.82))<1.4;}
export function stepMechanisms(w,cars,dt){w.time+=dt;if(w.mapId!=='trials')return;
 const onBridge=cars.filter(p=>Math.abs(p.x)<2.8&&Math.abs(p.z+62)<11&&p.y>2);const load=onBridge.reduce((sum,p)=>sum+(p.z+62),0);const target=clamp(-load*.022,-.27,.27);w.seesaw.load=onBridge.length;w.seesaw.velocity+=((target-w.seesaw.angle)*12-w.seesaw.velocity*4)*dt;w.seesaw.angle=clamp(w.seesaw.angle+w.seesaw.velocity*dt,-.29,.29);
 const z=w.zip,old=z.z,riders=cars.filter(p=>inZip(p,w));
 if(z.phase==='idle'&&riders.length){z.phase='boarding';z.timer=1.4;}
 if(z.phase==='boarding'){z.timer-=dt;if(!riders.length){z.phase='idle';}else if(z.timer<=0){z.phase='moving';for(const p of riders)p.zipRiding=true;}}
 if(z.phase==='moving'){z.progress=Math.min(1,z.progress+dt/10);if(z.progress>=1){z.phase='unloading';z.timer=2;z.rides++;}}
 if(z.phase==='unloading'){z.timer-=dt;if(z.timer<=0&&!riders.length)z.phase='returning';}
 if(z.phase==='returning'){z.progress=Math.max(0,z.progress-dt/7);if(z.progress<=0)z.phase='idle';}
 z.z=16+z.progress*60;z.y=6-z.progress*3;
 if(z.phase==='moving'||z.phase==='unloading')for(const p of riders){p.z+=z.z-old;p.zipRiding=true;}
}
export function updateTasks(p,world,dt){const map=getMap(p.mapId);p.tasks??=[];p.flags??={};p.interact=0;
 if(map.id==='valley'){p.tasks=[...p.discovered];return;}
 if(map.id==='soccer')return;
 const next=map.tasks.find(t=>!p.tasks.includes(t.id));if(!next)return;
 if(map.id==='snow'){if(Math.hypot(p.x-next.x,p.z-next.z)<next.radius&&Math.abs(p.speed)<1){p.taskHold=(p.taskHold||0)+dt;p.interact=clamp(p.taskHold/2,0,1);if(p.taskHold>=2){p.tasks.push(next.id);p.cargo=next.id==='load'?'救援物资':next.id==='deliver'?'信标电池':null;p.taskHold=0;p.lastSafe={x:p.x,z:p.z,yaw:p.yaw};}}else p.taskHold=0;return;}
 if(p.y<-1){p.fallTime=(p.fallTime||0)+dt;return;}p.fallTime=0;
 if(Math.abs(p.x)<2.5&&Math.abs(p.z+62)<10&&p.y>2)p.flags.seesaw=true;
 if(Math.abs(p.x)<1.2&&p.z>-27&&p.z<0&&p.y>2)p.flags.beams=true;
 if(next.id==='seesaw'&&p.flags.seesaw&&p.z>-48&&p.z<-28&&p.y>2){p.tasks.push('seesaw');p.lastSafe={x:0,z:-39,yaw:0};}
 if(next.id==='beams'&&p.flags.beams&&p.z>1&&p.z<10&&p.y>2){p.tasks.push('beams');p.lastSafe={x:0,z:4,yaw:0};}
 if(next.id==='zip'&&p.zipRiding&&p.z>87&&p.y>1){p.tasks.push('zip');p.lastSafe={x:0,z:95,yaw:0};}
}
export function navigation(mapId,p){const map=getMap(mapId),done=p.tasks||p.discovered||[],target=map.tasks.find(t=>!done.includes(t.id));if(!target)return {target:null,path:[]};let a=0,b=0,da=Infinity,db=Infinity;map.route.forEach(([x,z],i)=>{const d=Math.hypot(x-p.x,z-p.z),e=Math.hypot(x-target.x,z-target.z);if(d<da){da=d;a=i;}if(e<db){db=e;b=i;}});const path=[[p.x,p.z]];if(a<=b)path.push(...map.route.slice(a,b+1));else path.push(...map.route.slice(b,a+1).reverse());path.push([target.x,target.z]);return {target,path};}
