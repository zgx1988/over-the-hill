const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=v=>Number.isFinite(v)?v:0;
export function createCrewMotion(){return {initialized:false,previous:{speed:0,yaw:0,x:0,z:0},steering:0,driver:{pitch:0,roll:0,heave:0,pitchV:0,rollV:0,heaveV:0},passenger:{pitch:0,roll:0,heave:0,pitchV:0,rollV:0,heaveV:0},acceleration:0,lateral:0};}
function spring(s,key,target,k,d,dt){const velocity=key+'V';s[velocity]+=(target-s[key])*k*dt;s[velocity]*=Math.exp(-d*dt);s[key]+=s[velocity]*dt;}
export function stepCrewMotion(m,p,delta=1/60){const dt=clamp(finite(delta)||1/60,1/240,.05),speed=finite(p.speed),yaw=finite(p.yaw),x=finite(p.x),z=finite(p.z),teleported=m.initialized&&Math.hypot(x-m.previous.x,z-m.previous.z)>5;
 let acceleration=0,turnRate=0;if(m.initialized&&!teleported){acceleration=clamp((speed-m.previous.speed)/dt,-12,12);turnRate=clamp(Math.atan2(Math.sin(yaw-m.previous.yaw),Math.cos(yaw-m.previous.yaw))/dt,-2.5,2.5);}
 if(teleported)for(const s of [m.driver,m.passenger])Object.assign(s,{pitch:0,roll:0,heave:0,pitchV:0,rollV:0,heaveV:0});
 m.previous={speed,yaw,x,z};m.initialized=true;m.acceleration=acceleration;m.lateral=clamp(turnRate*speed,-12,12);m.steering=-clamp(finite(p.steer),-.55,.55)*2.8||0;
 for(const [i,s]of [m.driver,m.passenger].entries()){const gain=i?1:.72;spring(s,'pitch',clamp(-acceleration*.013+finite(p.pitch)*.11,-.14,.14)*gain,i?35:47,i?7:9,dt);spring(s,'roll',clamp(m.lateral*.018+finite(p.roll)*.14,-.15,.15)*gain,i?30:45,i?6:9,dt);spring(s,'heave',clamp(-finite(p.vy)*.013,-.026,.021)*gain,i?46:60,i?7:10,dt);}
 return m;
}
// Two-bone inverse kinematics: fixed upper/forearm lengths and a preferred elbow side.
export function solveArm(shoulder,hand,pole,upper=.25,fore=.245){const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>Math.hypot(...a);let direction=sub(hand,shoulder),raw=norm(direction);direction=raw>1e-8?direction.map(v=>v/raw):[0,0,1];const distance=clamp(raw,Math.abs(upper-fore)+1e-5,upper+fore-1e-5),along=(upper*upper-fore*fore+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,upper*upper-along*along));let bend=pole.map((v,i)=>v-direction[i]*dot(pole,direction));if(norm(bend)<1e-6){bend=[0,-1,0];const q=dot(bend,direction);bend=bend.map((v,i)=>v-direction[i]*q);}const length=norm(bend)||1;bend=bend.map(v=>v/length);return {elbow:shoulder.map((v,i)=>v+direction[i]*along+bend[i]*height),wrist:shoulder.map((v,i)=>v+direction[i]*distance),reachError:Math.max(0,raw-distance)};}
