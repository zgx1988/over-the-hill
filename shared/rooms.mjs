import {createCar,stepCar,solveTethers,publicCar,FIXED_DT} from './physics.mjs';
export class RoomManager {
 constructor(){this.rooms=new Map();this.nextId=1;}
 code(){return (this.nextId++).toString(36).toUpperCase().padStart(4,'0');}
 join(client,request={}){
  this.leave(client);
  const mode=request.mode||'match';let room;
  if(mode==='join')room=this.rooms.get(String(request.code||'').toUpperCase());
  if(mode==='join'&&!room)throw Error('没有找到这个房间，请检查邀请码');
  if(mode==='match')room=[...this.rooms.values()].find(r=>r.public&&r.players.size<4);
  if(!room){const code=this.code();room={code,public:mode==='match',players:new Map(),discovered:[],tick:0};this.rooms.set(code,room);}
  if(room.players.size>=4)throw Error('房间已经满员（4/4）');
  const id=globalThis.crypto.randomUUID();const p=createCar(id,String(request.name||'旅人').replace(/[<>]/g,'').slice(0,12),room.players.size);
  if(Number.isInteger(request.color)&&request.color>=0&&request.color<4)p.color=request.color;
  room.players.set(client,p);client.room=room;client.player=p;
  return {type:'welcome',id,code:room.code,public:room.public,players:[...room.players.values()].map(publicCar),discovered:room.discovered};
 }
 leave(client){const room=client.room;if(!room)return;room.players.delete(client);client.room=null;client.player=null;if(!room.players.size)this.rooms.delete(room.code);}
 input(client,data){if(!client.player)return;const p=client.player;p.input={throttle:Math.max(-1,Math.min(1,Number(data.throttle)||0)),steer:Math.max(-1,Math.min(1,Number(data.steer)||0)),brake:!!data.brake,low:!!data.low,lights:data.lights!==false,winch:!!data.winch,reset:!!data.reset};p.lastInput=Date.now();}
 appearance(client,m){if(client.player&&Number.isInteger(m.color)&&m.color>=0&&m.color<4)client.player.color=m.color;}
 tick(){for(const room of this.rooms.values()){room.tick++;const cars=[...room.players.values()];for(const p of cars){if(Date.now()-(p.lastInput||0)>500)p.input={...p.input,throttle:0,steer:0,brake:true,reset:false};stepCar(p,p.input,FIXED_DT,cars);for(const id of p.discovered)if(!room.discovered.includes(id))room.discovered.push(id);}solveTethers(cars,FIXED_DT);}}
 snapshot(room){return {type:'state',tick:room.tick,time:Date.now(),players:[...room.players.values()].map(publicCar),discovered:room.discovered};}
}
