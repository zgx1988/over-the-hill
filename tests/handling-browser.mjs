import {chromium} from 'playwright';
import {WebSocket,WebSocketServer} from 'ws';
import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const base=process.env.TEST_URL||'http://127.0.0.1:8792',folder='artifacts/handling';
await mkdir(folder,{recursive:true});
// Keep the deployed source as an A/B reference; never change the working tree.
let baselineSource;
try{baselineSource=await readFile(folder+'/baseline-play.mjs','utf8');}catch{
 try{baselineSource=execFileSync('git',['-c',`safe.directory=${path.resolve('.').replaceAll('\\','/')}`,'show','782b0cb:public/play.mjs'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});}catch{}
}
// A local, ordered WebSocket proxy adds 240 ms RTT and variable packet delay.
// HTTP assets still come from the local development server. No public service.
const sockets=new Set(),timers=new Set();
const proxy=http.createServer(async(req,res)=>{try{const response=await fetch(base+req.url);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(502);res.end();}});
const wss=new WebSocketServer({server:proxy,path:'/ws'});
wss.on('connection',down=>{const up=new WebSocket(base.replace('http','ws')+'/ws',{origin:base});sockets.add(down);sockets.add(up);let a=0,b=0,lastUp=0,lastDown=0;const pending=[];
 const schedule=(target,raw,index,direction)=>{const now=Date.now(),delay=120+Math.sin(index*.7)*35,last=direction==='up'?lastUp:lastDown,due=Math.max(now+delay,last+1);if(direction==='up')lastUp=due;else lastDown=due;const timer=setTimeout(()=>{timers.delete(timer);if(target.readyState===1)target.send(raw.toString());},Math.max(0,due-now));timers.add(timer);};
 down.on('message',raw=>up.readyState===1?schedule(up,raw,++a,'up'):pending.push(raw));up.on('open',()=>pending.splice(0).forEach(raw=>schedule(up,raw,++a,'up')));up.on('message',raw=>schedule(down,raw,++b,'down'));
 down.on('close',()=>up.close());up.on('close',()=>down.close());down.on('error',()=>{});up.on('error',()=>{});
});
await new Promise(r=>proxy.listen(8793,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const errors=[];
const probe=`
window.__handlingProbe=()=>({time:performance.now(),x:car.position.x,y:car.position.y,z:car.position.z,yaw:p.yaw,speed:p.speed,steer:p.steer,camera:[camera.position.x,camera.position.y,camera.position.z],quaternion:[camera.quaternion.x,camera.quaternion.y,camera.quaternion.z,camera.quaternion.w]});
window.__wheelPhoto=(index=2)=>{const w=car.userData.wheels[index],point=w.getWorldPosition(new T.Vector3());camera.clearViewOffset();camera.position.copy(point).add(new T.Vector3(-1.5,.32,-.75).applyAxisAngle(new T.Vector3(0,1,0),p.yaw));camera.lookAt(point);renderer.render(arena.scene,camera);return renderer.domElement.toDataURL('image/png');};
window.__wheelBounds=()=>car.userData.wheels.map(w=>{const mesh=w.userData.casing,positions=mesh.geometry.attributes.position;let max=0;for(let i=0;i<positions.count;i++)max=Math.max(max,Math.hypot(positions.getY(i),positions.getZ(i)));return {radius:w.userData.radius,continuous:w.userData.continuousCasing,casingRadius:max,spin:w.userData.spin.rotation.x};});
`;
const cleanup=async page=>{try{if(await page.locator('#menu-button').isVisible())await page.locator('#menu-button').click();if(await page.locator('#leave').isVisible())await page.locator('#leave').click();}catch{}};
async function prepare(page,baseline=false){
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/play.mjs',async route=>{const source=baseline?baselineSource:await readFile('public/play.mjs','utf8');await route.fulfill({contentType:'text/javascript',body:source+probe});});
 await page.goto('http://127.0.0.1:8793');await page.waitForFunction(()=>window.__trailbound?.ready);
}
function metrics(trace){const speeds=[],angular=[],backwards=[];
 for(let i=1;i<trace.length;i++){const a=trace[i-1],b=trace[i],dt=(b.time-a.time)/1000;if(dt<.003||dt>.15||b.speed<1)continue;const forward=((b.x-a.x)*Math.sin(b.yaw)+(b.z-a.z)*Math.cos(b.yaw))/dt;speeds.push(forward);if(forward<-.05)backwards.push(forward);const dot=Math.abs(a.quaternion.reduce((s,v,k)=>s+v*b.quaternion[k],0));angular.push(2*Math.acos(Math.min(1,dot))/dt);}
 const percentile=(a,p)=>[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*p))]||0;
 return {frames:trace.length,backwardFrames:backwards.length,p95CameraAngularSpeed:percentile(angular,.95),p95ForwardSpeed:percentile(speeds,.95)};
}
try{
 const comparison={};
 for(const baseline of baselineSource?[true,false]:[false]){
  const context=await browser.newContext({viewport:{width:1360,height:850},deviceScaleFactor:1}),page=await context.newPage();await prepare(page,baseline);await page.locator('[data-map=snow]').click();await page.locator('#solo').click();await page.waitForFunction(()=>window.__trailbound.online);
  await page.evaluate(()=>{window.__trace=[];let end=performance.now()+5200;function record(){window.__trace.push(window.__handlingProbe());if(performance.now()<end)requestAnimationFrame(record);}requestAnimationFrame(record);});
  await page.keyboard.down('KeyW');await page.waitForTimeout(5000);await page.keyboard.up('KeyW');await page.waitForTimeout(300);const trace=await page.evaluate(()=>window.__trace);comparison[baseline?'before':'after']=metrics(trace);await writeFile(`${folder}/${baseline?'before':'after'}-trace.json`,JSON.stringify(trace));
  if(!baseline){
   await page.keyboard.down('KeyA');await page.waitForTimeout(150);assert.ok(Math.abs((await page.evaluate(()=>window.__trailbound.state)).steer)>.4);await page.keyboard.up('KeyA');await page.waitForTimeout(330);assert.equal((await page.evaluate(()=>window.__trailbound.state)).steer,0);
   const bounds=await page.evaluate(()=>window.__wheelBounds());assert.ok(bounds.every(w=>w.continuous&&Math.abs(w.casingRadius-.421)<.001&&w.radius===.43));assert.ok(bounds.some(w=>Math.abs(w.spin)>1));
   await page.screenshot({path:folder+'/driving-rebuilt.png'});const image=await page.evaluate(()=>window.__wheelPhoto());await writeFile(folder+'/wheel-close.png',Buffer.from(image.split(',')[1],'base64'));
   const code=await page.evaluate(()=>window.__trailbound.room),guest=await context.newPage();await prepare(guest);await guest.locator('#friends').click();await guest.locator('#code').fill(code);await guest.locator('#join').click();await guest.waitForFunction(()=>window.__trailbound.online&&window.__trailbound.peers.length===1);assert.equal(await guest.evaluate(()=>window.__trailbound.room),code);await cleanup(guest);
  }
  await cleanup(page);await context.close();
 }
 assert.equal(comparison.after.backwardFrames,0,'normal forward driving never renders a backward step');
 const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),mobile=await mobileContext.newPage();await prepare(mobile);await mobile.locator('#solo').tap();await mobile.waitForFunction(()=>window.__trailbound.online);const cdp=await mobileContext.newCDPSession(mobile);
 const point=async(key,id)=>{const r=await mobile.locator(`[data-key=${key}]`).boundingBox();return {id,x:r.x+r.width/2,y:r.y+r.height/2,radiusX:9,radiusY:9,force:1};};
 const start=await mobile.evaluate(()=>window.__trailbound.state),touches=[await point('KeyW',1),await point('KeyA',2)];await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});await mobile.waitForFunction(()=>window.__trailbound.input.activeTouches===2&&window.__trailbound.input.steer===1);await mobile.waitForTimeout(1600);const driven=await mobile.evaluate(()=>window.__trailbound.state);assert.ok(Math.hypot(driven.x-start.x,driven.z-start.z)>1);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForFunction(()=>window.__trailbound.input.activeTouches===0);await mobile.waitForTimeout(330);assert.equal((await mobile.evaluate(()=>window.__trailbound.state)).steer,0);
 const repeated=await point('KeyA',3);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[repeated]});await mobile.waitForTimeout(150);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await mobile.waitForTimeout(330);assert.equal((await mobile.evaluate(()=>window.__trailbound.state)).steer,0);assert.equal(await mobile.evaluate(()=>window.__trailbound.input.activeTouches),0);
 await mobile.setViewportSize({width:844,height:390});await mobile.waitForTimeout(250);assert.ok(await mobile.locator('#mobile-controls').isVisible());await mobile.screenshot({path:folder+'/touch-landscape.png'});await cleanup(mobile);await mobileContext.close();
 assert.deepEqual(errors,[]);const results={testServer:base,network:'ordered WebSocket proxy: 240 ms RTT plus variable 70 ms peak-to-peak jitter',comparison,keyboardTurnAndReturn:true,twoRealClients:true,continuousWheelModel:true,rotatingWheelChecked:true,mobile:'Chrome touch emulation, not physical hardware',simultaneousThrottleAndSteer:true,touchEndAndCancelCentre:true,landscape:true,errors};await writeFile(folder+'/browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{for(const context of browser.contexts())for(const page of context.pages())await cleanup(page);await browser.close();for(const timer of timers)clearTimeout(timer);for(const s of sockets)s.terminate();wss.close();await new Promise(r=>proxy.close(r));}
