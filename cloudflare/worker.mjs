// Local-only prototype adapter. No deployment is performed by this source.
import {RoomManager} from '../shared/rooms.mjs';
import {MAPS} from '../shared/maps.mjs';
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname==='/api/health')return Response.json({ok:true,version:'0.2.0'});if(['/ws','/api/maps','/api/rooms'].includes(url.pathname)){const origin=request.headers.get('Origin');if(origin&&new URL(origin).origin!==url.origin)return new Response('Origin rejected',{status:403});return env.VALLEY.get(env.VALLEY.idFromName('trailbound-v2-lobby')).fetch(request);}return env.ASSETS.fetch(request);}};
export class Valley {
 constructor(ctx,env){this.ctx=ctx;this.rooms=new RoomManager();this.timer=null;this.previous=Date.now();this.acc=0;}
 fetch(request){const path=new URL(request.url).pathname;
  if(path==='/api/maps')return Response.json(Object.values(MAPS).map(m=>({id:m.id,name:m.name,capacity:m.capacity,online:[...this.rooms.rooms.values()].filter(r=>r.mapId===m.id).reduce((n,r)=>n+r.players.size,0)})));
  if(path==='/api/rooms')return Response.json([...this.rooms.rooms.values()].filter(r=>r.public&&r.players.size).map(r=>({code:r.code,mapId:r.mapId,humans:r.players.size,bots:r.bots.length,capacity:MAPS[r.mapId].capacity})));
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  const [client,server]=Object.values(new WebSocketPair());server.accept();server.count=0;server.window=Date.now();
  server.addEventListener('message',event=>{if(typeof event.data!=='string'||event.data.length>4096){server.close(1009,'Message too large');return;}if(Date.now()-server.window>1000){server.window=Date.now();server.count=0;}if(++server.count>90){server.close(1008,'Rate limited');return;}try{const m=JSON.parse(event.data);if(m.type==='join'){server.send(JSON.stringify(this.rooms.join(server,m)));this.start();}else if(m.type==='input')this.rooms.input(server,m);else if(m.type==='action')this.rooms.action(server,m);else if(m.type==='color')this.rooms.appearance(server,m);else if(m.type==='ping')server.send(JSON.stringify({type:'pong',time:m.time}));else if(m.type==='horn'&&server.room)for(const c of server.room.players.keys())if(c!==server)c.send(JSON.stringify({type:'horn',id:server.player.id}));}catch(e){server.send(JSON.stringify({type:'error',message:e.message}));}});
  const leave=()=>this.rooms.leave(server);server.addEventListener('close',leave);server.addEventListener('error',leave);return new Response(null,{status:101,webSocket:client});
 }
 start(){if(this.timer)return;this.previous=Date.now();this.acc=0;this.timer=setInterval(()=>{const now=Date.now();this.acc+=Math.min((now-this.previous)/1000,.25);this.previous=now;while(this.acc>=1/60){this.rooms.tick();this.acc-=1/60;}for(const r of this.rooms.rooms.values())if(r.players.size&&r.tick-(r.broadcastTick||0)>=4){r.broadcastTick=r.tick;const json=JSON.stringify(this.rooms.snapshot(r));for(const c of r.players.keys()){try{c.send(json);}catch{this.rooms.leave(c);}}}if(!this.rooms.rooms.size){clearInterval(this.timer);this.timer=null;}},8);}
}
