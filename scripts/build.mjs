import {cp,mkdir,writeFile} from 'node:fs/promises';
await mkdir('dist/vendor',{recursive:true});
await cp('public','dist',{recursive:true});await cp('shared','dist/shared',{recursive:true});
for(const name of ['three.module.js','three.core.js'])await cp(`node_modules/three/build/${name}`,`dist/vendor/${name}`);
await cp('node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js','dist/vendor/RoundedBoxGeometry.js');
await cp('node_modules/three/examples/jsm/environments/RoomEnvironment.js','dist/vendor/RoomEnvironment.js');
await cp('node_modules/three/LICENSE','dist/vendor/THREE-LICENSE.txt');
await writeFile('dist/_headers','/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n');
console.log('Local build complete: dist/ (no deployment performed)');
