import test,{before,after} from 'node:test';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
const url=process.env.TEST_WS||'ws://127.0.0.1:8898/ws';
let service;
before(async()=>{if(process.env.TEST_WS)return;service=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'8898',HOST:'127.0.0.1'},windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Test server startup timeout')),10000);service.stdout.on('data',bytes=>{if(bytes.toString().includes('local test ready')){clearTimeout(timer);resolve();}});service.once('error',reject);service.once('exit',code=>{if(code){clearTimeout(timer);reject(Error('Test server exited '+code));}});});});
after(()=>service?.kill());
const sockets=[];
async function client(request){const socket=new WebSocket(url);sockets.push(socket);const queue=[];socket.on('message',raw=>queue.push(JSON.parse(raw)));await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});socket.send(JSON.stringify({type:'join',...request}));const next=async(type,condition=()=>true)=>{const start=Date.now();while(Date.now()-start<4000){const i=queue.findIndex(m=>m.type===type&&condition(m));if(i>=0)return queue.splice(i,1)[0];await new Promise(r=>setTimeout(r,10));}throw Error(`Timeout waiting for ${type}`);};return {socket,next,welcome:await next(request.expectError?'error':'welcome')};}
test('real WebSocket clients match, synchronize, enforce room capacity and isolate private rooms',async()=>{
 try{
 const a=await client({mode:'match',name:'A'}),b=await client({mode:'match',name:'B'});assert.equal(a.welcome.code,b.welcome.code);
 const c=await client({mode:'join',code:a.welcome.code,name:'C'}),d=await client({mode:'join',code:a.welcome.code,name:'D'});assert.equal(d.welcome.players.length,4);
 const full=await client({mode:'join',code:a.welcome.code,expectError:true});assert.match(full.welcome.message,/满员/);
 const e=await client({mode:'match',name:'E'});assert.notEqual(e.welcome.code,a.welcome.code);
 const privateRoom=await client({mode:'create',name:'Private'});assert.equal(privateRoom.welcome.public,false);assert.notEqual(privateRoom.welcome.code,a.welcome.code);
 const start=a.welcome.players[0];const interval=setInterval(()=>a.socket.send(JSON.stringify({type:'input',throttle:1,steer:.1,low:true,lights:false})),45);
 let observed;try{observed=await b.next('state',m=>{const p=m.players.find(p=>p.id===a.welcome.id);return p&&Math.hypot(p.x-start.x,p.z-start.z)>4&&!p.lights;});}finally{clearInterval(interval);}
 assert.equal(observed.players.length,4);assert.ok(observed.discovered.includes('camp'),'discoveries are shared by the room');
 const movement=observed.players.find(p=>p.id===a.welcome.id);assert.ok(movement.speed>0,'server simulates driving inputs');
 const towLoop=setInterval(()=>{a.socket.send(JSON.stringify({type:'input',throttle:1,low:true}));b.socket.send(JSON.stringify({type:'input',winch:true,low:true}));},45);let tethered;try{tethered=await b.next('state',m=>m.players.find(p=>p.id===b.welcome.id)?.anchor?.vehicleId===a.welcome.id);}finally{clearInterval(towLoop);}assert.ok(tethered.players.find(p=>p.id===b.welcome.id).winch,'two real clients can establish a vehicle rescue tether');
 a.socket.send(JSON.stringify({type:'color',color:3}));const painted=await b.next('state',m=>m.players.find(p=>p.id===a.welcome.id)?.color===3);assert.equal(painted.players.find(p=>p.id===a.welcome.id).color,3);
 const isolated=await privateRoom.next('state');assert.equal(isolated.players.length,1);
 a.socket.send('{bad json');assert.match((await a.next('error')).message,/JSON|Unexpected|property/i);
 d.socket.close();const gone=await b.next('state',m=>m.players.length===3);assert.equal(gone.players.length,3);
 console.log(JSON.stringify({realClients:7,matchedRoom:a.welcome.code,capacity:4,serverMovement:Math.hypot(movement.x-start.x,movement.z-start.z),privateRoomIsolated:true,sharedDiscovery:true}));
 }finally{for(const s of sockets)s.close();}
});
