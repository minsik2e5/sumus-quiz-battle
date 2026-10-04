import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
fs.rmSync('dist',{recursive:true,force:true});
for(const args of [['node_modules/typescript/bin/tsc','--noEmit'],['node_modules/vite/bin/vite.js','build'],['node_modules/vite/bin/vite.js','build','--config','vite.worker.config.ts']]){
 const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);
}
fs.mkdirSync('dist/.openai',{recursive:true});fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
