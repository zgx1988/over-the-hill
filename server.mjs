import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer} from 'ws';
import {RoomManager} from './shared/rooms.mjs';
import {MAPS} from './shared/maps.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT)||8790,host=process.env.HOST||'127.0.0.1',rooms=new RoomManager();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/api/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,rooms:rooms.rooms.size,version:'0.2.0'}));return;}
 if(u.pathname==='/api/maps'||u.pathname==='/api/rooms'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(u.pathname==='/api/maps'?Object.values(MAPS).map(m=>({id:m.id,name:m.name,capacity:m.capacity,online:[...rooms.rooms.values()].filter(r=>r.mapId===m.id).reduce((n,r)=>n+r.players.size,0)})):[...rooms.rooms.values()].filter(r=>r.public&&r.players.size).map(r=>({code:r.code,mapId:r.mapId,humans:r.players.size,bots:r.bots.length,capacity:MAPS[r.mapId].capacity}))));return;}
 let file;const vendors={'three.module.js':'build/three.module.js','three.core.js':'build/three.core.js','RoundedBoxGeometry.js':'examples/jsm/geometries/RoundedBoxGeometry.js','RoomEnvironment.js':'examples/jsm/environments/RoomEnvironment.js'};
 if(u.pathname.startsWith('/vendor/')&&vendors[u.pathname.slice(8)])file=path.join(root,'node_modules/three',vendors[u.pathname.slice(8)]);
 else if(u.pathname.startsWith('/shared/'))file=path.join(root,u.pathname);
 else file=path.join(root,'public',u.pathname==='/'?'index.html':decodeURIComponent(u.pathname));
 const rel=path.relative(root,file);if(rel.startsWith('..')||path.isAbsolute(rel))throw Error();
 if(!['public','shared','node_modules'].some(p=>file.startsWith(path.join(root,p)+path.sep)))throw Error();
 const bytes=await readFile(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}});
const wss=new WebSocketServer({server,path:'/ws',maxPayload:4096});
wss.on('connection',(ws,req)=>{
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){ws.close(1008,'Origin rejected');return;}}catch{ws.close(1008);return;}}
 ws.isAlive=true;let count=0,start=Date.now();ws.on('pong',()=>ws.isAlive=true);
 ws.on('message',raw=>{if(Date.now()-start>1000){start=Date.now();count=0;}if(++count>90){ws.close(1008,'Rate limited');return;}try{const m=JSON.parse(raw);if(m.type==='join')ws.send(JSON.stringify(rooms.join(ws,m)));else if(m.type==='input')rooms.input(ws,m);else if(m.type==='color')rooms.appearance(ws,m);else if(m.type==='action')rooms.action(ws,m);else if(m.type==='ping')ws.send(JSON.stringify({type:'pong',time:m.time}));else if(m.type==='horn'&&ws.room)for(const c of ws.room.players.keys())if(c!==ws&&c.readyState===1)c.send(JSON.stringify({type:'horn',id:ws.player.id}));}catch(e){ws.send(JSON.stringify({type:'error',message:e.message||'消息格式错误'}));}});
 ws.on('close',()=>rooms.leave(ws));ws.on('error',()=>rooms.leave(ws));
});
let previous=performance.now(),acc=0;
const timer=setInterval(()=>{const now=performance.now();acc+=Math.min((now-previous)/1000,.25);previous=now;while(acc>=1/60){rooms.tick();acc-=1/60;}for(const r of rooms.rooms.values())if(r.players.size&&r.tick-(r.broadcastTick||0)>=4){r.broadcastTick=r.tick;const data=JSON.stringify(rooms.snapshot(r));for(const c of r.players.keys())if(c.readyState===1&&c.bufferedAmount<131072)c.send(data);}},8);
const heart=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},15000);
server.listen(port,host,()=>console.log(`TRAILBOUND local test ready: http://${host}:${port}\nVersion 0.2.0 / four maps / authoritative multiplayer. No deployment.`));
function stop(){clearInterval(timer);clearInterval(heart);for(const ws of wss.clients)ws.terminate();server.close(()=>process.exit(0));}process.on('SIGINT',stop);process.on('SIGTERM',stop);
