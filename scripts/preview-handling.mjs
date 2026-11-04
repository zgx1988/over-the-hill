import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const port=8792,url=`http://127.0.0.1:${port}`,root=fileURLToPath(new URL('..',import.meta.url));
try{
 const response=await fetch(url+'/shared/presentation.mjs',{signal:AbortSignal.timeout(1500)});
 if(response.ok&&(await response.text()).includes('needsAuthoritativeReset')){
  console.log(`The handling-fix preview is already running: ${url}\nOpen that address in your browser. No second server was started.`);process.exit(0);
 }
 console.error(`Port ${port} is occupied by another service. The existing process was left running.`);process.exit(1);
}catch{}
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:String(port)},stdio:'inherit',windowsHide:true});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code||0;});
process.on('SIGINT',()=>child.kill('SIGINT'));
