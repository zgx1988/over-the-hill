import * as T from '/vendor/three.module.js';
import {RoomEnvironment} from '/vendor/RoomEnvironment.js';
import {terrain,surface,hash,MAP_SIZE,WATER,OBSTACLES,POIS,riverX,ROUTE,pathDistance} from '/shared/world.mjs';
const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:1,...extra});
const palette={wood:material('#76624b'),dark:material('#4c5147'),roof:material('#405852'),cloth:material('#c37645'),stone:material('#8b8c7e')};
function box(g,w,h,d,m,x,y,z){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
function label(text,size=3,color='#eee8cc'){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#38463d';c.fillRect(0,0,512,128);c.strokeStyle='#bfc4a3';c.strokeRect(6,6,500,116);c.font='bold 48px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(text,256,64);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return new T.Mesh(new T.PlaneGeometry(size,size/4),new T.MeshStandardMaterial({map:texture,roughness:1,side:T.DoubleSide}));
}
function cabin(scene,x,z){const g=new T.Group();g.position.set(x,terrain(x,z),z);scene.add(g);
 box(g,7,.6,5,palette.stone,0,.3,0);box(g,6.6,4,4.6,palette.wood,0,2.5,0);
 for(let y=.7;y<4.6;y+=.36)box(g,6.7,.06,4.7,palette.dark,0,y,0);
 const shape=new T.Shape();shape.moveTo(-4,0);shape.lineTo(0,2.2);shape.lineTo(4,0);shape.closePath();const roof=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:5.6,bevelEnabled:false}),palette.roof);roof.position.set(0,4.4,-2.8);roof.castShadow=true;g.add(roof);
 box(g,1.2,2.6,.14,palette.dark,0,1.9,2.36);const window=material('#f3c87a',{emissive:'#eeb25d',emissiveIntensity:.5});for(const x of [-2,2]){box(g,1.2,1.2,.16,window,x,2.65,2.4);box(g,.07,1.26,.2,palette.dark,x,2.65,2.5);box(g,1.26,.07,.2,palette.dark,x,2.65,2.5);}
 box(g,.8,3.6,.8,palette.stone,2.1,5.4,-.6);box(g,7,.2,1.4,palette.wood,0,.55,3.1);
 return g;
}
function sign(scene,p){const g=new T.Group();const x=p.id==='camp'?p.x-12:p.x+6,z=p.id==='camp'?p.z+22:p.z+3;g.position.set(x,terrain(x,z),z);scene.add(g);box(g,.16,2.4,.16,palette.wood,0,1.2,0);const l=label(p.name,3.4);l.position.y=2.4;g.add(l);}
export function createScene(renderer){
 const scene=new T.Scene();scene.background=new T.Color('#d5dece');scene.fog=new T.FogExp2('#c9d2bc',.0019);
 const pmrem=new T.PMREMGenerator(renderer);const env=new RoomEnvironment();scene.environment=pmrem.fromScene(env,.04).texture;scene.environmentIntensity=.4;env.dispose();pmrem.dispose();
 const hemi=new T.HemisphereLight('#d9e7e0','#59664a',1.35);scene.add(hemi);
 const sun=new T.DirectionalLight('#ffe1a0',3.2);sun.position.set(-90,135,65);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:350});sun.shadow.bias=-.0007;sun.shadow.normalBias=.18;sun.shadow.radius=3;scene.add(sun,sun.target);
 const sky=new T.Mesh(new T.SphereGeometry(1600,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color('#7399a1')},bottom:{value:new T.Color('#ecd8ac')}},vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 v;void main(){float h=clamp(normalize(v).y*1.8,0.,1.);gl_FragColor=vec4(mix(bottom,top,pow(h,.7)),1.);}'}));scene.add(sky);
 const disc=new T.Mesh(new T.SphereGeometry(17,24,16),new T.MeshBasicMaterial({color:'#fff0bf',fog:false}));disc.position.set(-590,370,-750);scene.add(disc);
 // Flat shaded terrain with per-face botanical, gravel and exposed-stone colours.
 let geo=new T.PlaneGeometry(MAP_SIZE,MAP_SIZE,220,220);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++)pos.setY(i,terrain(pos.getX(i),pos.getZ(i)));geo.computeVertexNormals();geo=geo.toNonIndexed();const a=geo.attributes.position,colors=new Float32Array(a.count*3),c=new T.Color();
 for(let i=0;i<a.count;i+=3){const x=(a.getX(i)+a.getX(i+1)+a.getX(i+2))/3,z=(a.getZ(i)+a.getZ(i+1)+a.getZ(i+2))/3,h=terrain(x,z),s=surface(x,z);c.set(s.color);if(s.name==='草地')c.set(h>62?'#8e8e67':h>38?'#80895b':'#637e58');c.multiplyScalar(.92+hash(x,z)*.14);for(let k=0;k<3;k++){colors[(i+k)*3]=c.r;colors[(i+k)*3+1]=c.g;colors[(i+k)*3+2]=c.b;}}
 geo.setAttribute('color',new T.BufferAttribute(colors,3));const land=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1}));land.receiveShadow=true;scene.add(land);
 const trialGeo=new T.PlaneGeometry(20,20,80,80);trialGeo.rotateX(-Math.PI/2);const tp=trialGeo.attributes.position,tc=[];for(let i=0;i<tp.count;i++){const x=tp.getX(i)-249,z=tp.getZ(i)+253;tp.setXYZ(i,x,terrain(x,z)+.022,z);const col=new T.Color(surface(x,z).color);tc.push(col.r,col.g,col.b);}trialGeo.computeVertexNormals();trialGeo.setAttribute('color',new T.Float32BufferAttribute(tc,3));const trial=new T.Mesh(trialGeo,new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1}));trial.receiveShadow=true;scene.add(trial);
 // Narrow dark wheel ruts follow the actual heightfield along the entire trail.
 for(const side of [-1,1]){const rpos=[],ridx=[];let n=0;for(let i=1;i<ROUTE.length;i++){const [ax,az]=ROUTE[i-1],[bx,bz]=ROUTE[i],len=Math.hypot(bx-ax,bz-az),nx=(bz-az)/len,nz=-(bx-ax)/len;for(let d=0;d<=len;d+=1.7){const x=ax+(bx-ax)*d/len+nx*side*.77,z=az+(bz-az)*d/len+nz*side*.77;for(const edge of [-1,1]){const px=x+nx*edge*.13,pz=z+nz*edge*.13;rpos.push(px,terrain(px,pz)+.04,pz);}if(n>0)ridx.push(n*2-2,n*2,n*2-1,n*2-1,n*2,n*2+1);n++;}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(rpos,3));g.setIndex(ridx);g.computeVertexNormals();const rut=new T.Mesh(g,material('#8c815f',{transparent:true,opacity:.42,side:T.DoubleSide}));rut.receiveShadow=true;scene.add(rut);}
 // A continuous meandering shallow stream and small lake.
 const waterMat=new T.MeshStandardMaterial({color:'#699891',metalness:.25,roughness:.24,transparent:true,opacity:.82});
 const wpos=[],windices=[];for(let i=0;i<=160;i++){const z=-440+i*5.5,x=riverX(z);wpos.push(x-10,WATER,z,x+10,WATER,z);if(i<160){const n=i*2;windices.push(n,n+2,n+1,n+1,n+2,n+3);}}
 const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(wpos,3));wg.setIndex(windices);wg.computeVertexNormals();const river=new T.Mesh(wg,waterMat);scene.add(river);
 const lake=new T.Mesh(new T.CircleGeometry(49,48),waterMat);lake.rotation.x=-Math.PI/2;lake.scale.x=1.25;lake.position.set(100,WATER+.01,220);scene.add(lake);
 const ripples=new T.Group();scene.add(ripples);for(let i=0;i<70;i++){const z=(hash(i,6)-.5)*850,x=riverX(z)+(hash(i,7)-.5)*13;const o=new T.Mesh(new T.PlaneGeometry(.4+hash(i,3)*3,.12),new T.MeshBasicMaterial({color:'#b7d3b7',transparent:true,opacity:.23}));o.rotation.x=-Math.PI/2;o.position.set(x,WATER+.03,z);ripples.add(o);}
 // Distant ridges frame the playable valley; all art is generated here.
 for(let i=0;i<50;i++){const a=i/50*Math.PI*2,r=620+hash(i,8)*120,h=65+hash(i,9)*150;const mountain=new T.Mesh(new T.ConeGeometry(110+hash(i,12)*80,h,5),material(i%2?'#8fa79b':'#9eb1a0'));mountain.position.set(Math.sin(a)*r,h/2-10,Math.cos(a)*r);mountain.rotation.y=hash(i,4)*6;scene.add(mountain);}
 const trees=OBSTACLES.filter(o=>o.kind==='tree'),trunk=new T.InstancedMesh(new T.CylinderGeometry(.13,.24,1,5),palette.wood,trees.length);
 const leafMats=['#365d4c','#446c51','#557950','#8f8c50'].map(c=>material(c));const foliage=leafMats.map(m=>new T.InstancedMesh(new T.ConeGeometry(1,1,7),m,trees.length*3));const counts=[0,0,0,0],dummy=new T.Object3D();
 trees.forEach((o,i)=>{dummy.position.set(o.x,o.y+o.size*.32,o.z);dummy.scale.set(1,o.size*.64,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);const type=o.seed%4;for(let j=0;j<3;j++){dummy.position.set(o.x,o.y+o.size*(.5+j*.19),o.z);dummy.scale.set(o.size*(.31-j*.065),o.size*(.6-j*.09),o.size*(.31-j*.065));dummy.rotation.y=o.seed;dummy.updateMatrix();foliage[type].setMatrixAt(counts[type]++,dummy.matrix);}});
 trunk.castShadow=true;scene.add(trunk);foliage.forEach((f,i)=>{f.count=counts[i];f.castShadow=true;scene.add(f);});
 const rocks=OBSTACLES.filter(o=>o.kind==='rock');const rock=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),palette.stone,rocks.length);rocks.forEach((o,i)=>{dummy.position.set(o.x,o.y+.5,o.z);dummy.scale.set(o.r,o.r*.8,o.r*1.1);dummy.rotation.set(o.seed,.4,.5);dummy.updateMatrix();rock.setMatrixAt(i,dummy.matrix);});rock.castShadow=rock.receiveShadow=true;scene.add(rock);
 const grassGeo=new T.ConeGeometry(.2,.9,3),grass=new T.InstancedMesh(grassGeo,material('#b6b583'),1600);let gc=0;for(let i=0;i<2100&&gc<1600;i++){const x=(hash(i,81)-.5)*820,z=(hash(i,82)-.5)*820;if(terrain(x,z)<WATER+.4||pathDistance(x,z)<6)continue;dummy.position.set(x,terrain(x,z)+.3,z);dummy.scale.setScalar(.6+hash(i,9));dummy.rotation.set(0,i,0);dummy.updateMatrix();grass.setMatrixAt(gc++,dummy.matrix);}grass.count=gc;scene.add(grass);
 cabin(scene,114,175);
 const camp=new T.Group();camp.position.set(-272,terrain(-272,258),258);scene.add(camp);
 const tentGeo=new T.ConeGeometry(3,3.3,4),tent=new T.Mesh(tentGeo,palette.cloth);tent.rotation.y=Math.PI/4;tent.scale.z=1.5;tent.position.y=1.65;tent.castShadow=true;camp.add(tent);box(camp,1.4,.6,.8,palette.wood,4,.3,0);
 const fire=new T.Mesh(new T.OctahedronGeometry(.65),new T.MeshStandardMaterial({color:'#ee9a43',emissive:'#ee6525',emissiveIntensity:1.4}));fire.position.set(0,.5,6);camp.add(fire);for(let i=0;i<9;i++){const a=i/9*6.28;const stone=new T.Mesh(new T.DodecahedronGeometry(.3),palette.stone);stone.position.set(Math.sin(a),.1,6+Math.cos(a));camp.add(stone);}
 // Lookout decking and summit radio mast.
 const lookout=new T.Group();lookout.position.set(205,terrain(205,-68)+.12,-68);scene.add(lookout);for(let i=0;i<16;i++)box(lookout,8,.12,.45,palette.wood,0,0,-3.5+i*.46);for(const x of [-4,4])for(const z of [-3.5,0,3.5])box(lookout,.13,1.2,.13,palette.dark,x,.6,z);for(const x of [-4,4])box(lookout,.1,.1,7,palette.wood,x,1.18,0);
 const mast=new T.Group();mast.position.set(-39,terrain(-39,-280),-280);scene.add(mast);box(mast,.28,15,.28,palette.dark,0,7.5,0);for(let i=0;i<4;i++)box(mast,3-i*.5,.12,.12,palette.dark,0,11+i,0);const beacon=new T.Mesh(new T.SphereGeometry(.2,8,6),new T.MeshBasicMaterial({color:'#db6d46'}));beacon.position.y=15; mast.add(beacon);
 POIS.forEach(p=>sign(scene,p));
 const markers=POIS.map(p=>{const g=new T.Group();g.position.set(p.x,terrain(p.x,p.z)+5,p.z);const ring=new T.Mesh(new T.TorusGeometry(2,.045,6,40),new T.MeshBasicMaterial({color:'#f1c779',transparent:true,opacity:.7}));ring.rotation.x=-Math.PI/2;g.add(ring);scene.add(g);return g;});
 // Lightweight dust and water particles are pooled; there are no external asset requests.
 const dustCount=120,dustPositions=new Float32Array(dustCount*3),dustLife=new Float32Array(dustCount),dustVel=new Float32Array(dustCount*3);const dg=new T.BufferGeometry();dg.setAttribute('position',new T.BufferAttribute(dustPositions,3));const dust=new T.Points(dg,new T.PointsMaterial({color:'#d2c298',size:.6,transparent:true,opacity:.34,depthWrite:false}));scene.add(dust);let dustIndex=0;
 function particles(p,dt,time){for(let i=0;i<dustCount;i++){dustLife[i]-=dt;if(dustLife[i]<=0){dustPositions[i*3+1]=-100;continue;}dustPositions[i*3]+=dustVel[i*3]*dt;dustPositions[i*3+1]+=dustVel[i*3+1]*dt;dustPositions[i*3+2]+=dustVel[i*3+2]*dt;}
 if(Math.abs(p.speed)>1.2&&time%1<.9){for(let k=0;k<2;k++){const i=dustIndex++%dustCount;dustPositions[i*3]=p.x-Math.sin(p.yaw)*1.3+(Math.random()-.5)*1.3;dustPositions[i*3+1]=p.water>0?WATER+.3:terrain(p.x,p.z)+.4;dustPositions[i*3+2]=p.z-Math.cos(p.yaw)*1.3;dustLife[i]=.5+Math.random();dustVel[i*3]=(Math.random()-.5)*1.5;dustVel[i*3+1]=p.water>0?1.8:.4;dustVel[i*3+2]=(Math.random()-.5)*1.5;}}dg.attributes.position.needsUpdate=true;}
 return {scene,sun,hemi,sky,disc,markers,update(p,dt,time,atmosphere){
  sun.position.set(p.x-90,p.y+135,p.z+65);sun.target.position.set(p.x,p.y,p.z);sun.target.updateMatrixWorld();
  const dusk=atmosphere===1,mist=atmosphere===2;sun.intensity=dusk?.2:mist?1.1:2.4;sun.color.set(dusk?'#f1a363':mist?'#d6e7ed':'#ffe1a0');hemi.intensity=dusk?.32:mist?1.2:1.35;hemi.color.set(dusk?'#6f8da1':mist?'#b5d4db':'#d9e7e0');scene.environmentIntensity=dusk?.15:.4;
  scene.fog.color.set(dusk?'#929b9c':mist?'#adbfc3':'#c9d2bc');scene.fog.density=mist?.004:.0019;
  sky.material.uniforms.top.value.set(dusk?'#3f5b72':mist?'#aabbb5':'#7399a1');sky.material.uniforms.bottom.value.set(dusk?'#d7a27e':'#ecd8ac');
  disc.visible=!mist;markers.forEach((m,i)=>{m.children[0].rotation.z=time*.2;m.position.y=terrain(POIS[i].x,POIS[i].z)+4.5+Math.sin(time+i)*.3;m.visible=!p.discovered.includes(POIS[i].id);});
  fire.scale.set(1+Math.sin(time*9)*.1,1+Math.sin(time*14)*.15,1);particles(p,dt,time);
 }};
}
