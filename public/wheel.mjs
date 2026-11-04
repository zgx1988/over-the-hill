import * as T from '/vendor/three.module.js';
import {TIRE_PROFILE,TREAD_ROWS,TREAD_RADIUS,TREAD_SIZE,WHEEL_RADIUS} from '/shared/wheel-spec.mjs';
const rubber=new T.MeshStandardMaterial({color:'#202321',roughness:.96});
const lettering=new T.MeshStandardMaterial({color:'#303530',roughness:.9});
const steel=new T.MeshStandardMaterial({color:'#7b8474',metalness:.65,roughness:.47});
const hubSteel=new T.MeshStandardMaterial({color:'#424b43',metalness:.7,roughness:.43});
const fastener=new T.MeshStandardMaterial({color:'#a4ab9e',metalness:.8,roughness:.35});
const recess=new T.MeshStandardMaterial({color:'#111914',roughness:1});
const cache=new Map();
function lathe(profile,segments){const g=new T.LatheGeometry(profile.map(([r,x])=>new T.Vector2(r,x)),segments);g.rotateZ(-Math.PI/2);return g;}
function mesh(parent,geometry,material){const m=new T.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function disc(parent,r,length,x,material,segments){const g=new T.CylinderGeometry(r,r,length,segments);g.rotateZ(Math.PI/2);const m=mesh(parent,g,material);m.position.x=x;return m;}
function geometry(simple){if(cache.has(simple))return cache.get(simple);const segments=simple?32:64;
 const casing=lathe(TIRE_PROFILE,segments),lug=new T.BoxGeometry(...TREAD_SIZE);
 // Pressed steel dish has actual depth; it sits inside the bead on each side.
 const rim=lathe([[.055,.158],[.08,.156],[.10,.119],[.14,.116],[.171,.139],[.19,.155],[.204,.153],[.207,.141],[.196,.133],[.172,.12],[.14,.102],[.10,.105],[.075,.144],[.055,.144],[.055,.158]],segments);
 const data={casing,lug,rim,segments};cache.set(simple,data);return data;
}
export function makeWheel({simple=false}={}){
 const wheel=new T.Group(),spin=new T.Group();wheel.add(spin);const geo=geometry(simple);
 const casing=mesh(spin,geo.casing,rubber);casing.name='continuous-tire-casing';
 const count=simple?24:36,rows=TREAD_ROWS.length,tread=new T.InstancedMesh(geo.lug,rubber,count*rows),dummy=new T.Object3D();
 // Every lug is embedded into the same casing, about the same X spin axis.
 for(let i=0;i<count;i++)for(let row=0;row<rows;row++){
  const angle=(i+(row%2)*.45)*Math.PI*2/count;
  dummy.position.set(TREAD_ROWS[row],Math.cos(angle)*TREAD_RADIUS,Math.sin(angle)*TREAD_RADIUS);
  dummy.rotation.set(angle,0,0);dummy.updateMatrix();tread.setMatrixAt(i*rows+row,dummy.matrix);
 }
 tread.name='embedded-tread';tread.castShadow=true;tread.receiveShadow=true;spin.add(tread);
 for(const side of [-1,1]){
  const rim=mesh(spin,geo.rim,steel);rim.scale.x=side;rim.name='dished-steel-rim';
  disc(spin,.061,.10,side*.174,hubSteel,simple?12:24);
  disc(spin,.041,.012,side*.23,fastener,12);
  for(let n=0;!simple&&n<5;n++){
   const a=n*Math.PI*2/5,vent=disc(spin,.021,.006,side*.14,recess,12);
   vent.position.y=Math.cos(a)*.142;vent.position.z=Math.sin(a)*.142;
   const bolt=disc(spin,.012,.025,side*.167,fastener,6);
   bolt.position.y=Math.cos(a)*.082;bolt.position.z=Math.sin(a)*.082;
  }
  if(!simple){
   const seam=mesh(spin,new T.TorusGeometry(.286,.0025,5,64),lettering);seam.rotation.y=Math.PI/2;seam.position.x=side*.163;
   const bead=mesh(spin,new T.TorusGeometry(.209,.004,6,64),rubber);bead.rotation.y=Math.PI/2;bead.position.x=side*.151;
  }
 }
 wheel.userData={spin,radius:WHEEL_RADIUS,casing,tread,continuousCasing:true};return wheel;
}
