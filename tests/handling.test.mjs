import test from 'node:test';
import assert from 'node:assert/strict';
import {steeringAngle,createCar,FIXED_DT,stepCar} from '../shared/physics.mjs';
import {Reconciliation,interpolatePose,poseCopy,needsAuthoritativeReset} from '../shared/presentation.mjs';
import {TIRE_PROFILE,TREAD_ROWS,TREAD_RADIUS,TREAD_SIZE,WHEEL_RADIUS} from '../shared/wheel-spec.mjs';
import {VEHICLES} from '../shared/world.mjs';

test('steering responds in 100 ms, reverses promptly and fully centres within 300 ms at rest or in motion',()=>{
 for(const speed of [0,4,12,18]){
  let angle=0;for(let n=0;n<6;n++)angle=steeringAngle(angle,1,speed,FIXED_DT);
  const lock=.6/(1+Math.max(0,speed-5)*.045);assert.ok(angle>lock*.79);
  for(let n=0;n<6;n++)angle=steeringAngle(angle,-1,speed,FIXED_DT);assert.ok(angle<0);
  for(let n=0;n<18;n++)angle=steeringAngle(angle,0,speed,FIXED_DT);assert.equal(angle,0);
 }
});
test('network reception does not move the car, apply stale steering or inject vertical spring energy',()=>{
 const p=createCar('a','test',0,'soccer');p.speed=6;p.steer=.5;p.vy=1.4;
 const before=poseCopy(p),server={...p,x:p.x-.8,z:p.z-1.5,y:p.y+2,vy:-20,steer:-.5};
 const c=new Reconciliation();c.receive(p,server,.12);assert.deepEqual(p,before);
 c.step(p,FIXED_DT);assert.equal(p.vy,1.4);assert.equal(p.y,before.y);assert.equal(p.steer,.5);
 assert.ok(Math.hypot(p.x-before.x,p.z-before.z)<=6*.35*FIXED_DT+1e-8);
});
test('absent versus null zipline flags never teleport a normally driving vehicle or restore stale steering',()=>{
 const p=createCar(),remote=poseCopy(p);p.zipRiding=null;delete remote.zipRiding;remote.x-=.2;remote.steer=.4;
 assert.equal(needsAuthoritativeReset(p,remote),false);
 assert.equal(needsAuthoritativeReset(p,{...remote,zipRiding:true}),true);
 assert.equal(needsAuthoritativeReset(p,{...remote,falls:p.falls+1}),true);
 assert.equal(needsAuthoritativeReset(p,{...remote,x:p.x+8}),true);
 assert.equal(needsAuthoritativeReset(p,remote,true),false);
});
test('render interpolation stays continuous at 30, 60 and 144 Hz and follows the short yaw path across pi',()=>{
 for(const hz of [30,60,144]){
  const p=createCar('a','test',0,'soccer');let previous=poseCopy(p),render=poseCopy(p),acc=0;
  for(let frame=0;frame<hz*2;frame++){
   acc+=1/hz;while(acc>=FIXED_DT){previous=poseCopy(p);p.z+=6*FIXED_DT;acc-=FIXED_DT;}
   const next=interpolatePose(previous,p,acc/FIXED_DT);assert.ok(next.z>=render.z-1e-8);assert.ok(next.z-render.z<=6/hz+.001);render=next;
  }
 }
 const a=createCar(),b=poseCopy(a);a.yaw=Math.PI-.01;b.yaw=-Math.PI+.01;
 assert.ok(Math.abs(interpolatePose(a,b,.5).yaw-Math.PI)<1e-8);
});
test('every tread corner is supported by a closed casing and the visible outer radius agrees with physics',()=>{
 assert.deepEqual(TIRE_PROFILE[0],TIRE_PROFILE.at(-1));assert.equal(VEHICLES.scout.radius,WHEEL_RADIUS);
 const outerRadius=x=>{let result=0;for(let i=1;i<TIRE_PROFILE.length;i++){const [ra,xa]=TIRE_PROFILE[i-1],[rb,xb]=TIRE_PROFILE[i];if(xa===xb||x<Math.min(xa,xb)||x>Math.max(xa,xb))continue;result=Math.max(result,ra+(rb-ra)*(x-xa)/(xb-xa));}return result;};
 for(const row of TREAD_ROWS)for(const side of [-1,1]){
  const x=row+side*TREAD_SIZE[0]/2,bottom=Math.hypot(TREAD_RADIUS-TREAD_SIZE[1]/2,TREAD_SIZE[2]/2);
  assert.ok(outerRadius(x)>=bottom,`unsupported lug at ${x}`);
 }
 const maxRadius=Math.hypot(TREAD_RADIUS+TREAD_SIZE[1]/2,TREAD_SIZE[2]/2);
 assert.ok(Math.abs(maxRadius-WHEEL_RADIUS)<.001);
});
