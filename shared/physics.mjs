import {terrain,surface,VEHICLES,SPAWN,clamp,OBSTACLES,nearestAnchor,POIS} from './world.mjs';
export const FIXED_DT=1/60;
export function createCar(id='local',name='旅人',index=0){const x=SPAWN.x+index*4,z=SPAWN.z;return {id,name,vehicle:'scout',color:index%4,x,z,y:terrain(x,z)+.82,yaw:SPAWN.yaw,speed:0,vy:0,pitch:0,roll:0,pitchV:0,rollV:0,steer:0,wheelSpin:0,wheels:[0,0,0,0],compression:[.5,.5,.5,.5],low:false,lights:true,winch:false,anchor:null,travel:0,resetCooldown:0,discovered:[],input:{},lastSafe:{x,z,yaw:SPAWN.yaw},water:0};}
export function resetCar(p){const s=p.lastSafe||SPAWN;p.x=s.x;p.z=s.z;p.yaw=s.yaw;p.y=terrain(p.x,p.z)+.82;p.speed=0;p.vy=0;p.pitch=p.roll=p.pitchV=p.rollV=0;p.winch=false;p.anchor=null;}
export function wheelPositions(p){const v=VEHICLES.scout,c=Math.cos(p.yaw),s=Math.sin(p.yaw);return [[-1,1],[1,1],[-1,-1],[1,-1]].map(([sx,sz])=>{const lx=sx*v.track/2,lz=sz*v.wheelbase/2;return {x:p.x+c*lx+s*lz,z:p.z-s*lx+c*lz,lx,lz};});}
function dampSpring(value,velocity,target,k,d,dt){velocity+=(target-value)*k*dt;velocity*=Math.exp(-d*dt);return [value+velocity*dt,velocity];}
export function nearestVehicle(p,cars=[]){let best=null,d=23;for(const other of cars){if(other.id===p.id)continue;const dx=other.x-p.x,dz=other.z-p.z,n=Math.hypot(dx,dz);if(n<d&&n>3&&(dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw))>0){d=n;best=other;}}return best;}
export function stepCar(p,input={},dt=FIXED_DT,cars=[]){
 const v=VEHICLES.scout;dt=clamp(dt,.001,.04);p.resetCooldown=Math.max(0,p.resetCooldown-dt);
 if(input.reset && !p.resetCooldown){resetCar(p);p.resetCooldown=2;}
 const surf=surface(p.x,p.z),throttle=clamp(Number(input.throttle)||0,-1,1),turn=clamp(Number(input.steer)||0,-1,1);
 p.low=!!input.low;p.lights=input.lights!==false;
 if(input.winch&&!p.winch){const other=nearestVehicle(p,cars),a=other||nearestAnchor(p);if(a){p.winch=true;p.anchor={x:a.x,z:a.z,y:other?a.y-.3:a.y,vehicleId:other?.id||null,length:Math.hypot(a.x-p.x,a.z-p.z)};}}
 if(!input.winch){p.winch=false;p.anchor=null;}
 const max=p.low?4.2:v.maxSpeed;
 const forwardSlope=(terrain(p.x+Math.sin(p.yaw)*1.2,p.z+Math.cos(p.yaw)*1.2)-terrain(p.x-Math.sin(p.yaw)*1.2,p.z-Math.cos(p.yaw)*1.2))/2.4;
 const gradient=clamp(forwardSlope,-1.5,1.5);
 const wheelGround=wheelPositions(p).map(q=>terrain(q.x,q.z));
 const ground=wheelGround.reduce((a,b)=>a+b,0)/4;
 const airborne=p.y>ground+v.clearance+.45;
 let acc=throttle*(p.low?v.power*5.2:v.power)*surf.grip*(airborne?.08:1)-gradient*6.2;
 if(throttle*p.speed<-.8)acc=throttle*12;
 acc-=p.speed*(.12+surf.drag*.32)+(Math.abs(p.speed)>.1?Math.sign(p.speed)*.25:0);
 if(input.brake)acc-=Math.sign(p.speed)*Math.min(Math.abs(p.speed)/dt,14);
 p.speed=clamp(p.speed+acc*dt,-max*.38,max);
 if(!throttle&&Math.abs(p.speed)<.12&&Math.abs(gradient)<.12)p.speed=0;
 p.steer+=(turn*.51-p.steer)*(1-Math.exp(-dt*7));
 const yawRate=Math.tan(p.steer)*p.speed/v.wheelbase/(1+Math.abs(p.speed)*.055);
 p.yaw+=yawRate*dt;
 const ox=p.x,oz=p.z;
 p.x+=Math.sin(p.yaw)*p.speed*dt;p.z+=Math.cos(p.yaw)*p.speed*dt;
 if(p.winch&&p.anchor&&!p.anchor.vehicleId){const dx=p.anchor.x-p.x,dz=p.anchor.z-p.z,dist=Math.hypot(dx,dz);if(dist>3){p.x+=dx/dist*.8*dt;p.z+=dz/dist*.8*dt;}else{p.winch=false;p.anchor=null;}}
 for(const o of OBSTACLES){const dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz),r=o.r+.8;if(d<r){p.x=o.x+dx/(d||1)*r;p.z=o.z+dz/(d||1)*r;p.speed*=.2;}}
 p.x=clamp(p.x,-420,420);p.z=clamp(p.z,-420,420);
 const wheels=wheelPositions(p),heights=wheels.map(q=>terrain(q.x,q.z));
 const front=(heights[0]+heights[1])/2,rear=(heights[2]+heights[3])/2,left=(heights[0]+heights[2])/2,right=(heights[1]+heights[3])/2;
 const target=(front+rear)/2+v.clearance;
 [p.y,p.vy]=dampSpring(p.y,p.vy,target,75,9.8,dt);
 // Rigid chassis pitch and roll, damped sprung mass; each wheel follows the heightfield.
 const targetPitch=clamp(Math.atan2(front-rear,v.wheelbase)+acc*.009,-.8,.8);
 const targetRoll=clamp(Math.atan2(right-left,v.track)-yawRate*p.speed*.012,-.72,.72);
 [p.pitch,p.pitchV]=dampSpring(p.pitch,p.pitchV,targetPitch,62,10,dt);
 [p.roll,p.rollV]=dampSpring(p.roll,p.rollV,targetRoll,65,10,dt);
 p.wheels=heights.map((h,i)=>{const q=wheels[i];const bodyY=p.y+Math.sin(p.pitch)*q.lz+Math.sin(p.roll)*q.lx;return clamp(h+v.radius-bodyY,-.74,-.14);});
 p.compression=p.wheels.map(w=>clamp((w+.74)/.6,0,1));
 p.wheelSpin+=p.speed*dt/v.radius;p.travel+=Math.hypot(p.x-ox,p.z-oz);p.water=Math.max(0,-2.4-terrain(p.x,p.z));
 if(Math.abs(p.roll)<.32&&Math.abs(p.pitch)<.35&&p.water<.2&&Math.abs(p.speed)<5)p.lastSafe={x:p.x,z:p.z,yaw:p.yaw};
 if(p.water>2.2){p.speed*=Math.exp(-dt*4);}
 for(const poi of POIS)if(Math.hypot(p.x-poi.x,p.z-poi.z)<13&&!p.discovered.includes(poi.id))p.discovered.push(poi.id);
 return p;
}
export function publicCar(p){const {input,lastSafe,...state}=p;return state;}
export function solveTethers(cars,dt=FIXED_DT){for(const p of cars){const a=p.anchor;if(!p.winch||!a?.vehicleId)continue;const other=cars.find(o=>o.id===a.vehicleId);if(!other){p.winch=false;p.anchor=null;continue;}a.x=other.x;a.z=other.z;a.y=other.y-.3;a.length=Math.max(3.3,a.length-dt*.35);const dx=other.x-p.x,dz=other.z-p.z,dist=Math.hypot(dx,dz);if(dist>32){p.winch=false;p.anchor=null;continue;}if(dist>a.length){const stretch=Math.min(dist-a.length,1.5),pull=stretch*(1-Math.exp(-dt*16)),weight=p.input?.brake?.12:other.input?.brake?.88:.5;p.x+=dx/dist*pull*weight;p.z+=dz/dist*pull*weight;other.x-=dx/dist*pull*(1-weight);other.z-=dz/dist*pull*(1-weight);}}}
