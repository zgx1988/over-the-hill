import {createCar,stepCar,solveTethers,publicCar,FIXED_DT,resetCar} from './physics.mjs';
import {getMap,initialWorld,stepMechanisms,updateTasks} from './maps.mjs';
import {startMatch,stepSoccer,aiInput,teamSpawn} from './soccer.mjs';
const TEAMS=['blue','orange'];
export class RoomManager {
 constructor(){this.rooms=new Map();this.nextId=1;}
 code(){return (this.nextId++).toString(36).toUpperCase().padStart(4,'0');}
 players(room){return [...room.players.values(),...room.bots];}
 join(client,request={}){
  let room,restored;const map=getMap(request.mapId),mode=request.mode||'match';
  if(request.resumeToken){for(const r of this.rooms.values()){const slot=r.reserved.get(request.resumeToken);if(slot&&slot.until>Date.now()){room=r;restored=slot.player;r.reserved.delete(request.resumeToken);break;}}if(!restored)throw Error('恢复会话已过期，请重新创建或加入房间');}
  else if(mode==='join'){room=this.rooms.get(String(request.code||'').toUpperCase());if(!room)throw Error('没有找到这个房间，请检查邀请码');}
  else if(mode==='match')room=[...this.rooms.values()].find(r=>r.public&&r.mapId===map.id&&r.players.size<getMap(r.mapId).capacity);
  if(room&&room.players.size>=getMap(room.mapId).capacity)throw Error('房间已满员');
  this.leave(client,false);
  if(!room){const code=this.code();room={code,mapId:map.id,public:mode==='match',players:new Map(),bots:[],reserved:new Map(),discovered:[],tick:0,world:initialWorld(map.id),host:null};this.rooms.set(code,room);}
  const id=restored?.id||crypto.randomUUID(),p=restored||createCar(id,String(request.name||'山野旅人').replace(/[<>]/g,'').slice(0,12),room.players.size,room.mapId);
  if(!restored&&Number.isInteger(request.color)&&request.color>=0&&request.color<4)p.color=request.color;
  if(room.mapId==='soccer'&&!restored){let team=TEAMS.includes(request.team)?request.team:[...TEAMS].sort((a,b)=>[...room.players.values()].filter(p=>p.team===a).length-[...room.players.values()].filter(p=>p.team===b).length)[0];if([...room.players.values()].filter(p=>p.team===team).length>=5)team=team==='blue'?'orange':'blue';p.team=team;const remove=room.bots.findIndex(b=>b.team===team),fullTeam=this.players(room).filter(o=>o.team===team).length>=5,replacement=remove>=0&&fullTeam?room.bots.splice(remove,1)[0]:null;Object.assign(p,replacement?{x:replacement.x,z:replacement.z,yaw:replacement.yaw}:teamSpawn(team,this.players(room).filter(o=>o.team===team).length));p.y=.82;p.lastSafe={x:p.x,z:p.z,yaw:p.yaw};}
  if(restored&&room.mapId==='soccer'&&this.players(room).filter(q=>q.team===p.team).length>=5){const i=room.bots.findIndex(q=>q.team===p.team);if(i<0)throw Error('原队伍已满，请重新匹配');room.bots.splice(i,1);}
  if(!room.host)room.host=id;room.players.set(client,p);client.room=room;client.player=p;client.resumeToken=request.resumeToken||crypto.randomUUID();p.input={brake:true};p.lastInput=Date.now();
  if(mode==='bots'&&room.mapId==='soccer'){this.addBots(room,10-this.players(room).length);startMatch(room.world,this.players(room));}
  return {...this.snapshot(room),type:'welcome',id,code:room.code,public:room.public,resumeToken:client.resumeToken,restored:!!restored};
 }
 leave(client,reserve=true){const r=client.room;if(!r)return;const p=client.player;r.players.delete(client);if(reserve&&p&&client.resumeToken)r.reserved.set(client.resumeToken,{player:p,until:Date.now()+60000});if(r.host===p?.id)r.host=r.players.values().next().value?.id||null;client.room=null;client.player=null;if(!r.players.size&&!r.reserved.size)this.rooms.delete(r.code);}
 input(c,m){if(!c.player)return;c.player.input={throttle:Math.max(-1,Math.min(1,Number(m.throttle)||0)),steer:Math.max(-1,Math.min(1,Number(m.steer)||0)),brake:!!m.brake,low:!!m.low,lights:m.lights!==false,winch:!!m.winch,reset:!!m.reset};c.player.lastInput=Date.now();}
 appearance(c,m){if(c.player&&Number.isInteger(m.color)&&m.color>=0&&m.color<4)c.player.color=m.color;}
 addBots(r,count=1){if(r.mapId!=='soccer')throw Error('只有足球场可以添加 AI');for(let i=0;i<Math.min(10,Math.max(0,count));i++){const cars=this.players(r);if(cars.length>=10)break;const a=cars.filter(p=>p.team==='blue').length,b=cars.filter(p=>p.team==='orange').length,team=a<=b?'blue':'orange',p=createCar('ai-'+crypto.randomUUID(),'AI · '+['雪狐','岩鹰','松鼠','猎隼','北风'][r.bots.length%5],0,'soccer');p.isAI=true;p.team=team;Object.assign(p,teamSpawn(team,cars.filter(c=>c.team===team).length));p.y=.82;p.lastSafe={x:p.x,z:p.z,yaw:p.yaw};r.bots.push(p);}}
 action(c,m){const r=c.room;if(!r)return;if(m.action==='leave'){this.leave(c,false);return;}if(r.mapId!=='soccer')throw Error('此操作仅用于足球场');if(m.action==='addAI')this.addBots(r,1);else if(m.action==='fillAI')this.addBots(r,10);else if(m.action==='start'||m.action==='restart'){if(r.host!==c.player.id)throw Error('请由房主开始或重新开始比赛');if(m.action==='start'&&['playing','kickoff','goal'].includes(r.world.soccer.phase))return;startMatch(r.world,this.players(r));}else if(m.action==='removeAI'){if(r.host!==c.player.id)throw Error('只有房主可以清除 AI');r.bots=[];}}
 tick(dt=FIXED_DT){for(const r of this.rooms.values()){for(const [token,slot]of r.reserved)if(slot.until<Date.now())r.reserved.delete(token);if(!r.players.size){if(!r.reserved.size)this.rooms.delete(r.code);continue;}r.tick++;const cars=this.players(r);stepMechanisms(r.world,cars,dt);for(const p of cars){if(p.isAI)p.input=aiInput(p,cars,r.world);else if(Date.now()-(p.lastInput||0)>600)p.input={...p.input,throttle:0,steer:0,brake:true,reset:false};let command=p.input;if(r.mapId==='soccer'&&r.world.soccer.phase!=='playing')command={...command,throttle:0,brake:true,steer:0};stepCar(p,command,dt,cars,r.world);updateTasks(p,r.world,dt);if(r.mapId==='trials'&&p.fallTime>.65){p.falls++;resetCar(p);}for(const id of p.tasks)if(!r.discovered.includes(id))r.discovered.push(id);}solveTethers(cars,dt);if(r.mapId==='soccer')stepSoccer(r.world,cars,dt);}}
 snapshot(r){return {type:'state',tick:r.tick,time:Date.now(),mapId:r.mapId,host:r.host,code:r.code,players:this.players(r).map(publicCar),discovered:[...r.discovered],world:r.world,humans:r.players.size,bots:r.bots.length,capacity:getMap(r.mapId).capacity};}
}
