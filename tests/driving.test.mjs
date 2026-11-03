import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createCar,stepCar,solveTethers,FIXED_DT} from '../shared/physics.mjs';
import {ROUTE,POIS,terrain,clamp} from '../shared/world.mjs';
test('a real simulated car can drive the complete route and discover all five landmarks',()=>{
 const p=createCar();let index=2,steps=0,maxCross=0,maxPitch=0,maxRoll=0,stuck=0;const trace=[];
 while(index<ROUTE.length&&steps<60000){
  const [x,z]=ROUTE[index],distance=Math.hypot(x-p.x,z-p.z);if(distance<7){trace.push({index,x:p.x,z:p.z,time:steps/60});index++;continue;}
  const desired=Math.atan2(x-p.x,z-p.z),delta=Math.atan2(Math.sin(desired-p.yaw),Math.cos(desired-p.yaw));
  const speedTarget=Math.abs(delta)>.5?2.5:4;
  const throttle=p.speed<speedTarget?1:0,brake=p.speed>speedTarget+1;
  stepCar(p,{throttle,steer:clamp(delta*2.7,-1,1),brake,low:true,lights:true},FIXED_DT);steps++;
  maxCross=Math.max(maxCross,Math.abs(p.wheels[0]-p.wheels[1]),Math.abs(p.wheels[2]-p.wheels[3]));maxPitch=Math.max(maxPitch,Math.abs(p.pitch));maxRoll=Math.max(maxRoll,Math.abs(p.roll));
  for(const n of [p.x,p.y,p.z,p.yaw,p.pitch,p.roll,...p.wheels])assert.ok(Number.isFinite(n),'physics remains finite');
  if(steps%600===0)trace.push({index,x:p.x,z:p.z,speed:p.speed,y:p.y});
 }
 mkdirSync('artifacts',{recursive:true});const results={completed:index===ROUTE.length,seconds:steps/60,discovered:p.discovered,maxAxleDifference:maxCross,maxPitchDegrees:maxPitch*180/Math.PI,maxRollDegrees:maxRoll*180/Math.PI,final:{x:p.x,z:p.z},trace};writeFileSync('artifacts/driving-results.json',JSON.stringify(results,null,2));
 assert.equal(index,ROUTE.length,`route traversal stalled at waypoint ${index}, position ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
 assert.equal(p.discovered.length,POIS.length,'every landmark is reachable by driving');assert.ok(maxCross>.15,'suspension articulates on uneven terrain');
});
test('a taut vehicle tether pulls the trailing vehicle and disconnects safely when its peer leaves',()=>{
 const rear=createCar('rear'),front=createCar('front');front.x=rear.x+Math.sin(rear.yaw)*9;front.z=rear.z+Math.cos(rear.yaw)*9;front.y=terrain(front.x,front.z)+.82;
 const start={x:rear.x,z:rear.z};const cars=[rear,front];for(let i=0;i<240;i++){rear.input={winch:true,low:true};front.input={throttle:1,low:true};stepCar(rear,rear.input,FIXED_DT,cars);stepCar(front,front.input,FIXED_DT,cars);solveTethers(cars,FIXED_DT);}
 assert.equal(rear.anchor?.vehicleId,'front');assert.ok(Math.hypot(rear.x-start.x,rear.z-start.z)>2);assert.ok(Math.hypot(front.x-rear.x,front.z-rear.z)<rear.anchor.length+1);
 solveTethers([rear],FIXED_DT);assert.equal(rear.anchor,null);assert.equal(rear.winch,false);
});
test('brake, reverse, low range and recovery have practical effects',()=>{
 const p=createCar();for(let i=0;i<180;i++)stepCar(p,{throttle:1},FIXED_DT);assert.ok(p.speed>3);
 for(let i=0;i<90;i++)stepCar(p,{brake:true},FIXED_DT);assert.ok(Math.abs(p.speed)<1);
 for(let i=0;i<120;i++)stepCar(p,{throttle:-1},FIXED_DT);assert.ok(p.speed<0);
 const safe={...p.lastSafe};p.x+=30;p.z-=20;stepCar(p,{reset:true,brake:true},FIXED_DT);assert.ok(Math.hypot(p.x-safe.x,p.z-safe.z)<1);
});
