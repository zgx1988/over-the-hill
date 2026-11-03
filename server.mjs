import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer} from 'ws';
import {RoomManager} from './shared/rooms.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT)||8787,host=process.env.HOST||'127.0.0.1';
const rooms=new RoomManager();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,rooms:rooms.rooms.size,version:'0.1.0'}));return;}
 let target;
 if(url.pathname==='/vendor/three.module.js')target=path.join(root,'node_modules/three/build/three.module.js');
 else if(url.pathname==='/vendor/three.core.js')target=path.join(root,'node_modules/three/build/three.core.js');
 else if(url.pathname==='/vendor/RoundedBoxGeometry.js')target=path.join(root,'node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js');
 else if(url.pathname==='/vendor/RoomEnvironment.js')target=path.join(root,'node_modules/three/examples/jsm/environments/RoomEnvironment.js');
 else if(url.pathname.startsWith('/shared/'))target=path.join(root,url.pathname);
 else target=path.join(root,'public',url.pathname==='/'?'index.html':decodeURIComponent(url.pathname));
 const relative=path.relative(root,target);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('invalid path');
 if(!target.startsWith(path.join(root,'public'))&&!target.startsWith(path.join(root,'shared'))&&!url.pathname.startsWith('/vendor/'))throw Error('invalid path');
 const bytes=await readFile(target);res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});
const wss=new WebSocketServer({server,path:'/ws',maxPayload:4096});
wss.on('connection',(ws,req)=>{
 const origin=req.headers.origin;if(origin){try{if(new URL(origin).host!==req.headers.host){ws.close(1008,'Origin rejected');return;}}catch{ws.close(1008);return;}}
 ws.isAlive=true;let count=0,window=Date.now();
 ws.on('pong',()=>ws.isAlive=true);
 ws.on('message',raw=>{
  if(Date.now()-window>1000){count=0;window=Date.now();}if(++count>90){ws.close(1008,'Rate limited');return;}
  try{const m=JSON.parse(raw);if(m.type==='join'){ws.send(JSON.stringify(rooms.join(ws,m)));}else if(m.type==='input')rooms.input(ws,m);else if(m.type==='color')rooms.appearance(ws,m);else if(m.type==='ping')ws.send(JSON.stringify({type:'pong',time:m.time}));else if(m.type==='horn'&&ws.room){for(const c of ws.room.players.keys())if(c!==ws&&c.readyState===1)c.send(JSON.stringify({type:'horn',id:ws.player.id}));}}catch(e){ws.send(JSON.stringify({type:'error',message:e.message||'消息格式错误'}));}
 });
 ws.on('close',()=>rooms.leave(ws));ws.on('error',()=>rooms.leave(ws));
});
const tick=setInterval(()=>{rooms.tick();for(const room of rooms.rooms.values())if(room.tick%4===0){const data=JSON.stringify(rooms.snapshot(room));for(const c of room.players.keys())if(c.readyState===1&&c.bufferedAmount<65536)c.send(data);}},1000/60);
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},15000);
server.listen(port,host,()=>console.log(`TRAILBOUND local test ready: http://${host}:${port}\nReal WebSocket multiplayer: ws://${host}:${port}/ws\nNo public deployment has been created.`));
function shutdown(){clearInterval(tick);clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();server.close(()=>process.exit(0));}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
