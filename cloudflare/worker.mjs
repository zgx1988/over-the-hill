// Future deployment adapter. This file is provided for review, not deployed.
// One Durable Object coordinates matchmaking and active rooms for this alpha.
// For production, shard regions/lobbies and move active matches to per-room DOs.
import {RoomManager} from '../shared/rooms.mjs';
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/ws'){
   const origin=request.headers.get('Origin');if(origin&&new URL(origin).origin!==url.origin)return new Response('Origin rejected',{status:403});
   const id=env.VALLEY.idFromName('pinewind-alpha-lobby');return env.VALLEY.get(id).fetch(request);
  }
  if(url.pathname==='/api/health')return Response.json({ok:true,version:'0.1.0'});
  return env.ASSETS.fetch(request);
 }
};
export class Valley {
 constructor(ctx,env){this.ctx=ctx;this.rooms=new RoomManager();this.timer=null;}
 fetch(request){
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  const [client,server]=Object.values(new WebSocketPair());server.accept();server.count=0;server.window=Date.now();
  server.addEventListener('message',event=>{
   if(typeof event.data!=='string'||event.data.length>4096){server.close(1009,'Message too large');return;}
   if(Date.now()-server.window>1000){server.count=0;server.window=Date.now();}if(++server.count>90){server.close(1008,'Rate limited');return;}
   try{const m=JSON.parse(event.data);if(m.type==='join'){server.send(JSON.stringify(this.rooms.join(server,m)));this.start();}else if(m.type==='input')this.rooms.input(server,m);else if(m.type==='color')this.rooms.appearance(server,m);else if(m.type==='ping')server.send(JSON.stringify({type:'pong',time:m.time}));else if(m.type==='horn'&&server.room){for(const c of server.room.players.keys())if(c!==server)c.send(JSON.stringify({type:'horn',id:server.player.id}));}}catch(e){server.send(JSON.stringify({type:'error',message:e.message}));}
  });
  const leave=()=>{this.rooms.leave(server);if(!this.rooms.rooms.size&&this.timer){clearInterval(this.timer);this.timer=null;}};server.addEventListener('close',leave);server.addEventListener('error',leave);
  return new Response(null,{status:101,webSocket:client});
 }
 start(){if(this.timer)return;this.timer=setInterval(()=>{this.rooms.tick();for(const r of this.rooms.rooms.values())if(r.tick%4===0){const json=JSON.stringify(this.rooms.snapshot(r));for(const c of r.players.keys()){try{c.send(json);}catch{this.rooms.leave(c);}}}},1000/60);}
}
