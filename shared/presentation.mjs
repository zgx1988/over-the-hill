const blend=(a,b,t)=>a+(b-a)*t;
export const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function needsAuthoritativeReset(local,remote,frozen=false){
 const distance=Math.hypot(remote.x-local.x,remote.z-local.z);
 // Optional flags arriving as undefined and normalised locally to null used
 // to trigger a teleport on EVERY snapshot, including stale steering angles.
 return distance>5||(remote.falls??0)!==(local.falls??0)||!!remote.zipRiding!==!!local.zipRiding||frozen&&distance>.5;
}
export function poseCopy(p){return {...p,wheels:[...p.wheels],compression:[...p.compression]};}
export function interpolatePose(previous,current,alpha){
 const result=poseCopy(current),t=Math.max(0,Math.min(1,alpha));
 for(const key of ['x','y','z','pitch','roll','steer','wheelSpin','speed'])result[key]=blend(previous[key],current[key],t);
 result.yaw=previous.yaw+angleDelta(previous.yaw,current.yaw)*t;
 result.wheels=previous.wheels.map((v,i)=>blend(v,current.wheels[i],t));
 result.compression=previous.compression.map((v,i)=>blend(v,current.compression[i],t));
 return result;
}
// Corrections run on the physics clock, never in a network message or render.
// Keep vertical spring velocity intact: height and wheel contact are terrain-driven.
export class Reconciliation {
 constructor(){this.clear();}
 clear(){this.x=this.z=this.yaw=this.speed=0;}
 receive(local,server,oneWaySeconds=0){
  const age=Math.max(0,Math.min(.3,oneWaySeconds));
  const rate=Math.tan(server.steer)*server.speed/2.3/(1+Math.abs(server.speed)*.055);
  const heading=server.yaw+rate*age*.5;
  this.x=server.x+Math.sin(heading)*server.speed*age-local.x;
  this.z=server.z+Math.cos(heading)*server.speed*age-local.z;
  if(Math.hypot(this.x,this.z)<.055)this.x=this.z=0;
  this.yaw=angleDelta(local.yaw,server.yaw+rate*age);
  this.speed=server.speed-local.speed;
 }
 step(p,dt){
  const t=-Math.expm1(-dt*6),distance=Math.hypot(this.x,this.z);
  // A normal correction cannot pull a moving car backwards in one tick.
  const limit=Math.max(.7,Math.abs(p.speed)*.35)*dt;
  const fraction=distance>0?Math.min(t,limit/distance):0;
  const x=this.x*fraction,z=this.z*fraction;
  p.x+=x;p.z+=z;this.x-=x;this.z-=z;
  const yaw=Math.max(-.7*dt,Math.min(.7*dt,this.yaw*t));
  p.yaw+=yaw;this.yaw-=yaw;
  const speed=this.speed*t;p.speed+=speed;this.speed-=speed;
 }
}
