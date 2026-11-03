import * as T from '/vendor/three.module.js';
import {createCrewMotion,stepCrewMotion,solveArm} from '/shared/crew-motion.mjs';
const UP=new T.Vector3(0,1,0);
const material=(color,roughness=.86)=>new T.MeshStandardMaterial({color,roughness,metalness:0});
const leather=material('#514333'),belt=material('#303933'),sole=material('#292d29'),eyes=material('#2d302b',.5),lip=material('#885e50');
function segment(node,a,b,rx,rz=rx){const av=new T.Vector3(...a),delta=new T.Vector3(...b).sub(av);node.position.copy(av).addScaledVector(delta,.5);node.quaternion.setFromUnitVectors(UP,delta.clone().normalize());node.scale.set(rx,delta.length(),rz);}
function uniformTexture(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.fillStyle='#eeeeea';g.fillRect(0,0,64,64);for(let i=0;i<64;i++){g.fillStyle=i%2?'#ffffff':'#deded7';g.fillRect(i,0,.6,64);g.fillRect(0,i,64,.35);}const map=new T.CanvasTexture(c);map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(2,2);map.colorSpace=T.SRGBColorSpace;return map;}
const fabric=uniformTexture();
function clothes(color){const m=material(color,.96);m.map=fabric;return m;}
// Each part has its own transform, but shared geometries/materials are instanced in batches.
// The driver and passenger therefore retain articulated hands, elbows and faces on mobile.
export function makeCrew(body,steering,{lowDetail=false}={}){
 const root=new T.Group();root.name='vehicle-occupants';body.add(root);const batches=new Map(),motion=createCrewMotion();
 const geometries={sphere:new T.SphereGeometry(1,lowDetail?10:16,lowDetail?8:12),cylinder:new T.CylinderGeometry(1,1,1,lowDetail?8:12),box:new T.BoxGeometry(1,1,1),torso:new T.LatheGeometry([[.14,0],[.15,.09],[.17,.25],[.19,.34],[.15,.39],[.065,.43]].map(p=>new T.Vector2(...p)),lowDetail?10:18)};
 function part(parent,shape,mat,pos,scale,name=''){const node=new T.Object3D();node.name=name;node.position.set(...pos);node.scale.set(...scale);parent.add(node);const key=shape+mat.uuid;if(!batches.has(key))batches.set(key,{shape,mat,nodes:[]});batches.get(key).nodes.push(node);return node;}
 function link(parent,a,b,r,mat,rz=r){const node=part(parent,'cylinder',mat,[0,0,0],[1,1,1]);segment(node,a,b,r,rz);return node;}
 const people=[];
 for(const [index,x] of [-.36,.36].entries()){
  const driver=index===0,jacket=clothes(driver?'#6e7963':'#ad7653'),pants=clothes(driver?'#4d5651':'#46575c'),skin=material(driver?'#c9a080':'#b88f74',.73),hair=material(driver?'#4b4638':'#433d33'),hat=clothes(driver?'#57634e':'#4c6870');
  const seatRoot=new T.Group();seatRoot.name=driver?'driver':'passenger';seatRoot.position.set(x,.405,-.34);root.add(seatRoot);
  part(seatRoot,'sphere',pants,[0,0,0],[.16,.10,.115]);
  const spine=new T.Group();spine.position.set(0,.075,-.012);seatRoot.add(spine);
  const torso=part(spine,'torso',jacket,[0,0,0],[1,1,.67],'jacket');
  part(spine,'sphere',jacket,[0,.055,.02],[.15,.095,.112]);
  part(spine,'sphere',skin,[0,.455,0],[.055,.07,.055]);
  for(const side of [-1,1]){const collar=part(spine,'box',jacket,[side*.05,.415,.075],[.055,.08,.022]);collar.rotation.z=-side*.35;}
  link(spine,[0,.04,.106],[0,.38,.113],.004,belt,.002);
  if(!lowDetail){for(const side of [-1,1]){part(spine,'box',jacket,[side*.085,.23,.111],[.10,.085,.012]);part(spine,'sphere',belt,[side*.085,.265,.12],[.006,.006,.004]);}}
  // Three-point webbing moves with the torso, with a lap belt anchored at the pelvis.
  link(spine,[-.135,.365,.09],[.095,.035,.11],.018,belt,.004);link(seatRoot,[-.135,.025,.08],[.13,.005,.095],.018,belt,.004);part(seatRoot,'box',sole,[.075,.025,.105],[.045,.031,.016]);
  const head=new T.Group();head.position.set(0,.607,.018);spine.add(head);part(head,'sphere',skin,[0,0,0],[.103,.134,.103]);
  part(head,'sphere',skin,[0,-.055,.04],[.083,.075,.077]);
  part(head,'sphere',hair,[0,.062,-.012],[.106,.079,.101]);
  part(head,'sphere',hat,[0,.095,-.009],[.111,.067,.107]);
  if(driver){part(head,'sphere',hat,[0,.075,.095],[.12,.012,.088]);}else{part(head,'cylinder',hat,[0,.057,-.002],[.111,.035,.107]);}
  for(const side of [-1,1]){part(head,'sphere',skin,[side*.103,-.015,0],[.018,.034,.022]);if(!lowDetail){part(head,'sphere',eyes,[side*.036,.013,.099],[.010,.006,.005]);const brow=part(head,'sphere',hair,[side*.035,.034,.096],[.024,.004,.006]);brow.rotation.z=-side*.08;}}
  part(head,'sphere',skin,[0,-.012,.111],[.020,.031,.027]);if(!lowDetail)part(head,'sphere',lip,[0,-.063,.103],[.027,.003,.004]);
  const legs=[];
  for(const side of [-1,1]){const hip=[side*.10,-.015,.015],knee=[side*.105,-.13,.385],ankle=[side*.105,-.345,.465];link(seatRoot,hip,knee,.072,pants,.066);link(seatRoot,knee,ankle,.052,pants,.046);part(seatRoot,'sphere',pants,knee,[.066,.057,.065]);const boot=part(seatRoot,'sphere',leather,[side*.105,-.35,.535],[.059,.055,.119]);part(seatRoot,'box',sole,[side*.105,-.389,.54],[.112,.016,.215]);legs.push(boot);}
  const shoulders=[],arms=[];
  for(const side of [-1,1]){const shoulder=new T.Object3D();shoulder.position.set(side*.165,.375,0);spine.add(shoulder);shoulders.push(shoulder);part(spine,'sphere',jacket,[side*.16,.365,0],[.069,.072,.073]);
   const upper=part(root,'cylinder',jacket,[0,0,0],[1,1,1]),forearm=part(root,'cylinder',jacket,[0,0,0],[1,1,1]),elbow=part(root,'sphere',jacket,[0,0,0],[.046,.046,.046]),cuff=part(root,'sphere',belt,[0,0,0],[.035,.027,.035]);
   const hand=new T.Group();root.add(hand);part(hand,'sphere',driver?leather:skin,[0,0,-.019],[.038,.052,.025]);
   if(!lowDetail){for(let f=0;f<4;f++){const y=-.025+f*.016,mat=driver?leather:skin;link(hand,[-side*.018,y,-.025],[side*.018,y,.002],.008,mat);link(hand,[side*.018,y,.002],[side*.01,y,.018],.007,mat);}part(hand,'sphere',driver?leather:skin,[-side*.03,-.031,-.003],[.013,.028,.016]);}
   arms.push({side,upper,forearm,elbow,cuff,hand,reachError:0,wrist:new T.Vector3(),target:new T.Vector3()});
  }
  people.push({role:driver?'driver':'passenger',seatRoot,spine,head,legs,shoulders,arms});
 }
 for(const batch of batches.values()){batch.mesh=new T.InstancedMesh(geometries[batch.shape],batch.mat,batch.nodes.length);batch.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);batch.mesh.frustumCulled=false;batch.mesh.castShadow=!lowDetail;batch.mesh.receiveShadow=true;root.add(batch.mesh);}
 const inverse=new T.Matrix4(),matrix=new T.Matrix4(),point=new T.Vector3(),bodyQuaternion=new T.Quaternion(),wheelQuaternion=new T.Quaternion();
 const gripPoints=[new T.Vector3(-.131,0,0),new T.Vector3(.131,0,0)];
 function update(p,dt){stepCrewMotion(motion,p,dt);steering.spin.rotation.z=motion.steering;
  for(const actor of people){const response=motion[actor.role];actor.spine.rotation.set(response.pitch,0,response.roll,'XYZ');actor.spine.position.y=.075+response.heave;actor.head.rotation.set(-response.pitch*.38,(p.steer||0)*(actor.role==='driver'?.35:.10)+(actor.role==='passenger'?-.06:0),-response.roll*.35);if(actor.role==='driver')actor.legs[1].rotation.x=Math.max(-.12,Math.min(.12,-motion.acceleration*.012));}
  root.updateWorldMatrix(true,true);inverse.copy(root.matrixWorld).invert();root.getWorldQuaternion(bodyQuaternion).invert();steering.spin.getWorldQuaternion(wheelQuaternion);wheelQuaternion.premultiply(bodyQuaternion);
  for(const actor of people){for(let i=0;i<2;i++){const arm=actor.arms[i];
   if(actor.role==='driver'){point.copy(gripPoints[i]);steering.spin.localToWorld(point);point.applyMatrix4(inverse);arm.hand.position.copy(point);arm.hand.quaternion.copy(wheelQuaternion);arm.target.copy(point);}
   else{arm.hand.position.set(i===0?.255:.64,i===0?.50:.49,i===0?-.035:-.17);arm.hand.rotation.set(.32,i===0?-.16:.18,i===0?-.14:.15);arm.target.copy(arm.hand.position);}
   arm.hand.updateWorldMatrix(true,true);point.set(0,-.052,-.021);arm.hand.localToWorld(point);point.applyMatrix4(inverse);arm.wrist.copy(point);
   const shoulder=actor.shoulders[i].getWorldPosition(new T.Vector3()).applyMatrix4(inverse),solved=solveArm(shoulder.toArray(),point.toArray(),[arm.side*.8,-.8,-.3],actor.role==='driver'?.265:.275,actor.role==='driver'?.25:.265);arm.reachError=solved.reachError;
   segment(arm.upper,shoulder.toArray(),solved.elbow,.056,.051);segment(arm.forearm,solved.elbow,solved.wrist,.041,.037);arm.elbow.position.fromArray(solved.elbow);arm.cuff.position.fromArray(solved.wrist);arm.cuff.quaternion.copy(arm.forearm.quaternion);
  }}
  root.updateWorldMatrix(true,true);inverse.copy(root.matrixWorld).invert();for(const batch of batches.values()){batch.nodes.forEach((node,i)=>{matrix.multiplyMatrices(inverse,node.matrixWorld);batch.mesh.setMatrixAt(i,matrix);});batch.mesh.instanceMatrix.needsUpdate=true;}
 }
 function diagnostics(){return {occupants:people.map(a=>({role:a.role,headPosition:a.head.getWorldPosition(new T.Vector3()).toArray(),lean:{pitch:motion[a.role].pitch,roll:motion[a.role].roll,heave:motion[a.role].heave},arms:a.arms.map(arm=>({reachError:arm.reachError,grip:arm.target.toArray(),wrist:arm.wrist.toArray()}))})),steeringAngle:motion.steering,acceleration:motion.acceleration,lateralAcceleration:motion.lateral,renderBatches:batches.size,lowDetail};}
 return {root,people,motion,update,diagnostics};
}

export function makeSteeringWheel(body,{simple=false}={}){const frame=new T.Group(),spin=new T.Group();frame.name='steering-column';frame.position.set(-.37,.65,-.04);frame.rotation.x=.65;frame.add(spin);body.add(frame);const metal=material('#39433c',.5);const rim=new T.Mesh(new T.TorusGeometry(.145,.012,6,simple?18:32),metal);spin.add(rim);const hub=new T.Mesh(new T.CylinderGeometry(.025,.025,.025,12),metal);hub.rotation.x=Math.PI/2;spin.add(hub);for(let i=0;i<3;i++){const a=i*Math.PI*2/3+.15,o=new T.Mesh(new T.CylinderGeometry(.006,.006,.116,6),metal);o.position.set(Math.cos(a)*.072,Math.sin(a)*.072,0);o.rotation.z=a-Math.PI/2;spin.add(o);}const mark=new T.Mesh(new T.BoxGeometry(.018,.026,.018),material('#bba67a'));mark.position.y=.144;spin.add(mark);return {frame,spin};}
