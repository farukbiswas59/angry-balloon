import http from 'node:http';
import { randomBytes,randomUUID } from 'node:crypto';
import { WebSocketServer,WebSocket } from 'ws';
import { addPlayer,chooseTeam,chooseRole,makeRoom,start,startReason,step,shoot,place,input,disconnect,removePlayer,rematch,snapshot,finite,clamp,setBotBuilder } from '../game/engine.ts';
import { preference,selectMatch,availableTeam,addMatchmakingBuilders } from './matchmaking.ts';
import { BroadcastClock,broadcastRoom } from './broadcast.ts';
import type { Room,Player } from '../game/engine.ts';
const PORT=Number(process.env.PORT||3001),rooms=new Map<string,Room>();
const origins=(process.env.ALLOWED_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s=>s.trim());
if(process.env.NODE_ENV==='production'&&origins.some(s=>s==='*'||(s.includes('localhost')&&s!=='https://localhost')))throw Error('Set ALLOWED_ORIGINS to exact HTTPS frontend origins (https://localhost is allowed for the bundled Android app).');
const originAllowed=(o:string|undefined)=>!!o&&(origins.includes(o)||(process.env.NODE_ENV!=='production'&&/^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):5173$/.test(o)));
const server=http.createServer((req,res)=>{if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'ok',rooms:rooms.size}));}else{res.writeHead(404);res.end();}});
const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
type Session={token:string;socket:WebSocket|null;room:Room;player:Player;lastRevision:number;lastEvent:number;seen:number};
const sessions=new Map<string,Session>();
const ipRates=new Map<string,{at:number;count:number;connections:number}>();
server.on('upgrade',(req,socket,head)=>{const ip=process.env.TRUST_PROXY==='1'?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim():req.socket.remoteAddress||'unknown';const now=Date.now();let rate=ipRates.get(ip);if(!rate){rate={at:now,count:0,connections:0};ipRates.set(ip,rate);}if(now-rate.at>60000){rate.at=now;rate.count=0;}if(req.url!=='/socket'||!originAllowed(req.headers.origin)||++rate.count>60||rate.connections>=30){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}rate.connections++;socket.once('close',()=>{rate!.connections--;});wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
function send(ws:WebSocket,obj:unknown){if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<256000)ws.send(JSON.stringify(obj));}
function code(){let c='';do{c=Array.from(randomBytes(5),b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%31]).join('');}while(rooms.has(c));return c;}
function create(isPublic:boolean,training:boolean){if(rooms.size>=100)throw Error('The sky is busy. Try again shortly.');const r=makeRoom(code(),'',0,isPublic,training);rooms.set(r.code,r);return r;}
function leave(s:Session){removePlayer(s.room,s.player);sessions.delete(s.token);}
wss.on('connection',(ws)=>{let session:Session|undefined,windowAt=Date.now(),requests=0,joins=0,alive=true;const openedAt=Date.now();const heartbeat=setInterval(()=>{if(!alive){ws.terminate();return;}alive=false;ws.ping();if(!session&&Date.now()-openedAt>30000)ws.close(1008,'Join timeout');},15000);ws.on('pong',()=>{alive=true;});
ws.on('message',raw=>{if(Date.now()-windowAt>=1000){requests=0;windowAt=Date.now();}if(++requests>80){ws.close(1008,'Too many requests');return;}let m:Record<string,unknown>;try{m=JSON.parse(raw.toString());if(!m||typeof m!=='object'||Array.isArray(m))return;}catch{return;}
try{if(m.type==='ping'){send(ws,{type:'pong',at:m.at});return;}
if(m.type==='resume'&&!session){const s=typeof m.token==='string'?sessions.get(m.token):undefined;if(!s||!s.room.players.includes(s.player))throw Error('Your reserved spot expired. Join the room again.');if(s.socket&&s.socket!==ws)s.socket.close(4001,'Session resumed elsewhere');s.socket=ws;s.player.connected=true;s.player.inputAt=s.room.now;s.room.revision++;s.lastRevision=-1;s.lastEvent=s.room.serial;session=s;send(ws,{type:'joined',token:s.token,id:s.player.id,state:snapshot(s.room)});return;}
if(m.type==='join'&&!session){if(++joins>8)throw Error('Too many join attempts. Reconnect in a moment.');const mode=m.mode,prefs=preference(m.team,m.botBuilders);let r:Room|undefined;if(mode==='join'){if(typeof m.code!=='string'||!/^[A-Z2-9]{5}$/.test(m.code))throw Error('Enter a valid 5-character room code.');r=rooms.get(m.code);if(!r)throw Error('Room not found. Check the code.');}else if(mode==='quick'){r=selectMatch(rooms.values(),prefs);if(!r){r=create(true,false);r.botBuilders=prefs.botBuilders;addMatchmakingBuilders(r,randomUUID);}}else if(mode==='create'||mode==='training'){r=create(false,mode==='training');if(mode==='create'){r.botBuilders=prefs.botBuilders;addMatchmakingBuilders(r,randomUUID);}}else throw Error('Choose a play mode.');const p=addPlayer(r,randomUUID(),m.name);if(mode==='quick'){const team=availableTeam({...r,players:r.players.filter(q=>q!==p)},prefs.team);if(!team||!chooseTeam(r,p,team)){removePlayer(r,p);throw Error('That crew filled up. Try Quick Play again.');}}if(!r.host)r.host=p.id;const token=randomBytes(32).toString('hex');session={token,socket:ws,room:r,player:p,lastRevision:-1,lastEvent:r.serial,seen:Date.now()};sessions.set(token,session);if(r.training){chooseTeam(r,p,'blue');for(let i=0;i<3;i++){const b=addPlayer(r,randomUUID(),['Goggle','Poppy','Grump'][i],true);chooseTeam(r,b,i===0?'blue':'red');if(i<2)chooseRole(r,b,'builder');}}send(ws,{type:'joined',token,id:p.id,state:snapshot(r)});return;}
if(!session)return;const {room:r,player:p}=session;session.seen=Date.now();if(session.socket!==ws)return;
switch(m.type){case 'team':if(!chooseTeam(r,p,m.team))throw Error('That crew is full or the battle has started.');break;case 'role':if(!chooseRole(r,p,m.role))throw Error('The Builder slot is taken.');break;case 'personality':if(r.phase==='lobby'&&Number.isInteger(m.value)&&Number(m.value)>=0&&Number(m.value)<4){p.personality=Number(m.value);r.revision++;}break;case 'settings':if(r.host!==p.id||r.phase!=='lobby'||r.public)break;if(finite(m.duration))r.duration=clamp(Math.round(m.duration),60,600);if(finite(m.maxPlayers))r.maxPlayers=clamp(Math.round(m.maxPlayers),Math.max(4,r.players.length),10);r.revision++;break;case 'bot-builder':setBotBuilder(r,p,m.team,m.enabled,randomUUID());break;case 'start':if(r.public)throw Error('Matchmaking starts public battles automatically.');if(r.host===p.id&&!start(r))throw Error(startReason(r)||'Battle already started.');break;case 'input':input(r,p,m.x,m.y,m.seq);break;case 'aim':p.aimUntil=r.now+.3;break;case 'shoot':shoot(r,p,m.dx,m.dy);break;case 'place':place(r,p,m.slot);break;case 'rematch':if(r.host===p.id)rematch(r);break;case 'leave':leave(session);session=undefined;send(ws,{type:'left'});break;}}
catch(e){send(ws,{type:'error',message:e instanceof Error?e.message:'Could not complete that action.'});}});
ws.on('close',()=>{clearInterval(heartbeat);if(session&&session.socket===ws){session.socket=null;disconnect(session.room,session.player);}});});
let previous=performance.now(),accumulator=0;
const broadcastClock=new BroadcastClock(previous);
setInterval(()=>{const now=performance.now();accumulator+=Math.min((now-previous)/1000,.25);previous=now;while(accumulator>=1/60){for(const r of rooms.values())step(r,1/60);accumulator-=1/60;}
if(!broadcastClock.due(now))return;
const groups=new Map<Room,Session[]>();
for(const s of sessions.values()){
 if(!s.room.players.includes(s.player)){sessions.delete(s.token);continue;}
 if(!s.socket)continue;
 const group=groups.get(s.room);if(group)group.push(s);else groups.set(s.room,[s]);
}
for(const [room,recipients] of groups)broadcastRoom(room,recipients);
},1000/60);
setInterval(()=>{for(const [key,r] of rooms){const human=r.players.some(p=>!p.bot);if(!human||r.now-r.created>7200){for(const s of sessions.values())if(s.room===r){s.socket?.close(1001,'Room expired');sessions.delete(s.token);}rooms.delete(key);}}for(const [ip,v] of ipRates)if(v.connections===0&&Date.now()-v.at>120000)ipRates.delete(ip);},10000);
server.listen(PORT,'0.0.0.0',()=>console.log(`ANGRY BALLOON realtime server: http://localhost:${PORT} (WebSocket /socket)`));
function shutdown(){for(const ws of wss.clients)ws.close(1012,'Server restarting');server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),2000).unref();}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
