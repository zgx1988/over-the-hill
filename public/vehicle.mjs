import * as T from '/vendor/three.module.js';
import {RoundedBoxGeometry} from '/vendor/RoundedBoxGeometry.js';
import {makeCrew,makeSteeringWheel} from './crew.mjs';
const mat=(c,metal=0,rough=.7)=>new T.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
const rubber=mat('#242726',.02,.98), steel=mat('#333d38',.7,.58),chrome=mat('#a9b1a6',.8,.3),canvas=mat('#565e48',0,1),seat=mat('#5b6047',0,.95),black=mat('#1c2421',.2,.7);
function box(group,w,h,d,m,x=0,y=0,z=0){const o=new T.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(.028,w/4,h/4,d/4)),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;}
function tube(group,points,r,m){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const o=new T.Mesh(new T.TubeGeometry(curve,Math.max(2,points.length*5),r,7,false),m);o.castShadow=true;group.add(o);return o;}
function cylinder(group,r1,r2,length,m,x,y,z,axis='x',segments=20){const o=new T.Mesh(new T.CylinderGeometry(r1,r2,length,segments),m);if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;o.position.set(x,y,z);o.castShadow=true;group.add(o);return o;}
function panel(group,points,depth,m,position,rotation){const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const geo=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.016,bevelSize:.018,bevelSegments:2,steps:1});const o=new T.Mesh(geo,m);o.position.set(...position);if(rotation)o.rotation.set(...rotation);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;}
function makeWheel(){
 const g=new T.Group(),spin=new T.Group();g.add(spin);
 const tire=new T.Mesh(new T.TorusGeometry(.305,.12,12,40),rubber);tire.rotation.y=Math.PI/2;spin.add(tire);
 cylinder(spin,.305,.305,.245,rubber,0,0,0,'x',40);
 cylinder(spin,.208,.208,.255,steel,0,0,0,'x',28);
 for(const side of [-1,1]){cylinder(spin,.17,.17,.018,chrome,side*.133,0,0,'x');cylinder(spin,.091,.095,.065,steel,side*.152,0,0,'x');
 for(let n=0;n<5;n++){const a=n*Math.PI*2/5;cylinder(spin,.017,.017,.02,chrome,side*.168,Math.cos(a)*.118,Math.sin(a)*.118,'x',6);}}
 const tread=new T.InstancedMesh(new T.BoxGeometry(.14,.045,.115),rubber,64),dummy=new T.Object3D();
 for(let i=0;i<32;i++)for(let side=0;side<2;side++){const a=i*Math.PI*2/32+(side?.04:0);dummy.position.set(side?.085:-.085,Math.cos(a)*.421,Math.sin(a)*.421);dummy.rotation.set(a,0,side?.28:-.28);dummy.updateMatrix();tread.setMatrixAt(i*2+side,dummy.matrix);}
 tread.castShadow=true;spin.add(tread);g.userData.spin=spin;return g;
}
export function makeVehicle(color='#8b9471'){
 const root=new T.Group(),body=new T.Group();root.add(body);
 const grime=document.createElement('canvas');grime.width=grime.height=256;const gc=grime.getContext('2d');gc.fillStyle='#ffffff';gc.fillRect(0,0,256,256);const gradient=gc.createLinearGradient(0,0,0,256);gradient.addColorStop(0,'rgba(76,66,43,.28)');gradient.addColorStop(.38,'rgba(108,101,74,.03)');gradient.addColorStop(1,'rgba(255,255,255,0)');gc.fillStyle=gradient;gc.fillRect(0,0,256,256);for(let i=0;i<3200;i++){const x=(Math.sin(i*72.35)*43758.54)%1*256,y=Math.abs((Math.sin(i*11.28)*16327.2)%1)*256;gc.fillStyle=`rgba(89,77,53,${.02+(1-y/256)*.12})`;gc.fillRect(Math.abs(x),y,1.2,1.2);}const grimeMap=new T.CanvasTexture(grime);grimeMap.colorSpace=T.SRGBColorSpace;
 const paint=mat(color,.32,.52);paint.map=grimeMap;const edge=mat('#6d765d',.45,.6);
 // Original period-inspired body: rounded pressed panels, open tub, solid steel ladder frame.
 for(const x of [-.48,.48])box(body,.105,.15,3.25,steel,x,-.22,0);
 for(const z of [-1.2,0,1.2])box(body,1.05,.08,.11,steel,0,-.22,z);
 box(body,1.39,.13,2.9,paint,0,-.04,-.08);
 panel(body,[[-.68,0],[-.72,.13],[-.68,.6],[.68,.6],[.72,.13],[.68,0]],1.14,paint,[0,.05,.34]);
 // Hood sits above engine bay with folded edges and a fine centre seam.
 box(body,1.38,.055,1.11,paint,0,.68,.92);
 box(body,.013,.008,1.04,edge,0,.713,.92);
 for(const x of [-.57,.57])for(const z of [.5,1.28]){box(body,.04,.035,.13,steel,x,.72,z);box(body,.035,.13,.025,steel,x*1.22,.54,z);}
 // Front grille with individual stamped vertical slots, round glass lamps and tow hooks.
 box(body,1.44,.66,.085,paint,0,.34,1.54);
 for(let i=-4;i<=4;i++){const x=i*.092;box(body,.045,.43,.015,black,x,.34,1.591);box(body,.012,.4,.022,edge,x+.031,.34,1.604);}
 const emissive=new T.MeshStandardMaterial({color:'#fff1c4',emissive:'#ffda8e',emissiveIntensity:1.6,roughness:.2});
 const lamps=[];for(const x of [-.57,.57]){cylinder(body,.155,.155,.095,edge,x,.49,1.57,'z',32);lamps.push(cylinder(body,.123,.123,.025,emissive,x,.49,1.632,'z',32));cylinder(body,.044,.044,.025,mat('#e4bc60',.1,.25),x,.18,1.607,'z');}
 box(body,1.87,.13,.17,steel,0,-.015,1.77);box(body,1.74,.12,.16,steel,0,-.04,-1.74);
 for(const x of [-.53,.53]){tube(body,[[x,-.02,1.81],[x,-.13,1.86],[x,-.18,1.74]],.028,chrome);}
 // Tub sides have a front step and rear wheel arch rather than solid rectangular blocks.
 const sideShape=[[-1.65,.03],[-1.65,.71],[-.63,.71],[-.44,.35],[.34,.35],[.44,.67],[.51,.67],[.51,.05]];
 for(const sx of [-1,1]){
  panel(body,sideShape,.045,paint,[sx<0?-.735:.78,0,0],[0,-Math.PI/2,0]);
  box(body,.25,.065,.79,steel,sx*.79,-.1,-.06);
  // Swept front fender with outward lip, thin steel rather than oversized blocks.
  panel(body,[[.24,.1],[.43,.29],[1.47,.29],[1.63,.21],[1.63,.15],[.48,.22]],.32,paint,[sx<0?-.66:.98,0,0],[0,-Math.PI/2,0]);
  box(body,.18,.043,.83,paint,sx*.78,.66,-1.13);
  tube(body,[[sx*.78,.27,-.4],[sx*.79,.3,-.29],[sx*.79,.3,.1]],.018,chrome);
 }
 box(body,1.46,.66,.055,paint,0,.35,-1.58);box(body,1.34,.08,.4,paint,0,.12,-1.3);
 // Canvas seats, rounded seatbacks, dashboard and working steering wheel.
 for(const x of [-.36,.36]){box(body,.55,.14,.58,seat,x,.26,-.23);const back=box(body,.55,.54,.12,seat,x,.57,-.53);back.rotation.x=-.09;}
 box(body,1.25,.15,.44,seat,0,.3,-1.14);
 box(body,1.32,.35,.07,paint,0,.55,.23);
 for(let i=0;i<4;i++){cylinder(body,i===0?.07:.035,i===0?.07:.035,.012,black,-.22+i*.19,.58,.183,'z');}
 tube(body,[[-.37,.43,.23],[-.37,.64,-.01]],.021,steel);
 const steering=makeSteeringWheel(body);
 const crew=makeCrew(body,steering);
 for(const x of [-.05,.08])tube(body,[[x,.12,-.05],[x,.43,-.08]],.012,steel);
 // Two-piece windscreen: thin steel frame and transparent glass with a slight rearward rake.
 const screen=new T.Group();screen.position.set(0,.7,.28);screen.rotation.x=.13;body.add(screen);
 const glass=new T.MeshPhysicalMaterial({color:'#b9d6d2',metalness:0,roughness:.08,transparent:true,opacity:.32,side:T.DoubleSide,depthWrite:false});
 box(screen,1.36,.68,.018,glass,0,.35,0);
 for(const x of [-.7,0,.7])box(screen,x===0?.026:.045,.77,.045,paint,x,.35,0);
 for(const y of [0,.73])box(screen,1.44,.045,.045,paint,0,y,0);
 for(const x of [-.32,.32]){const wiper=box(screen,.018,.32,.018,steel,x,.2,.038);wiper.rotation.z=-.32;}
 for(const sx of [-1,1]){tube(body,[[sx*.72,.75,.25],[sx*.96,.89,.22]],.016,steel);const mirror=new T.Mesh(new T.CircleGeometry(.083,16),chrome);mirror.position.set(sx*.98,.92,.19);mirror.rotation.y=Math.PI;body.add(mirror);}
 // Spare tire, fuel can, canvas roll and leather retaining straps.
 const spare=makeWheel();spare.rotation.y=Math.PI/2;spare.position.set(.21,.43,-1.81);spare.scale.setScalar(.93);body.add(spare);
 box(body,.32,.55,.16,edge,-.54,.4,-1.71);box(body,.15,.045,.06,chrome,-.54,.7,-1.71);box(body,.055,.56,.18,black,-.54,.4,-1.72);
 cylinder(body,.14,.14,.95,canvas,0,.58,-1.31,'x');for(const x of [-.33,.33])box(body,.045,.32,.29,black,x,.58,-1.31);
 const tailMat=new T.MeshStandardMaterial({color:'#8c3127',emissive:'#d23b23',emissiveIntensity:.8});for(const x of [-.59,.59])cylinder(body,.053,.053,.035,tailMat,x,.26,-1.62,'z');
 // Mechanical detail: two live axles, differential housings, driveshafts and leaf springs.
 const axles=[];for(const z of [1.15,-1.15]){const a=new T.Group();a.position.z=z;body.add(a);cylinder(a,.046,.046,1.47,steel,0,0,0);const diff=new T.Mesh(new T.SphereGeometry(.15,12,8),steel);diff.scale.set(1.2,1,1);a.add(diff);axles.push(a);}
 tube(body,[[0,-.3,-1.15],[.03,-.25,0],[0,-.3,1.15]],.036,steel);
 const springs=[];for(const x of [-.53,.53])for(const z of [-1.15,1.15])for(let layer=0;layer<3;layer++){const spring=tube(body,[[x,-.2-layer*.018,z-.43],[x,-.36-layer*.018,z],[x,-.2-layer*.018,z+.43]],.012,steel);spring.userData={z,base:spring.geometry.attributes.position.array.slice()};springs.push(spring);}
 const shocks=[];for(const x of [-.57,.57])for(const z of [1.15,-1.15]){const shock=new T.Mesh(new T.CylinderGeometry(.024,.024,1,10),chrome);shock.userData={x,z};body.add(shock);shocks.push(shock);}
 const wheels=[];for(const [x,z] of [[-.74,1.15],[.74,1.15],[-.74,-1.15],[.74,-1.15]]){const w=makeWheel();w.position.set(x,-.4,z);body.add(w);wheels.push(w);}
 const beams=[];for(const x of [-.57,.57]){const light=new T.SpotLight('#ffe5ae',175,58,.38,.6,1.1);light.position.set(x,.49,1.72);light.target.position.set(x,-.4,25);body.add(light,light.target);beams.push(light);}
 const rope=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:'#d8c397'}));root.add(rope);rope.visible=false;
 root.userData={body,wheels,axles,springs,shocks,lamps,emissive,beams,rope,steering,crew};return root;
}
export function updateVehicle(root,p,dt=.016){
 root.position.set(p.x,p.y,p.z);root.rotation.y=p.yaw;const {body,wheels,axles,springs,shocks,emissive,beams,rope}=root.userData;
 body.rotation.set(-p.pitch,0,p.roll,'YXZ');
 root.userData.crew?.update(p,dt);
 wheels.forEach((w,i)=>{w.position.y=p.wheels[i]??-.4;w.rotation.y=i<2?p.steer:0;w.userData.spin.rotation.x=p.wheelSpin;});
 axles.forEach((a,i)=>{a.position.y=(wheels[i*2].position.y+wheels[i*2+1].position.y)/2;const angle=Math.asin(T.MathUtils.clamp((wheels[i*2+1].position.y-wheels[i*2].position.y)/1.48,-.95,.95));a.rotation.z=angle;for(let j=0;j<2;j++){const w=wheels[i*2+j];w.position.x=(j?1:-1)*.74*Math.cos(angle);w.rotation.z=angle;}});
 for(const spring of springs){const a=axles[spring.userData.z>0?0:1],pos=spring.geometry.attributes.position,base=spring.userData.base;for(let i=0;i<pos.count;i++){const weight=Math.max(0,1-Math.abs(base[i*3+2]-spring.userData.z)/.46);pos.setY(i,base[i*3+1]+(a.position.y+.36)*weight);}pos.needsUpdate=true;}
 for(const shock of shocks){const {x,z}=shock.userData,axle=axles[z>0?0:1],start=new T.Vector3(x,-.1,z-.22),end=new T.Vector3(x,axle.position.y,z),delta=end.clone().sub(start);shock.position.copy(start).addScaledVector(delta,.5);shock.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize());shock.scale.y=delta.length();}
 emissive.emissiveIntensity=p.lights?1.6:.08;beams.forEach(l=>l.visible=p.lights);
 rope.visible=!!p.anchor;
 if(p.anchor){const local=new T.Vector3(p.anchor.x,p.anchor.y+1,p.anchor.z);root.worldToLocal(local);rope.geometry.setFromPoints([new T.Vector3(0,-.05,1.9),local]);}
}
