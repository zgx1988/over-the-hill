import {clamp} from './world.mjs';
export const MATCH_SECONDS=300,BALL_RADIUS=1.25,FIELD={halfWidth:42,halfLength:62,goalHalfWidth:10,goalHeight:7};
export function teamSpawn(team,index){const sign=team==='blue'?1:-1,places=[[0,-19],[-15,-32],[15,-32],[-9,-43],[0,-51]],pos=places[index%5];return {x:pos[0],z:pos[1]*sign,yaw:team==='blue'?0:Math.PI};}
export function resetPositions(cars){for(const team of ['blue','orange'])cars.filter(p=>p.team===team).forEach((p,i)=>{const s=teamSpawn(team,i);Object.assign(p,{...s,y:.82,speed:0,vy:0,pitch:0,roll:0,anchor:null,winch:false,lastSafe:{...s}});});}
export function startMatch(w,cars){const s=w.soccer;s.score={blue:0,orange:0};s.remaining=MATCH_SECONDS;s.phase='kickoff';s.phaseTime=3;s.round++;s.lastGoal=null;s.ball={x:0,y:BALL_RADIUS,z:0,vx:0,vy:0,vz:0,lastTouch:null};resetPositions(cars);}
export function aiInput(p,cars,w){const s=w.soccer;if(s.phase!=='playing')return {brake:true};const ball=s.ball,attack=p.team==='blue'?1:-1,team=cars.filter(c=>c.team===p.team),index=team.findIndex(c=>c.id===p.id);let tx,tz;
 if(index===4&&ball.z*attack>-8){tx=clamp(ball.x*.45,-10,10);tz=-50*attack;}
 else if(index===3&&ball.z*attack>12){tx=ball.x*.5;tz=-20*attack;}
 else{const gx=-ball.x,gz=62*attack-ball.z,d=Math.hypot(gx,gz)||1,dist=Math.hypot(ball.x-p.x,ball.z-p.z);tx=ball.x-gx/d*(dist<4?-7:3.5);tz=ball.z-gz/d*(dist<4?-7:3.5);if(index===1)tx+=3;if(index===2)tx-=3;}
 const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),err=Math.atan2(Math.sin(angle-p.yaw),Math.cos(angle-p.yaw));
 if(d<1.8)return {brake:true};if(Math.abs(err)>2.35&&d<9)return {throttle:-.8,steer:clamp(-err*1.5,-1,1)};
 const target=Math.abs(err)>1?4:Math.abs(err)>.5?7:14;return {throttle:p.speed<target?1:.1,steer:clamp(err*2.2,-1,1),brake:p.speed>target+2,lights:true};
}
export function stepSoccer(w,cars,dt){const s=w.soccer,b=s.ball;
 for(const p of cars){p.x=clamp(p.x,-40.4,40.4);p.z=clamp(p.z,-60.5,60.5);}
 for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){const a=cars[i],c=cars[j],dx=c.x-a.x,dz=c.z-a.z,d=Math.hypot(dx,dz);if(d<2.05){const q=(2.05-d)/2,nx=dx/(d||1),nz=dz/(d||1);a.x-=nx*q;a.z-=nz*q;c.x+=nx*q;c.z+=nz*q;a.speed*=.94;c.speed*=.94;}}
 if(s.phase==='waiting'||s.phase==='finished')return;
 if(s.phase==='kickoff'){s.phaseTime-=dt;if(s.phaseTime<=0){s.phase='playing';s.phaseTime=0;}return;}
 s.remaining=Math.max(0,s.remaining-dt);if(s.remaining<1e-7){s.remaining=0;s.phase='finished';b.vx=b.vy=b.vz=0;return;}
 if(s.phase==='goal'){s.phaseTime-=dt;if(s.phaseTime<=0){s.phase='kickoff';s.phaseTime=2;s.ball={x:0,y:BALL_RADIUS,z:0,vx:0,vy:0,vz:0,lastTouch:null};resetPositions(cars);}return;}
 b.vy-=9.8*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
 if(b.y<BALL_RADIUS){b.y=BALL_RADIUS;b.vy=Math.abs(b.vy)>.7?-b.vy*.48:0;}const drag=Math.exp(-(b.y<=BALL_RADIUS+.05?.32:.08)*dt);b.vx*=drag;b.vz*=drag;
 for(const p of cars){if(b.y>3.3)continue;const co=Math.cos(p.yaw),si=Math.sin(p.yaw),dx=b.x-p.x,dz=b.z-p.z,lx=co*dx-si*dz,lz=si*dx+co*dz,nx=clamp(lx,-.94,.94),nz=clamp(lz,-1.72,1.72),ex=lx-nx,ez=lz-nz,dist=Math.hypot(ex,ez);if(dist>=BALL_RADIUS)continue;
  const localX=dist>.001?ex/dist:0,localZ=dist>.001?ez/dist:1,wx=co*localX+si*localZ,wz=-si*localX+co*localZ;b.x+=wx*(BALL_RADIUS-dist+.02);b.z+=wz*(BALL_RADIUS-dist+.02);const cvx=Math.sin(p.yaw)*p.speed,cvz=Math.cos(p.yaw)*p.speed,closing=(cvx-b.vx)*wx+(cvz-b.vz)*wz;if(closing>0){b.vx+=wx*closing*1.65;b.vz+=wz*closing*1.65;b.vy=Math.max(b.vy,Math.min(4,Math.abs(p.speed)*.18));b.lastTouch=p.id;p.speed*=.9;}}
 const speed=Math.hypot(b.vx,b.vz);if(speed>29){b.vx*=29/speed;b.vz*=29/speed;}
 if(Math.abs(b.z)>FIELD.halfLength&&Math.abs(b.x)<FIELD.goalHalfWidth-BALL_RADIUS*.5&&b.y<FIELD.goalHeight-BALL_RADIUS*.4){const team=b.z>0?'blue':'orange';s.score[team]++;s.lastGoal={team,touch:b.lastTouch};s.phase='goal';s.phaseTime=3;b.vx=b.vy=b.vz=0;return;}
 if(Math.abs(b.x)>FIELD.halfWidth-BALL_RADIUS){b.x=Math.sign(b.x)*(FIELD.halfWidth-BALL_RADIUS);b.vx*=-.76;}
 if(Math.abs(b.z)>FIELD.halfLength-BALL_RADIUS&&(Math.abs(b.x)>=FIELD.goalHalfWidth-BALL_RADIUS*.5||b.y>=FIELD.goalHeight-BALL_RADIUS*.4)){b.z=Math.sign(b.z)*(FIELD.halfLength-BALL_RADIUS);b.vz*=-.76;}
 if(!Number.isFinite(b.x+b.y+b.z))s.ball={x:0,y:BALL_RADIUS,z:0,vx:0,vy:0,vz:0,lastTouch:null};
}
