import test,{after} from 'node:test';import assert from 'node:assert/strict';import { WebSocket } from 'ws';
import { spawn } from 'node:child_process';
import { C,grid } from '../game/engine.ts';
const server=spawn(process.execPath,['server/index.ts'],{env:{...process.env,PORT:'3099',ALLOWED_ORIGINS:'http://localhost:5173'},stdio:['ignore','pipe','pipe']});
await new Promise<void>((resolve,reject)=>{server.stdout.once('data',()=>resolve());server.once('error',reject);server.once('exit',()=>reject(Error('Test server failed to start')));});
after(()=>server.kill('SIGTERM'));
function client(){const ws=new WebSocket('ws://localhost:3099/socket',{origin:'http://localhost:5173'});const messages:any[]=[];const waiters:{match:(m:any)=>boolean;resolve:(m:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}[]=[];ws.on('message',raw=>{const m=JSON.parse(raw.toString());messages.push(m);for(const w of [...waiters])if(w.match(m)){clearTimeout(w.timer);waiters.splice(waiters.indexOf(w),1);w.resolve(m);}});return {ws,messages,send:(m:unknown)=>ws.send(JSON.stringify(m)),wait:(match:(m:any)=>boolean)=>new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Timed out waiting for network message')),12000);waiters.push({match,resolve,reject,timer});}),open:()=>new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);})};}
test('new private rooms start with two bot Builders and hosts may turn them off',async()=>{
 const c=client();try{
  await c.open();const joined=c.wait(m=>m.type==='joined');c.send({type:'join',mode:'create',name:'Host'});
  const first=await joined;assert.equal(first.state.players.filter((p:any)=>p.bot).length,2);
  assert.equal(first.state.host,first.id);
  const removed=c.wait(m=>m.state?.players.filter((p:any)=>p.bot).length===1);
  c.send({type:'bot-builder',team:'blue',enabled:false});await removed;
 }finally{c.ws.close();}
});
test('four independent sockets share room, movement, authoritative ammo, reconnect and match state',{timeout:15000},async()=>{const clients=Array.from({length:4},client);let reconnect:ReturnType<typeof client>|null=null;try{await Promise.all(clients.map(c=>c.open()));const joined=clients[0].wait(m=>m.type==='joined');clients[0].send({type:'join',mode:'create',botBuilders:false,name:'Network0'});const first=await joined,code=first.state.code;const rest=await Promise.all(clients.slice(1).map(async(c,i)=>{const promise=c.wait(m=>m.type==='joined');c.send({type:'join',mode:'join',name:'Network'+(i+1),code});return promise;}));const all=[first,...rest];const lobbyReady=clients[0].wait(m=>m.state?.players.filter((p:any)=>p.team).length===4);clients.forEach((c,i)=>c.send({type:'team',team:i<2?'blue':'red'}));await lobbyReady;const started=clients[3].wait(m=>m.state?.phase==='countdown');clients[0].send({type:'start'});const intro=await started;assert.equal(intro.state.players.filter((p:any)=>p.role==='builder').length,2);const active=await clients[0].wait(m=>(m.state?.phase||m.phase)==='playing');const ps=active.state?.players||active.players;const shooter=ps.find((p:any)=>p.id===all[1].id);assert.equal(shooter.ammo,30);const sawMove=clients[3].wait(m=>(m.state?.players||m.players)?.some((p:any)=>p.id===all[1].id&&p.seq===1));clients[1].send({type:'input',x:1,y:0,seq:1});await sawMove;const consumed=clients[2].wait(m=>(m.state?.players||m.players)?.some((p:any)=>p.id===all[1].id&&p.ammo===29));clients[1].send({type:'shoot',dx:100,dy:-50,ammo:999,kills:999});await consumed;clients[1].ws.close();reconnect=client();await reconnect.open();const resumed=reconnect.wait(m=>m.type==='joined');reconnect.send({type:'resume',token:all[1].token});const m=await resumed,p=m.state.players.find((p:any)=>p.id===all[1].id);assert.equal(p.ammo,29);assert.equal(p.team,'blue');assert.equal(p.role,'shooter');assert.equal(p.stats.kills,0);assert.equal(m.state.players.length,4);}finally{clients.forEach(c=>c.ws.close());reconnect?.ws.close();}});

test('Quick Play matches independent humans with default bot Builders and starts on the server',{timeout:20000},async()=>{
 const a=client(),b=client();try{await Promise.all([a.open(),b.open()]);const pa=a.wait(m=>m.type==='joined');a.send({type:'join',mode:'quick',name:'QuickBlue',team:'blue'});const first=await pa;
 const pb=b.wait(m=>m.type==='joined');b.send({type:'join',mode:'quick',name:'QuickRed',team:'red'});const second=await pb;
 assert.equal(first.state.code,second.state.code);assert.equal(second.state.players.filter((p:any)=>p.bot&&p.role==='builder').length,2);assert.equal(second.state.players.find((p:any)=>p.id===second.id).team,'red');
 const denied=b.wait(m=>m.type==='error');b.send({type:'bot-builder',team:'red',enabled:false});assert.match((await denied).message,/private-room host/);
 const started=await a.wait(m=>m.state?.phase==='countdown');assert.equal(started.state.players.length,4);assert.equal(started.state.botBuilders,true);
 }finally{a.ws.close();b.ws.close();}
});

test('a fired arrow destroys a placed enemy crate and all four browsers receive the removal',{timeout:15000},async()=>{
 const clients=Array.from({length:4},client);
 try{
  await Promise.all(clients.map(c=>c.open()));
  const hostJoined=clients[0].wait(m=>m.type==='joined');
  clients[0].send({type:'join',mode:'create',botBuilders:false,name:'CrateHost'});
  const host=await hostJoined;
  const joined=[host];
  for(let i=1;i<4;i++){
   const pending=clients[i].wait(m=>m.type==='joined');
   clients[i].send({type:'join',mode:'join',code:host.state.code,name:'Crate'+i});
   joined.push(await pending);
  }
  const teamsReady=clients[0].wait(m=>m.state?.players.every((p:any)=>p.team));
  clients.forEach((c,i)=>c.send({type:'team',team:i<2?'blue':'red'}));
  await teamsReady;
  const playing=clients[0].wait(m=>(m.state?.phase||m.phase)==='playing');
  clients[0].send({type:'start'});
  await playing;
  const placed=clients[1].wait(m=>m.state?.walls.red[2]>0);
  clients[2].send({type:'place',slot:2});
  const before=(await placed).state;
  const shooter=before.players.find((p:any)=>p.id===joined[1].id),target=grid('red',2);
  const removals=clients.map(c=>c.wait(m=>m.state?.walls.red[2]===0&&m.state.events.some((e:any)=>e.type==='break'&&e.slot===2&&e.player===shooter.id)));
  // A one-second ballistic shot through the center of the crate, using only public input.
  clients[1].send({type:'shoot',dx:(target.x-shooter.x)/C.sensitivity,dy:(target.y-shooter.y-.5*C.gravity)/C.sensitivity});
  for(const m of await Promise.all(removals)){
   const p=m.state.players.find((p:any)=>p.id===shooter.id);
   assert.equal(p.stats.broken,1);
   assert.equal(p.ammo,before.walls.red[2]===2?32:29);
   assert.equal(m.state.score.blue,0);
   assert.equal(m.state.arrows.length,0);
  }
 }finally{clients.forEach(c=>c.ws.close());}
});
