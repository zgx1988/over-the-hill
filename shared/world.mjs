export const MAP_SIZE = 880;
export const WATER = -2.4;
export const SPAWN = { x: -258, z: 262, yaw: 2.3 };
export const POIS = [
  { id: 'camp', name: '松风营地', subtitle: '从这里，把城市留在身后', x: -258, z: 262, icon: '01' },
  { id: 'ford', name: '浅溪渡口', subtitle: '挂上低速挡，慢慢穿过水面', x: -66, z: 108, icon: '02' },
  { id: 'cabin', name: '湖畔木屋', subtitle: '树林深处的一点暖光', x: 114, z: 162, icon: '03' },
  { id: 'lookout', name: '落日观景台', subtitle: '沿着山路，去看更远的风景', x: 205, z: -68, icon: '04' },
  { id: 'summit', name: '北岭电台', subtitle: '山顶有风，也有你的故事', x: -30, z: -280, icon: '05' },
];
export const ROUTE = [[-280,290],[-258,262],[-214,225],[-168,181],[-122,139],[-86,108],[-36,102],[27,124],[80,154],[114,162],[164,129],[189,72],[219,16],[205,-68],[154,-112],[88,-137],[17,-163],[-51,-192],[-30,-280]];
export const VEHICLES = {
  scout: { name: 'PIONEER 42', zh: '开拓者 · 经典四驱', color: '#8b9471', mass: 1160, power: 3.6, wheelbase: 2.3, track: 1.48, radius: .43, clearance: .82, maxSpeed: 12.5 },
};
export const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
export const lerp = (a,b,t) => a+(b-a)*t;
export function hash(x,z) { const n=Math.sin(x*127.1+z*311.7)*43758.5453; return n-Math.floor(n); }
function noise(x,z) { const a=Math.floor(x),b=Math.floor(z),u=x-a,v=z-b, f=u*u*(3-2*u),g=v*v*(3-2*v);return lerp(lerp(hash(a,b),hash(a+1,b),f),lerp(hash(a,b+1),hash(a+1,b+1),f),g); }
export function riverX(z){return -87+Math.sin(z*.011)*20+Math.sin(z*.026)*8;}
export function pathDistance(x,z) {
 let d=1e6;
 for(let i=1;i<ROUTE.length;i++) {const [ax,az]=ROUTE[i-1],[bx,bz]=ROUTE[i],dx=bx-ax,dz=bz-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);d=Math.min(d,Math.hypot(x-ax-t*dx,z-az-t*dz));}
 return d;
}
export function terrain(x,z) {
 const hill = 8+noise(x*.007+12,z*.007+9)*35+noise(x*.018,z*.018)*8;
 const north = 43*Math.exp(-((x+94)**2/42000+(z+255)**2/18000));
 const east = 36*Math.exp(-((x-218)**2/23000+(z+70)**2/28000));
 const valley = -19*Math.exp(-((x+48)**2/38000+(z-170)**2/50000));
 const river = Math.abs(x-riverX(z));
 const bank = clamp((river-9)/25,0,1);const blend=bank*bank*(3-2*bank);
 let h=lerp(-4.4, hill+north+east+valley,blend);
 const lake=Math.hypot((x-100)/1.25,z-220);
 if(lake<62) h=lerp(-6,h,clamp((lake-40)/22,0,1));
 const road=pathDistance(x,z);
 const rough=noise(x*.38,z*.38)-.5;
 h += rough*(road<5?.14:.8)+Math.sin(x*.27)*Math.cos(z*.34)*(road<5?.04:.22);
 // A short ford raises the streambed, making the crossing shallow and driveable.
 if(Math.abs(z-108)<13 && river<18) h=Math.max(h,-3.0+river*.025);
 // Staggered low earthen humps near camp form a real cross-axle test section.
 const dx=x+249,dz=z-253,a=2.3,u=dx*Math.cos(a)-dz*Math.sin(a),v=dx*Math.sin(a)+dz*Math.cos(a);
 if(Math.abs(u)<5&&Math.abs(v)<7)h+=.57*Math.exp(-((u-.8)**2/.48+(v-1.8)**2/1.3))+.57*Math.exp(-((u+.8)**2/.48+(v+1.8)**2/1.3));
 // Camp clearing follows terrain without a physics/render mismatch.
 return h;
}
export function surface(x,z) {
 const h=terrain(x,z), road=pathDistance(x,z);
 if(h<WATER+.05) return {name:'浅水',grip:.48,drag:1.2,color:'#567f7c'};
 if(Math.abs(x-riverX(z))<27) return {name:'湿泥',grip:.5,drag:.75,color:'#7b7161'};
 if(road<3.1) return {name:'砂石',grip:.88,drag:.14,color:'#b5a179'};
 const gx=(terrain(x+1,z)-terrain(x-1,z))/2,gz=(terrain(x,z+1)-terrain(x,z-1))/2;
 if(Math.hypot(gx,gz)>.72) return {name:'岩地',grip:.73,drag:.25,color:'#9a978a'};
 return {name:'草地',grip:.76,drag:.3,color:'#73865b'};
}
export function generateObstacles() {
 const list=[];
 for(let i=0;i<1000;i++) {
 const x=(hash(i,12)-.5)*820,z=(hash(i,21)-.5)*820,h=terrain(x,z);
 if(h<WATER+1||pathDistance(x,z)<5.8||POIS.some(p=>Math.hypot(x-p.x,z-p.z)<15)) continue;
 list.push({x,z,y:h,r:hash(i,4)>.78?1.3:.65,size:3.5+hash(i,8)*6,kind:hash(i,4)>.78?'rock':'tree',seed:i});
 }
 let seed=1100;for(let i=1;i<ROUTE.length;i++){const [ax,az]=ROUTE[i-1],[bx,bz]=ROUTE[i],len=Math.hypot(bx-ax,bz-az),nx=(bz-az)/len,nz=-(bx-ax)/len;for(let d=4;d<len;d+=8)for(const side of [-1,1]){const off=8+hash(seed,9)*8,x=ax+(bx-ax)*d/len+nx*off*side,z=az+(bz-az)*d/len+nz*off*side,y=terrain(x,z);if(y>WATER+1&&pathDistance(x,z)>5.8&&!POIS.some(p=>Math.hypot(x-p.x,z-p.z)<15))list.push({x,z,y,r:.65,size:5+hash(seed,8)*5,kind:'tree',seed});seed++;}}
 return list;
}
export const OBSTACLES=generateObstacles();
export const ANCHORS=OBSTACLES.filter(p=>p.kind==='tree');
export function nearestAnchor(p) { let best=null,d=24;for(const a of ANCHORS){const n=Math.hypot(a.x-p.x,a.z-p.z);if(n<d && n>3){d=n;best=a;}}return best;}
