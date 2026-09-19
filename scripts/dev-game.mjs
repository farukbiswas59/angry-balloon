import { spawn } from 'node:child_process';
const children=[spawn(process.execPath,['--env-file-if-exists=.env','server/index.ts'],{stdio:'inherit'}),spawn(process.execPath,['scripts/run-framework.mjs','dev','--host','0.0.0.0'],{stdio:'inherit'})];
let closing=false;function stop(){if(closing)return;closing=true;for(const child of children)child.kill('SIGTERM');}for(const c of children){c.on('error',e=>{console.error(e);stop();});c.on('exit',code=>{stop();process.exitCode=code||0;});}process.on('SIGINT',stop);process.on('SIGTERM',stop);
